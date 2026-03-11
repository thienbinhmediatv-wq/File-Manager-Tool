import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import multer from "multer";
import * as jose from "jose";
import sharp from "sharp";
import { sendPdfEmail } from "./emailService";
import { getDriveKnowledge, listDriveFiles, clearDriveCache, processAllDriveFiles, getOcrProgress } from "./driveKnowledge";

const SERPAPI_KEY = process.env.SERPAPI_KEY || "";
const ARTIFICIAL_STUDIO_KEY = process.env.ARTIFICIAL_STUDIO_API_KEY || "";
const PDF_API_KEY = process.env.PDF_GENERATOR_API_KEY || "";
const PDF_API_SECRET = process.env.PDF_GENERATOR_API_SECRET || "";
const PDF_API_WORKSPACE = process.env.PDF_GENERATOR_WORKSPACE || "";

interface ArtificialStudioJob {
  _id: string;
  status: string;
  output?: string;
  model: string;
  error?: string;
}

async function artificialStudioGenerate(
  model: string,
  input: Record<string, string>,
  webhookUrl?: string
): Promise<ArtificialStudioJob | null> {
  if (!ARTIFICIAL_STUDIO_KEY) return null;
  try {
    const body: Record<string, unknown> = { model, input };
    if (webhookUrl) body.webhook = webhookUrl;
    const resp = await fetch("https://api.artificialstudio.ai/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ARTIFICIAL_STUDIO_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      console.error("Artificial Studio error:", resp.status, await resp.text());
      return null;
    }
    return await resp.json() as ArtificialStudioJob;
  } catch (err) {
    console.error("Artificial Studio fetch error:", err);
    return null;
  }
}

async function artificialStudioPoll(jobId: string, maxWait = 120000): Promise<ArtificialStudioJob | null> {
  if (!ARTIFICIAL_STUDIO_KEY) return null;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const resp = await fetch(`https://api.artificialstudio.ai/api/generate/${jobId}`, {
        headers: { Authorization: ARTIFICIAL_STUDIO_KEY },
      });
      if (!resp.ok) return null;
      const data = await resp.json() as ArtificialStudioJob;
      if (data.status === "success" || data.status === "error") return data;
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 5000));
  }
  return null;
}

interface SerpResult {
  title: string;
  link: string;
  snippet: string;
  thumbnail?: string;
}

async function serpSearch(query: string, opts?: { num?: number; searchType?: string }): Promise<SerpResult[]> {
  if (!SERPAPI_KEY) return [];
  try {
    const params = new URLSearchParams({
      api_key: SERPAPI_KEY,
      q: query,
      engine: "google",
      num: String(opts?.num || 5),
      hl: "vi",
      gl: "vn",
    });
    if (opts?.searchType === "images") {
      params.set("tbm", "isch");
    }
    const resp = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!resp.ok) {
      console.error("SerpAPI error:", resp.status, await resp.text());
      return [];
    }
    const data = await resp.json();
    if (opts?.searchType === "images" && data.images_results) {
      return data.images_results.slice(0, opts.num || 5).map((r: any) => ({
        title: r.title || "",
        link: r.link || r.original || "",
        snippet: r.source || "",
        thumbnail: r.thumbnail || r.original || "",
      }));
    }
    return (data.organic_results || []).slice(0, opts?.num || 5).map((r: any) => ({
      title: r.title || "",
      link: r.link || "",
      snippet: r.snippet || "",
      thumbnail: r.thumbnail || "",
    }));
  } catch (err) {
    console.error("SerpAPI fetch error:", err);
    return [];
  }
}

function formatSearchResults(results: SerpResult[]): string {
  if (results.length === 0) return "";
  return results.map((r, i) => `[${i + 1}] ${r.title}\n   ${r.snippet}\n   Link: ${r.link}`).join("\n\n");
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const GEN_DIR = path.join(process.cwd(), "public", "generated");
if (!fs.existsSync(GEN_DIR)) fs.mkdirSync(GEN_DIR, { recursive: true });

async function compressBase64ToFile(base64Url: string, quality = 60): Promise<string | null> {
  try {
    const match = base64Url.match(/^data:image\/\w+;base64,(.+)$/);
    if (!match) return null;
    const inputBuf = Buffer.from(match[1], "base64");
    const outFile = path.join(GEN_DIR, `cimg_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
    await sharp(inputBuf).jpeg({ quality }).toFile(outFile);
    return outFile;
  } catch (e) {
    console.error("compressBase64ToFile error:", e);
    return null;
  }
}

async function preCompressImages(imageUrls: string[], quality = 60): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  await Promise.all(
    imageUrls.filter(u => u && u.startsWith("data:image/")).map(async (url) => {
      const compressed = await compressBase64ToFile(url, quality);
      if (compressed) cache.set(url, compressed);
    })
  );
  return cache;
}

async function savePdfToGenerated(projectId: number, pdfBuffer: Buffer, projectTitle: string): Promise<string> {
  const safeName = projectTitle.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40) || "project";
  const fileName = `BMT_Decor_${safeName}_${projectId}_${Date.now()}.pdf`;
  const filePath = path.join(GEN_DIR, fileName);
  fs.writeFileSync(filePath, pdfBuffer);
  return `/generated/${fileName}`;
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".dwg", ".dxf", ".mp4", ".mov", ".avi"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const STEP_NAMES: Record<number, string> = {
  1: "Thu thập dữ liệu",
  2: "Phân tích & Layout",
  3: "Xuất bản vẽ CAD",
  4: "Mô hình 3D & Mặt tiền",
  5: "Thiết kế nội thất",
  6: "Render phối cảnh",
  7: "Xuất PDF hồ sơ",
};

const STEP_PROMPTS: Record<number, string> = {
  1: "Chào bạn! Tôi là trợ lý AI thiết kế kiến trúc của Bmt Decor. Hãy cho tôi biết thông tin về khu đất và yêu cầu thiết kế của bạn.",
  2: "Tôi đã phân tích hiện trạng khu đất. Bạn muốn điều chỉnh gì về hướng nhà, bố trí phòng, hay yêu cầu phong thủy không?",
  3: "Bản vẽ CAD đã được tạo. Bạn muốn chỉnh sửa vị trí tường, cửa, cầu thang hay kích thước phòng nào không?",
  4: "Hãy cho tôi biết phong cách mặt tiền bạn yêu thích và tông màu mong muốn.",
  5: "Bạn muốn nội thất phong cách nào? Hãy cho tôi biết về vật liệu ưa thích và ngân sách dự kiến.",
  6: "Tôi sẽ render các góc nhìn cho bạn. Bạn muốn xem góc nào?",
  7: "Hồ sơ PDF sẽ bao gồm tất cả bản vẽ, render và thông tin kỹ thuật.",
};

async function createPdfApiToken(): Promise<string> {
  return await new jose.SignJWT({ iss: PDF_API_KEY, sub: PDF_API_WORKSPACE })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime("60s")
    .sign(new TextEncoder().encode(PDF_API_SECRET));
}

async function generatePdfViaApi(templateId: number, data: Record<string, unknown>): Promise<{ url: string; name: string } | null> {
  if (!PDF_API_KEY || !PDF_API_SECRET) return null;
  try {
    const token = await createPdfApiToken();
    const resp = await fetch("https://us1.pdfgeneratorapi.com/api/v4/documents/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template: { id: templateId, data },
        format: "pdf",
        output: "url",
      }),
    });
    if (!resp.ok) {
      console.error("PDF Generator API error:", resp.status, await resp.text());
      return null;
    }
    const result = await resp.json();
    return {
      url: result.response,
      name: result.meta?.display_name || "document.pdf",
    };
  } catch (e) {
    console.error("PDF Generator API failed:", e);
    return null;
  }
}

async function aiChat(messages: Array<{role: string; content: string}>, maxTokens = 2048): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: messages as Array<{role: "user" | "assistant" | "system"; content: string}>,
    max_completion_tokens: maxTokens,
  });
  return completion.choices[0]?.message?.content || "";
}

async function aiGenerateImage(prompt: string, projectId: number, name: string): Promise<string> {
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    n: 1,
    size: "1024x1024",
  });
  const b64 = response.data[0]?.b64_json;
  if (b64) {
    return `data:image/png;base64,${b64}`;
  }
  const url = response.data[0]?.url;
  return url || "";
}

const SEARCH_KEYWORDS = [
  "giá", "bao nhiêu", "chi phí", "xu hướng", "trend", "mới nhất", "phổ biến",
  "vật liệu", "gạch", "sơn", "gỗ", "đá", "kính", "inox", "nhôm",
  "tham khảo", "ví dụ", "mẫu", "kiểu", "style", "phong cách",
  "nhà thầu", "đơn vị", "công ty", "thương hiệu",
  "tiêu chuẩn", "quy chuẩn", "TCVN", "luật xây dựng",
  "so sánh", "đánh giá", "review", "tốt nhất",
  "Buôn Ma Thuột", "BMT", "Đắk Lắk", "Tây Nguyên",
  "phong thủy", "hướng nhà", "tuổi",
  "tìm", "search", "tra cứu", "lookup",
];

function detectSearchIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return SEARCH_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

function buildSearchQuery(message: string, project: any): string {
  let query = message;
  if (query.length < 15 && project) {
    query = `${message} nhà ${project.style} ${project.floors} tầng Việt Nam`;
  }
  if (!query.toLowerCase().includes("việt nam") && !query.toLowerCase().includes("vn")) {
    query += " Việt Nam";
  }
  return query;
}

function buildProjectContext(project: Record<string, unknown>): string {
  return `Thông tin dự án:
- Kích thước đất: ${project.landWidth}m x ${project.landLength}m (${(project.landWidth as number) * (project.landLength as number)} m²)
- Số tầng: ${project.floors}
- Số phòng ngủ: ${project.bedrooms}
- Phong cách: ${project.style}
- Ngân sách: ${project.budget} triệu VND
- Yêu cầu đặc biệt: ${JSON.stringify(project.siteRequirements || {})}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const expressStatic = (await import("express")).default.static;
  app.use("/generated", expressStatic(GEN_DIR));
  app.use("/uploads", expressStatic(UPLOAD_DIR));

  app.get("/api/projects", async (_req, res) => {
    const allProjects = await storage.getProjects();
    res.json(allProjects);
  });

  app.get("/api/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const project = await storage.getProject(id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const schema = z.object({
        title: z.string().min(1),
        clientName: z.string().default(""),
        landWidth: z.coerce.number().min(1),
        landLength: z.coerce.number().min(1),
        floors: z.coerce.number().min(1).max(10),
        bedrooms: z.coerce.number().min(1).max(20),
        style: z.string().min(1),
        budget: z.coerce.number().min(0),
      });
      const input = schema.parse(req.body);
      const project = await storage.createProject(input);
      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const existing = await storage.getProject(id);
    if (!existing) return res.status(404).json({ message: "Project not found" });
    await storage.deleteProject(id);
    res.status(204).send();
  });

  app.post("/api/upload", upload.array("files", 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }
      const uploaded = files.map(f => {
        const buf = fs.readFileSync(f.path);
        const b64 = buf.toString("base64");
        const mime = f.mimetype || "image/png";
        try { fs.unlinkSync(f.path); } catch {}
        return {
          originalName: f.originalname,
          filename: f.filename,
          url: `data:${mime};base64,${b64}`,
          size: f.size,
          type: f.mimetype,
        };
      });
      res.json({ files: uploaded });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  app.post("/api/projects/:id/step/:step/submit", async (req, res) => {
    const id = parseInt(req.params.id);
    const step = parseInt(req.params.step);
    if (isNaN(id) || isNaN(step) || step < 1 || step > 7) {
      return res.status(400).json({ message: "Invalid parameters" });
    }
    const project = await storage.getProject(id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const updates: Record<string, unknown> = {};
    const statuses = { ...(project.stepStatuses as Record<string, string> || {}), [step]: "submitted" };
    updates.stepStatuses = statuses;

    if (step === 1) {
      if (req.body.siteRequirements) updates.siteRequirements = req.body.siteRequirements;
      if (req.body.budgetSheetUrl) updates.budgetSheetUrl = req.body.budgetSheetUrl;
      if (req.body.uploadedFiles) updates.uploadedFiles = req.body.uploadedFiles;
    } else if (step === 4) {
      if (req.body.facadeStyle) updates.facadeStyle = req.body.facadeStyle;
    }

    const updated = await storage.updateProject(id, updates);
    res.json(updated);
  });

  app.post("/api/projects/:id/step/:step/process", async (req, res) => {
    const id = parseInt(req.params.id);
    const step = parseInt(req.params.step);
    if (isNaN(id) || isNaN(step) || step < 1 || step > 7) return res.status(400).json({ message: "Invalid step" });
    if (step >= 5) res.setTimeout(120000);
    const project = await storage.getProject(id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (step > 1) {
      const prevStatus = ((project.stepStatuses as Record<string, string>) || {})[String(step - 1)];
      if (prevStatus !== "approved") {
        return res.status(400).json({ message: `Bước ${step - 1} chưa được duyệt` });
      }
    }

    const statuses = { ...(project.stepStatuses as Record<string, string> || {}), [step]: "processing" };
    await storage.updateProject(id, { stepStatuses: statuses });

    res.json({ message: "Processing started", stepName: STEP_NAMES[step] });

    processStepInBackground(id, step, project).catch(err => {
      console.error(`Background step ${step} error:`, err);
    });
  });

  async function processStepInBackground(id: number, step: number, _initialProject: any) {
    const freshProject = await storage.getProject(id);
    if (!freshProject) return;
    const project = freshProject;
    let result: unknown = null;
    const area = project.landWidth * project.landLength;
    const ctx = buildProjectContext(project as unknown as Record<string, unknown>);

    try {
      if (step === 1) {
        result = { collected: true, area, dimensions: `${project.landWidth}m x ${project.landLength}m` };

      } else if (step === 2) {
        const analysisText = await aiChat([
          { role: "system", content: "Bạn là kiến trúc sư AI chuyên phân tích hiện trạng khu đất tại Việt Nam. Trả lời bằng tiếng Việt, chuyên nghiệp." },
          { role: "user", content: `Phân tích hiện trạng khu đất và đề xuất layout phòng chi tiết cho dự án:
${ctx}

Hãy phân tích:
1. Hướng nhà tối ưu (theo phong thủy VN)
2. Ánh sáng tự nhiên
3. Thông gió
4. Phong thủy sơ bộ
5. Đề xuất bố trí layout phòng cho từng tầng (tên phòng, kích thước m x m)

Trả lời chi tiết.` }
        ], 3000);

        const layoutText = await aiChat([
          { role: "system", content: "Bạn là kiến trúc sư AI. Trả về JSON thuần túy, không markdown." },
          { role: "user", content: `Tạo layout phòng chi tiết cho nhà ${project.landWidth}m x ${project.landLength}m, ${project.floors} tầng, ${project.bedrooms} phòng ngủ, phong cách ${project.style}.

Trả về JSON dạng:
{"floors": [{"floor": 1, "rooms": [{"name": "Phòng khách", "w": 4, "h": 5}, ...]}, ...]}

CHỈ trả về JSON, không giải thích.` }
        ]);

        let layoutData;
        try {
          const jsonMatch = layoutText.match(/\{[\s\S]*\}/);
          layoutData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch {
          layoutData = {
            floors: Array.from({ length: project.floors }, (_, i) => ({
              floor: i + 1,
              rooms: i === 0
                ? [
                    { name: "Phòng khách", w: Math.round(project.landWidth * 0.6 * 10) / 10, h: Math.round(project.landLength * 0.3 * 10) / 10 },
                    { name: "Bếp + Ăn", w: Math.round(project.landWidth * 0.5 * 10) / 10, h: Math.round(project.landLength * 0.25 * 10) / 10 },
                    { name: "WC", w: Math.round(project.landWidth * 0.3 * 10) / 10, h: Math.round(project.landLength * 0.15 * 10) / 10 },
                    { name: "Gara", w: Math.round(project.landWidth * 0.4 * 10) / 10, h: Math.round(project.landLength * 0.3 * 10) / 10 },
                  ]
                : [
                    { name: `PN ${i === 1 ? "Master" : i}`, w: Math.round(project.landWidth * 0.5 * 10) / 10, h: Math.round(project.landLength * 0.45 * 10) / 10 },
                    { name: `PN ${i + 1}`, w: Math.round(project.landWidth * 0.5 * 10) / 10, h: Math.round(project.landLength * 0.35 * 10) / 10 },
                    { name: "WC", w: Math.round(project.landWidth * 0.3 * 10) / 10, h: Math.round(project.landLength * 0.2 * 10) / 10 },
                  ],
            })),
          };
        }

        result = {
          analysis: {
            dimensions: `${project.landWidth}m x ${project.landLength}m`,
            area: `${area} m²`,
            aiAnalysis: analysisText,
          },
          layout: layoutData,
          aiSuggestion: analysisText,
        };

      } else if (step === 3) {
        const cadText = await aiChat([
          { role: "system", content: "Bạn là kỹ sư xây dựng AI. Tạo mô tả bản vẽ kỹ thuật chi tiết bằng tiếng Việt." },
          { role: "user", content: `Tạo mô tả bản vẽ CAD/kỹ thuật chi tiết cho dự án:
${ctx}
Layout đã duyệt: ${JSON.stringify(project.layoutResult || {})}

Mô tả chi tiết:
1. Bản vẽ mặt bằng từng tầng (vị trí tường, cửa đi, cửa sổ, cầu thang)
2. Mặt cắt A-A (chiều cao tầng, kết cấu sàn, mái)
3. Mặt đứng chính (mặt tiền)
4. Kích thước chi tiết từng phòng
5. Vị trí cột, dầm chính

Trả lời chi tiết kỹ thuật.` }
        ], 3000);

        const cadImageUrl = await aiGenerateImage(
          `Architectural floor plan blueprint, 2D technical drawing, top-down view of a ${project.floors}-story Vietnamese house, ${project.landWidth}m x ${project.landLength}m, ${project.style} style, showing rooms, walls, doors, stairs, dimensions, clean professional CAD drawing style, blue lines on white background`,
          id, "cad_floorplan"
        );

        result = {
          cadDrawings: [
            { name: "Mặt bằng tổng thể", type: "floorplan", imageUrl: cadImageUrl },
          ],
          cadDescription: cadText,
          dimensions: { totalArea: area * project.floors, wallThickness: 0.2, floorHeight: 3.3 },
        };

      } else if (step === 4) {
        const facadeStyle = project.facadeStyle || project.style;

        const facadePrompts = [
          { name: "facade_day", prompt: `Exterior facade of a beautiful ${project.floors}-story Vietnamese residential house, ${facadeStyle} architecture style, ${project.landWidth}m wide frontage, daytime with blue sky, professional architectural visualization, photorealistic, lush tropical landscaping, clean design` },
          { name: "facade_night", prompt: `Exterior facade of a beautiful ${project.floors}-story Vietnamese residential house, ${facadeStyle} architecture style, ${project.landWidth}m wide, night time with warm interior lighting glowing through windows, professional architectural visualization, photorealistic, ambient outdoor lighting` },
          { name: "facade_angle45", prompt: `45-degree angle view of a ${project.floors}-story Vietnamese residential house, ${facadeStyle} style, showing side wall and front facade, ${project.landWidth}m x ${project.landLength}m lot, daytime, lush garden, professional 3D render, photorealistic` },
          { name: "facade_aerial", prompt: `Aerial bird's eye view of a ${project.floors}-story Vietnamese residential house, ${facadeStyle} architecture, showing rooftop and surrounding landscape, ${project.landWidth}m x ${project.landLength}m lot, professional architectural visualization, photorealistic, urban context` },
        ];

        const facadeImages: string[] = [];
        for (const fp of facadePrompts) {
          const url = await aiGenerateImage(fp.prompt, id, fp.name);
          facadeImages.push(url);
        }

        const designText = await aiChat([
          { role: "system", content: "Bạn là kiến trúc sư AI chuyên thiết kế mặt tiền nhà Việt Nam. Trả lời chi tiết bằng tiếng Việt." },
          { role: "user", content: `Mô tả chi tiết thiết kế mặt tiền phong cách ${facadeStyle} cho nhà ${project.floors} tầng, ${project.landWidth}m rộng, ${project.landLength}m sâu:
- Vật liệu mặt tiền (cụ thể loại gạch, đá, sơn, kính)
- Tỷ lệ cửa sổ và cửa đi
- Mái và chi tiết kiến trúc đặc trưng
- Hệ thống ban công, lam che nắng
- Màu sắc chủ đạo và phối màu
- Cây xanh trang trí mặt tiền
- Hệ thống chiếu sáng ngoại thất` }
        ], 3000);

        result = {
          facadeStyle,
          facadeImages,
          designDescription: designText,
        };

      } else if (step === 5) {
        const interiorText = await aiChat([
          { role: "system", content: "Bạn là nhà thiết kế nội thất AI chuyên nghiệp tại Việt Nam. Trả lời bằng tiếng Việt." },
          { role: "user", content: `Thiết kế nội thất chi tiết cho dự án:
${ctx}

Cho mỗi phòng (phòng khách, phòng ngủ master, bếp, WC, ban công/sân thượng), hãy đề xuất:
1. Vật liệu sàn, tường, trần
2. Đồ nội thất cụ thể (tên, kích thước, giá ước tính VND)
3. Hệ thống ánh sáng
4. Tổng chi phí nội thất ước tính

Trả lời chi tiết, có số liệu cụ thể.` }
        ], 3000);

        const interiorPrompts = [
          { name: "Phòng khách", key: "interior_living", prompt: `Interior design of a luxurious Vietnamese ${project.style} style living room, modern furniture, natural wood materials, warm lighting, indoor plants, professional interior photography, photorealistic, 4K quality` },
          { name: "Phòng ngủ Master", key: "interior_bedroom", prompt: `Interior design of a beautiful ${project.style} style master bedroom, Vietnamese residential, elegant bed, warm ambient lighting, natural materials, cozy atmosphere, professional interior photography` },
          { name: "Phòng bếp", key: "interior_kitchen", prompt: `Modern Vietnamese ${project.style} style kitchen interior, beautiful cabinetry, island counter, natural materials, pendant lighting, tiled backsplash, professional interior photography, photorealistic` },
          { name: "Phòng tắm", key: "interior_bathroom", prompt: `Luxurious Vietnamese ${project.style} style bathroom, marble tiles, rain shower, freestanding bathtub, warm lighting, natural stone accents, professional interior photography, photorealistic` },
          { name: "Ban công / Sân thượng", key: "interior_balcony", prompt: `Beautiful ${project.style} style balcony terrace of Vietnamese house, outdoor lounge furniture, tropical plants, city view, warm evening lighting, professional architectural photography` },
        ];

        const interiorImages: Array<{name: string; url: string}> = [];
        for (const ip of interiorPrompts) {
          const url = await aiGenerateImage(ip.prompt, id, ip.key);
          interiorImages.push({ name: ip.name, url });
        }

        result = {
          interiorDescription: interiorText,
          interiorImages,
          estimatedCost: `${Math.round(area * project.floors * 8.5)} triệu VND`,
        };

      } else if (step === 6) {
        const renderPrompts = [
          { name: "Mặt tiền ban ngày", prompt: `Photorealistic exterior render of a ${project.floors}-story ${project.style} Vietnamese house, ${project.landWidth}m x ${project.landLength}m lot, daytime, beautiful landscaping, blue sky, professional architectural visualization, 8K quality` },
          { name: "Mặt tiền ban đêm", prompt: `Photorealistic exterior render of a ${project.floors}-story ${project.style} Vietnamese house at night, warm interior lighting, landscape lighting, dramatic sky, professional architectural visualization, 8K quality` },
          { name: "Phòng khách", prompt: `Photorealistic interior render of a spacious ${project.style} style living room in Vietnamese house, natural light through large windows, modern furniture, warm atmosphere, professional interior visualization, 8K` },
          { name: "Phòng ngủ Master", prompt: `Photorealistic interior render of a ${project.style} style master bedroom, Vietnamese residential, elegant design, warm lighting, comfortable atmosphere, high quality visualization, 8K` },
          { name: "Phòng bếp & ăn", prompt: `Photorealistic interior render of a modern ${project.style} Vietnamese kitchen and dining area, open plan, pendant lights, natural wood, marble countertop, professional visualization, 8K` },
          { name: "Sân vườn & Cảnh quan", prompt: `Photorealistic landscape render of a ${project.floors}-story ${project.style} Vietnamese house garden, tropical plants, stone pathway, outdoor seating area, water feature, professional architectural visualization, 8K` },
        ];

        const renders = [];
        for (const r of renderPrompts) {
          const url = await aiGenerateImage(r.prompt, id, `render_${r.name.replace(/\s/g, "_")}`);
          renders.push({ name: r.name, url, angle: r.name });
        }

        result = { renders };

      } else if (step === 7) {
        const analysis = project.analysisResult as Record<string, string> | null;
        const layout = project.layoutResult as { floors?: Array<{ floor: number; rooms: Array<{ name: string; w: number; h: number }> }> } | null;
        const cad = project.cadResult as { cadDescription?: string; cadDrawings?: Array<{imageUrl?: string; name?: string}> } | null;
        const model3d = project.model3dResult as { facadeImages?: string[]; designDescription?: string } | null;
        const interior = project.interiorResult as { interiorDescription?: string; interiorImages?: Array<{url: string; name?: string}> } | null;
        const renderResult = project.renderResult as { renders?: Array<{name: string; url: string}> } | null;
        const totalArea = area * project.floors;
        const buildCost = Math.round(totalArea * 7);
        const interiorCost = Math.round(totalArea * 3.5);
        const totalCost = Math.round(totalArea * 10.5);

        const sections = [
          "Trang bìa & Mục lục",
          "Phân tích hiện trạng & Phong thủy",
          "Bố trí mặt bằng các tầng",
          "Bản vẽ kỹ thuật CAD",
          "Thiết kế mặt tiền (4 phối cảnh)",
          "Thiết kế nội thất (5 phòng)",
          "Render phối cảnh 3D (6 hình full-page)",
          "Dự toán chi phí chi tiết",
        ];

        let pdfSource = "pdfkit";
        let downloadUrl = "";
        let pageCount = 8;
        let estimatedSize = "";

        // --- TRY PDF GENERATOR API FIRST ---
        const layoutText = layout?.floors
          ? layout.floors.map(fl => `Tầng ${fl.floor}: ` + fl.rooms.map(r => `${r.name} (${r.w}m × ${r.h}m = ${(r.w * r.h).toFixed(1)} m²)`).join(", ")).join("\n")
          : "";

        const pdfApiData = {
          company_name: "BMT DECOR",
          company_subtitle: "Hệ thống AI Thiết kế Kiến trúc & Nội thất",
          title: "HỒ SƠ THIẾT KẾ KIẾN TRÚC",
          project_name: project.title,
          client_name: project.clientName || "N/A",
          land_size: `${project.landWidth}m × ${project.landLength}m (${area} m²)`,
          floors: `${project.floors} tầng`,
          bedrooms: `${project.bedrooms} phòng`,
          style: project.style,
          budget: `${project.budget} triệu VNĐ`,
          date: new Date().toLocaleDateString("vi-VN"),
          analysis_text: analysis?.aiAnalysis ? String(analysis.aiAnalysis).substring(0, 4000) : "Chưa có dữ liệu phân tích.",
          layout_text: layoutText || "Chưa có dữ liệu layout.",
          cad_text: cad?.cadDescription ? cad.cadDescription.substring(0, 4000) : "Chưa có dữ liệu CAD.",
          facade_text: model3d?.designDescription ? model3d.designDescription.substring(0, 4000) : "Chưa có mô tả mặt tiền.",
          interior_text: interior?.interiorDescription ? interior.interiorDescription.substring(0, 4000) : "Chưa có mô tả nội thất.",
          total_area: `${totalArea} m²`,
          unit_price: "6 - 10 triệu VNĐ/m²",
          build_cost: `${buildCost.toLocaleString("vi-VN")} triệu VNĐ`,
          interior_cost: `${interiorCost.toLocaleString("vi-VN")} triệu VNĐ`,
          total_cost: `${totalCost.toLocaleString("vi-VN")} triệu VNĐ`,
          note: "Lưu ý: Đây là ước tính sơ bộ. Chi phí thực tế có thể thay đổi tùy theo vật liệu và nhà thầu.",
          footer: "Cảm ơn quý khách đã tin tưởng sử dụng dịch vụ BMT Decor",
        };

        try {
          const templateId = 1611894;
          const apiResult = await generatePdfViaApi(templateId, pdfApiData);
          if (apiResult?.url) {
            pdfSource = "pdf_generator_api";
            downloadUrl = apiResult.url;
            estimatedSize = "PDF Generator API";
            console.log(`Step 7: PDF created via PDF Generator API for project ${id}`);
          }
        } catch (e) {
          console.error("PDF Generator API attempt failed, falling back to PDFKit:", e);
        }

        // --- FALLBACK: PDFKIT ---
        if (!downloadUrl) {
          console.log(`Step 7: Using PDFKit fallback for project ${id}`);
          const pdfFilename = `${id}_hoso_${Date.now()}.pdf`;
          const pdfPath = path.join(GEN_DIR, pdfFilename);

          const fontRegular = path.join(process.cwd(), "server", "fonts", "Roboto-Regular.ttf");
          const fontBold = path.join(process.cwd(), "server", "fonts", "Roboto-Bold.ttf");

          const W = 595.28;
          const H = 841.89;
          const M = 50;
          const CW = W - 2 * M;
          const NAVY = "#1a365d";
          const DARK = "#2d3748";
          const ACCENT = "#3182ce";
          const GREEN_BG = "#f0fff4";
          const GREEN_TXT = "#276749";

          // Pre-compress all base64 images before PDF generation
          const allImgUrls: string[] = [
            ...(model3d?.facadeImages || []),
            ...(interior?.interiorImages?.map((i: {url: string}) => i.url) || []),
            ...(renderResult?.renders?.map((r: {url: string}) => r.url) || []),
            ...(cad?.cadDrawings?.map((d: {imageUrl?: string}) => d.imageUrl || "") || []),
          ].filter(Boolean);
          const compressedImgCache = await preCompressImages(allImgUrls, 60);

          const doc = new PDFDocument({ size: "A4", margin: M });
          let pdfKitPages = 1;
          doc.on("pageAdded", () => { pdfKitPages++; });
          const writeStream = fs.createWriteStream(pdfPath);
          doc.pipe(writeStream);

          if (fs.existsSync(fontRegular)) doc.registerFont("VN", fontRegular);
          if (fs.existsSync(fontBold)) doc.registerFont("VN-Bold", fontBold);
          const fnR = fs.existsSync(fontRegular) ? "VN" : "Helvetica";
          const fnB = fs.existsSync(fontBold) ? "VN-Bold" : "Helvetica-Bold";

          const addHeaderFooter = (pageNum: number, totalPages: number) => {
            doc.save();
            doc.rect(0, H - 35, W, 35).fill(NAVY);
            doc.fill("#ffffff").font(fnR).fontSize(7)
              .text("BMT DECOR — Hệ thống AI Thiết kế Kiến trúc & Nội thất", M, H - 25, { width: CW - 60 })
              .text(`Trang ${pageNum}`, W - 100, H - 25, { width: 50, align: "right" });
            doc.restore();
          };

          let embeddedImageCount = 0;
          const tmpFiles: string[] = [...compressedImgCache.values()];

          const resolveImage = (imgUrl: string): string | Buffer | null => {
            if (!imgUrl) return null;
            if (compressedImgCache.has(imgUrl)) return compressedImgCache.get(imgUrl)!;
            if (imgUrl.startsWith("data:image/")) {
              const match = imgUrl.match(/^data:image\/\w+;base64,(.+)$/);
              if (match) {
                const buf = Buffer.from(match[1], "base64");
                const tmpFile = path.join(GEN_DIR, `tmp_pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
                try {
                  fs.writeFileSync(tmpFile, buf);
                  tmpFiles.push(tmpFile);
                  return tmpFile;
                } catch {
                  return buf;
                }
              }
              return null;
            }
            if (imgUrl.startsWith("/generated/")) {
              const safeFile = path.basename(imgUrl.replace("/generated/", ""));
              const imgPath = path.join(GEN_DIR, safeFile);
              return fs.existsSync(imgPath) ? imgPath : null;
            }
            if (imgUrl.startsWith("/uploads/")) {
              const safeFile = path.basename(imgUrl.replace("/uploads/", ""));
              const imgPath = path.join(process.cwd(), "public", "uploads", safeFile);
              return fs.existsSync(imgPath) ? imgPath : null;
            }
            if (imgUrl.startsWith("http://") || imgUrl.startsWith("https://")) {
              console.warn("PDF: Skipping remote URL (not supported in production):", imgUrl.substring(0, 80));
              return null;
            }
            return null;
          };

          const addFullPageImage = (imgUrl: string, caption: string) => {
            const imgPath = resolveImage(imgUrl);
            if (!imgPath) { console.warn(`PDF: Missing image for "${caption}"`); return; }
            try {
              doc.addPage();
              doc.image(imgPath, 0, 0, { width: W, height: H - 70 });
              doc.save(); doc.opacity(0.85); doc.rect(0, H - 70, W, 70).fill(NAVY); doc.opacity(1); doc.restore();
              doc.fill("#ffffff").font(fnB).fontSize(13).text(caption, M, H - 55, { width: CW, align: "center" });
              doc.font(fnR).fontSize(9).text(project.title, M, H - 35, { width: CW, align: "center" });
              embeddedImageCount++;
            } catch (e) { console.error("PDF full-page image error:", e); }
          };

          const addImageWithCaption = (imgUrl: string, caption: string, fitW = 480, fitH = 600) => {
            const imgPath = resolveImage(imgUrl);
            if (!imgPath) { console.warn(`PDF: Missing image for "${caption}"`); return; }
            try {
              doc.addPage();
              const topY = 60;
              doc.font(fnB).fontSize(12).fill(DARK).text(caption, M, topY, { width: CW, align: "center" });
              doc.moveDown(0.5);
              const imgY = doc.y;
              doc.image(imgPath, (W - fitW) / 2, imgY, { fit: [fitW, fitH], align: "center" });
              embeddedImageCount++;
            } catch (e) { console.error("PDF image embed error:", e); }
          };

          const sectionDivider = (num: number, title: string, subtitle?: string) => {
            doc.addPage();
            doc.rect(0, 0, W, H).fill(NAVY);
            doc.fill("#ffffff").font(fnB).fontSize(60).text(`0${num}`, M, H / 2 - 100, { width: CW, align: "center" });
            doc.fontSize(28).text(title, M, H / 2 - 20, { width: CW, align: "center" });
            if (subtitle) {
              doc.moveDown(0.5);
              doc.font(fnR).fontSize(14).text(subtitle, { width: CW, align: "center" });
            }
            doc.rect(W / 2 - 40, H / 2 + 60, 80, 3).fill(ACCENT);
          };

          const sectionContent = (title: string) => {
            doc.addPage();
            doc.rect(0, 0, W, 55).fill(DARK);
            doc.fill("#ffffff").font(fnB).fontSize(15).text(title, M, 18, { width: CW });
            doc.fill("#000000").font(fnR).fontSize(10).text("", M, 70);
          };

          // ===================== PAGE 1: COVER =====================
          doc.rect(0, 0, W, H).fill(NAVY);
          doc.rect(M - 10, 80, CW + 20, 3).fill(ACCENT);
          doc.fill("#ffffff").font(fnB).fontSize(42).text("BMT DECOR", M, 110, { width: CW, align: "center" });
          doc.font(fnR).fontSize(14).text("HỆ THỐNG AI THIẾT KẾ KIẾN TRÚC & NỘI THẤT", { width: CW, align: "center" });
          doc.moveDown(3);
          doc.rect(M - 10, doc.y, CW + 20, 3).fill(ACCENT);
          doc.moveDown(2);
          doc.font(fnB).fontSize(26).text("PHƯƠNG ÁN THIẾT KẾ", { width: CW, align: "center" });
          doc.moveDown(0.5);
          doc.font(fnB).fontSize(22).fill("#90cdf4").text(project.title.toUpperCase(), { width: CW, align: "center" });
          doc.fill("#ffffff");
          doc.moveDown(3);
          doc.font(fnR).fontSize(13);
          const coverInfo = [
            `Khách hàng: ${project.clientName || "N/A"}`,
            `Kích thước: ${project.landWidth}m × ${project.landLength}m (${area} m²)`,
            `Quy mô: ${project.floors} tầng — ${project.bedrooms} phòng ngủ`,
            `Phong cách: ${project.style}`,
            `Ngân sách: ${project.budget} triệu VNĐ`,
          ];
          for (const line of coverInfo) {
            doc.text(line, { width: CW, align: "center" });
            doc.moveDown(0.4);
          }
          doc.moveDown(2);
          doc.rect(M - 10, doc.y, CW + 20, 1).fill("#4a5568");
          doc.moveDown(1);
          doc.fill("#a0aec0").font(fnR).fontSize(10).text(`Ngày lập: ${new Date().toLocaleDateString("vi-VN")}`, { width: CW, align: "center" });

          // Cover image if available (first facade image)
          const coverImgUrl = model3d?.facadeImages?.[0] || renderResult?.renders?.[0]?.url;
          if (coverImgUrl) {
            const coverImgPath = resolveImage(coverImgUrl);
            if (coverImgPath) {
              try {
                doc.addPage();
                doc.image(coverImgPath, 0, 0, { width: W, height: H });
                doc.save(); doc.opacity(0.9); doc.rect(0, H - 80, W, 80).fill(NAVY); doc.opacity(1); doc.restore();
                doc.fill("#ffffff").font(fnB).fontSize(16).text("PHỐI CẢNH TỔNG THỂ", M, H - 65, { width: CW, align: "center" });
                doc.font(fnR).fontSize(11).text(project.title, { width: CW, align: "center" });
              } catch (e) { console.error("Cover image error:", e); }
            }
          }

          // ===================== PAGE: TABLE OF CONTENTS =====================
          doc.addPage();
          doc.rect(0, 0, W, 55).fill(NAVY);
          doc.fill("#ffffff").font(fnB).fontSize(20).text("MỤC LỤC", M, 16, { width: CW, align: "center" });
          doc.fill("#000000");
          doc.font(fnR).fontSize(12).text("", M, 80);
          const tocItems = [
            { num: "01", title: "PHÂN TÍCH HIỆN TRẠNG", sub: "Đánh giá khu đất, phong thủy, quy hoạch" },
            { num: "02", title: "BỐ TRÍ MẶT BẰNG", sub: "Layout các tầng, phân chia phòng chức năng" },
            { num: "03", title: "BẢN VẼ KỸ THUẬT", sub: "Bản vẽ CAD, kết cấu, hệ thống kỹ thuật" },
            { num: "04", title: "THIẾT KẾ MẶT TIỀN", sub: "Kiến trúc ngoại thất, vật liệu, phối cảnh" },
            { num: "05", title: "THIẾT KẾ NỘI THẤT", sub: "Nội thất từng phòng, vật liệu, màu sắc" },
            { num: "06", title: "RENDER PHỐI CẢNH", sub: "Hình ảnh 3D photorealistic chất lượng cao" },
            { num: "07", title: "DỰ TOÁN CHI PHÍ", sub: "Chi phí xây dựng, nội thất, tổng dự toán" },
          ];
          for (const item of tocItems) {
            doc.moveDown(0.8);
            doc.font(fnB).fontSize(18).fill(ACCENT).text(item.num, M, doc.y, { continued: true });
            doc.fill(DARK).fontSize(14).text(`   ${item.title}`);
            doc.font(fnR).fontSize(10).fill("#718096").text(`      ${item.sub}`);
            doc.fill("#000000");
            doc.moveDown(0.3);
            doc.rect(M, doc.y, CW, 0.5).fill("#e2e8f0");
          }

          // ===================== SECTION 1: ANALYSIS =====================
          sectionDivider(1, "PHÂN TÍCH HIỆN TRẠNG", "Đánh giá khu đất & yêu cầu thiết kế");
          sectionContent("1. PHÂN TÍCH HIỆN TRẠNG");
          doc.font(fnB).fontSize(12).fill(DARK).text("THÔNG TIN DỰ ÁN");
          doc.moveDown(0.5);
          doc.font(fnR).fontSize(10).fill("#000000");
          const projectDetails = [
            ["Tên dự án", project.title],
            ["Khách hàng", project.clientName || "N/A"],
            ["Kích thước đất", `${project.landWidth}m × ${project.landLength}m = ${area} m²`],
            ["Số tầng", `${project.floors} tầng`],
            ["Phòng ngủ", `${project.bedrooms} phòng`],
            ["Phong cách thiết kế", project.style],
            ["Ngân sách dự kiến", `${project.budget} triệu VNĐ`],
          ];
          for (let pi = 0; pi < projectDetails.length; pi++) {
            const [label, value] = projectDetails[pi];
            const y = doc.y;
            doc.rect(M, y, CW, 22).fill(pi % 2 === 0 ? "#f7fafc" : "#ffffff");
            doc.fill("#000000").font(fnB).fontSize(10).text(label, M + 10, y + 5, { width: 200 });
            doc.font(fnR).text(String(value), M + 220, y + 5, { width: CW - 230 });
          }
          doc.moveDown(1.5);
          if (analysis?.aiAnalysis) {
            doc.font(fnB).fontSize(12).fill(DARK).text("PHÂN TÍCH AI");
            doc.moveDown(0.5);
            doc.font(fnR).fontSize(9.5).fill("#000000").text(String(analysis.aiAnalysis).substring(0, 4000));
          } else if (analysis) {
            doc.font(fnR).fontSize(9.5).text(JSON.stringify(analysis, null, 2).substring(0, 3000));
          }

          // ===================== SECTION 2: LAYOUT =====================
          sectionDivider(2, "BỐ TRÍ MẶT BẰNG", "Layout các tầng & phân chia chức năng");
          sectionContent("2. BỐ TRÍ MẶT BẰNG");
          if (layout?.floors) {
            for (const fl of layout.floors) {
              doc.font(fnB).fontSize(13).fill(ACCENT).text(`TẦNG ${fl.floor}`);
              doc.moveDown(0.3);
              doc.rect(M, doc.y, CW, 1).fill(ACCENT);
              doc.moveDown(0.4);
              let totalFloorArea = 0;
              for (const room of fl.rooms) {
                const roomArea = room.w * room.h;
                totalFloorArea += roomArea;
                const y = doc.y;
                doc.rect(M, y, CW, 20).fill("#f7fafc");
                doc.fill("#000000").font(fnR).fontSize(10);
                doc.text(`• ${room.name}`, M + 10, y + 4, { width: 200 });
                doc.text(`${room.w}m × ${room.h}m`, M + 220, y + 4, { width: 100 });
                doc.font(fnB).text(`${roomArea.toFixed(1)} m²`, M + 340, y + 4, { width: 80 });
                doc.y = y + 22;
              }
              doc.moveDown(0.3);
              doc.font(fnB).fontSize(10).fill(GREEN_TXT).text(`Tổng diện tích tầng ${fl.floor}: ${totalFloorArea.toFixed(1)} m²`);
              doc.fill("#000000");
              doc.moveDown(1);
              if (doc.y > H - 150) { sectionContent("2. BỐ TRÍ MẶT BẰNG (tiếp)"); }
            }
          } else if (layout) {
            doc.font(fnR).fontSize(10).text(JSON.stringify(layout, null, 2).substring(0, 3000));
          }

          // ===================== SECTION 3: CAD =====================
          sectionDivider(3, "BẢN VẼ KỸ THUẬT", "Bản vẽ CAD & thông số kỹ thuật");
          sectionContent("3. BẢN VẼ KỸ THUẬT");
          if (cad?.cadDescription) {
            doc.font(fnR).fontSize(9.5).text(cad.cadDescription.substring(0, 4000));
          }
          if (cad?.cadDrawings) {
            for (const drawing of cad.cadDrawings) {
              if (drawing.imageUrl) {
                addImageWithCaption(drawing.imageUrl, drawing.name || "Bản vẽ kỹ thuật");
              }
            }
          }

          // ===================== SECTION 4: FACADE =====================
          sectionDivider(4, "THIẾT KẾ MẶT TIỀN", "Kiến trúc ngoại thất & phối cảnh");
          sectionContent("4. THIẾT KẾ MẶT TIỀN");
          if (model3d?.designDescription) {
            doc.font(fnR).fontSize(9.5).text(model3d.designDescription.substring(0, 4000));
          }
          const facadeLabels = ["Mặt tiền ban ngày", "Mặt tiền ban đêm", "Góc nhìn 45°", "Phối cảnh tổng thể"];
          if (model3d?.facadeImages) {
            for (let i = 0; i < model3d.facadeImages.length; i++) {
              const label = facadeLabels[i] || `Phối cảnh mặt tiền ${i + 1}`;
              addFullPageImage(model3d.facadeImages[i], label);
            }
          }

          // ===================== SECTION 5: INTERIOR =====================
          sectionDivider(5, "THIẾT KẾ NỘI THẤT", "Nội thất từng phòng & vật liệu hoàn thiện");
          sectionContent("5. THIẾT KẾ NỘI THẤT");
          if (interior?.interiorDescription) {
            doc.font(fnR).fontSize(9.5).text(interior.interiorDescription.substring(0, 4000));
          }
          if (interior?.interiorImages) {
            for (const img of interior.interiorImages) {
              addFullPageImage(img.url, img.name || "Thiết kế nội thất");
            }
          }

          // ===================== SECTION 6: RENDERS =====================
          sectionDivider(6, "RENDER PHỐI CẢNH", "Hình ảnh 3D photorealistic chất lượng cao");
          if (renderResult?.renders) {
            for (const r of renderResult.renders) {
              addFullPageImage(r.url, r.name);
            }
          }

          // ===================== SECTION 7: COST ESTIMATE =====================
          sectionDivider(7, "DỰ TOÁN CHI PHÍ", "Chi phí xây dựng & nội thất dự kiến");
          sectionContent("7. DỰ TOÁN CHI PHÍ");

          doc.font(fnB).fontSize(13).fill(DARK).text("BẢNG DỰ TOÁN CHI PHÍ");
          doc.moveDown(0.5);

          const tableTop = doc.y;
          const colWidths = [30, 220, 100, 145];
          const tableHeaders = ["STT", "Hạng mục", "Đơn vị", "Thành tiền (triệu VNĐ)"];
          let tx = M;
          doc.rect(M, tableTop, CW, 28).fill(NAVY);
          for (let i = 0; i < tableHeaders.length; i++) {
            doc.fill("#ffffff").font(fnB).fontSize(9).text(tableHeaders[i], tx + 5, tableTop + 8, { width: colWidths[i] - 10 });
            tx += colWidths[i];
          }
          doc.y = tableTop + 28;

          const costRows = [
            ["1", "Chi phí xây dựng phần thô", `${totalArea} m²`, `${buildCost.toLocaleString("vi-VN")}`],
            ["2", "Chi phí hoàn thiện ngoại thất", `${totalArea} m²`, `${Math.round(totalArea * 1.5).toLocaleString("vi-VN")}`],
            ["3", "Chi phí thiết kế nội thất", `${totalArea} m²`, `${interiorCost.toLocaleString("vi-VN")}`],
            ["4", "Hệ thống điện - nước", "1 hệ thống", `${Math.round(totalArea * 0.8).toLocaleString("vi-VN")}`],
            ["5", "Cảnh quan sân vườn", `${area} m²`, `${Math.round(area * 0.5).toLocaleString("vi-VN")}`],
            ["6", "Chi phí thiết kế kiến trúc", "1 gói", `${Math.round(totalCost * 0.05).toLocaleString("vi-VN")}`],
            ["7", "Chi phí quản lý dự án", "1 gói", `${Math.round(totalCost * 0.03).toLocaleString("vi-VN")}`],
          ];

          for (let r = 0; r < costRows.length; r++) {
            const ry = doc.y;
            doc.rect(M, ry, CW, 24).fill(r % 2 === 0 ? "#f7fafc" : "#ffffff");
            tx = M;
            for (let c = 0; c < costRows[r].length; c++) {
              doc.fill("#000000").font(c === 0 ? fnB : fnR).fontSize(9).text(costRows[r][c], tx + 5, ry + 6, { width: colWidths[c] - 10 });
              tx += colWidths[c];
            }
            doc.y = ry + 24;
          }

          const grandTotal = totalCost + Math.round(totalArea * 1.5) + Math.round(totalArea * 0.8) + Math.round(area * 0.5) + Math.round(totalCost * 0.08);
          doc.moveDown(0.5);
          doc.rect(M, doc.y, CW, 40).fill(GREEN_BG);
          const gtY = doc.y;
          doc.fill(GREEN_TXT).font(fnB).fontSize(14).text(`TỔNG DỰ TOÁN: ${grandTotal.toLocaleString("vi-VN")} triệu VNĐ`, M + 15, gtY + 12, { width: CW - 30, align: "center" });
          doc.y = gtY + 50;
          doc.fill("#000000");

          doc.moveDown(1);
          doc.font(fnR).fontSize(9).fill("#718096");
          doc.text("Lưu ý:");
          doc.text("• Đây là ước tính sơ bộ dựa trên đơn giá trung bình khu vực Tây Nguyên.");
          doc.text("• Chi phí thực tế có thể thay đổi ±15% tùy theo vật liệu và nhà thầu thi công.");
          doc.text("• Chưa bao gồm chi phí giấy phép xây dựng và thuế.");
          doc.fill("#000000");

          // ===================== FINAL PAGE: CONTACT & COMMITMENT =====================
          doc.addPage();
          doc.rect(0, 0, W, H).fill(NAVY);
          doc.fill("#ffffff").font(fnB).fontSize(36).text("BMT DECOR", M, 120, { width: CW, align: "center" });
          doc.moveDown(0.5);
          doc.font(fnR).fontSize(14).text("Hệ thống AI Thiết kế Kiến trúc & Nội thất", { width: CW, align: "center" });
          doc.moveDown(1);
          doc.rect(W / 2 - 40, doc.y, 80, 3).fill(ACCENT);
          doc.moveDown(2);

          doc.font(fnB).fontSize(16).text("CAM KẾT CHẤT LƯỢNG", { width: CW, align: "center" });
          doc.moveDown(1);
          doc.font(fnR).fontSize(11);
          const commitments = [
            "✓  Thiết kế sáng tạo, phù hợp phong cách & ngân sách khách hàng",
            "✓  Tư vấn chuyên nghiệp từ đội ngũ kiến trúc sư giàu kinh nghiệm",
            "✓  Ứng dụng công nghệ AI tiên tiến trong thiết kế & trực quan hóa",
            "✓  Hỗ trợ giám sát thi công đảm bảo đúng thiết kế",
            "✓  Bảo hành thiết kế trong suốt quá trình xây dựng",
          ];
          for (const c of commitments) {
            doc.text(c, { width: CW, align: "center" });
            doc.moveDown(0.5);
          }

          doc.moveDown(2);
          doc.rect(W / 2 - 60, doc.y, 120, 1).fill("#4a5568");
          doc.moveDown(1.5);
          doc.font(fnB).fontSize(12).text("LIÊN HỆ", { width: CW, align: "center" });
          doc.moveDown(0.5);
          doc.font(fnR).fontSize(10).fill("#a0aec0");
          doc.text("Địa chỉ: 7/92, Thành Thái, Phường 14, Quận 10, TP.HCM", { width: CW, align: "center" });
          doc.text("Director: Võ Quốc Bảo", { width: CW, align: "center" });
          doc.text("Website: thicongtramsac.vn", { width: CW, align: "center" });
          doc.moveDown(3);
          doc.font(fnR).fontSize(9).fill("#718096").text("Cảm ơn quý khách đã tin tưởng sử dụng dịch vụ CÔNG TY TNHH TMDV BMT DECOR", { width: CW, align: "center" });
          doc.text(`© ${new Date().getFullYear()} BMT DECOR. All rights reserved.`, { width: CW, align: "center" });

          doc.end();
          await new Promise<void>((resolve) => writeStream.on("finish", resolve));

          pageCount = pdfKitPages;
          downloadUrl = `/api/projects/${id}/download-pdf`;
          try {
            const fileSizeBytes = fs.statSync(pdfPath).size;
            estimatedSize = fileSizeBytes > 1024 * 1024
              ? `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
              : `${Math.round(fileSizeBytes / 1024)} KB`;
          } catch {
            estimatedSize = `~${Math.max(pageCount * 0.5, 1).toFixed(0)} MB`;
          }

          for (const f of tmpFiles) {
            try { fs.unlinkSync(f); } catch {}
          }
        }

        result = {
          pageCount,
          downloadUrl,
          sections,
          estimatedSize,
          pdfSource,
          embeddedImages: embeddedImageCount || 0,
        };
      }

      const finalStatuses = { ...(project.stepStatuses as Record<string, string> || {}), [step]: "completed" };
      const updateData: Record<string, unknown> = { stepStatuses: finalStatuses };
      if (step === 2) {
        updateData.analysisResult = (result as { analysis: unknown }).analysis;
        updateData.layoutResult = (result as { layout: unknown }).layout;
      }
      if (step === 3) updateData.cadResult = result;
      if (step === 4) updateData.model3dResult = result;
      if (step === 5) updateData.interiorResult = result;
      if (step === 6) updateData.renderResult = result;
      if (step === 7) updateData.pdfEstimate = result;

      await storage.updateProject(id, updateData);
      console.log(`Step ${step} completed for project ${id}`);
    } catch (err) {
      console.error("Process step error:", err);
      try {
        const errStatuses = { ...(project.stepStatuses as Record<string, string> || {}), [step]: "error" };
        await storage.updateProject(id, { stepStatuses: errStatuses });
      } catch (dbErr) {
        console.error("Failed to save error status for step", step, "project", id, ":", dbErr);
      }
    }
  }

  app.post("/api/projects/:id/step/:step/approve", async (req, res) => {
    const id = parseInt(req.params.id);
    const step = parseInt(req.params.step);
    if (isNaN(id) || isNaN(step) || step < 1 || step > 7) return res.status(400).json({ message: "Invalid step" });
    const project = await storage.getProject(id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const currentStatus = ((project.stepStatuses as Record<string, string>) || {})[String(step)];

    const stepResultField: Record<number, string> = {
      1: "siteRequirements", 2: "analysisResult", 3: "cadResult",
      4: "model3dResult", 5: "interiorResult", 6: "renderResult", 7: "pdfEstimate",
    };
    const hasResult = !!(project as any)[stepResultField[step]];

    if (currentStatus !== "completed" && !(currentStatus === "processing" && hasResult)) {
      return res.status(400).json({ message: "Bước này chưa được xử lý xong" });
    }

    const statuses = { ...(project.stepStatuses as Record<string, string> || {}), [step]: "approved" };
    const nextStep = Math.min(step + 1, 7);
    const updated = await storage.updateProject(id, {
      stepStatuses: statuses,
      currentStep: nextStep,
      status: step === 7 ? "completed" : "active",
    });
    res.json(updated);
  });

  app.post("/api/projects/:id/step/:step/redo", async (req, res) => {
    const id = parseInt(req.params.id);
    const step = parseInt(req.params.step);
    if (isNaN(id) || isNaN(step) || step < 1 || step > 7) return res.status(400).json({ message: "Invalid step" });
    const project = await storage.getProject(id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const statuses = { ...(project.stepStatuses as Record<string, string> || {}), [step]: "pending" };
    const updated = await storage.updateProject(id, { stepStatuses: statuses });
    res.json(updated);
  });

  app.get("/api/projects/:id/download-pdf", async (req, res) => {
    res.setTimeout(120000);
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const area = project.landWidth * project.landLength;
      const totalArea = area * project.floors;
      const buildCost = Math.round(totalArea * 7);
      const interiorCost = Math.round(totalArea * 3.5);
      const totalCost = Math.round(totalArea * 10.5);

      const cad = project.cadResult as { cadDescription?: string; cadDrawings?: Array<{imageUrl?: string; name?: string}> } | null;
      const model3d = project.model3dResult as { facadeImages?: string[]; designDescription?: string } | null;
      const interior = project.interiorResult as { interiorDescription?: string; interiorImages?: Array<{url: string; name?: string}> } | null;
      const renderResult = project.renderResult as { renders?: Array<{name: string; url: string}> } | null;
      const analysis = project.analysisResult as Record<string, string> | null;
      const layout = project.layoutResult as { floors?: Array<{ floor: number; rooms: Array<{ name: string; w: number; h: number }> }> } | null;

      const fontRegular = path.join(process.cwd(), "server", "fonts", "Roboto-Regular.ttf");
      const fontBold = path.join(process.cwd(), "server", "fonts", "Roboto-Bold.ttf");
      const logoPath = path.join(process.cwd(), "attached_assets", "logo_nobg.png");
      const hasLogo = fs.existsSync(logoPath);

      const W = 595.28;
      const H = 841.89;
      const M = 40;
      const SB_W = 155;
      const CW = W - 2 * M;
      const NAVY = "#1a365d";
      const DARK = "#2d3748";
      const ACCENT = "#e8830c";
      const BORDER = "#333333";
      const LIGHT_BG = "#f7fafc";
      const GREEN_BG = "#f0fff4";
      const GREEN_TXT = "#276749";

      // Pre-compress all base64 images before PDF generation (60% quality JPEG)
      const allDlImgUrls: string[] = [
        ...(model3d?.facadeImages || []),
        ...(interior?.interiorImages?.map((i: {url: string}) => i.url) || []),
        ...(renderResult?.renders?.map((r: {url: string}) => r.url) || []),
        ...(cad?.cadDrawings?.map((d: {imageUrl?: string}) => d.imageUrl || "") || []),
      ].filter(Boolean);
      const dlCompressedCache = await preCompressImages(allDlImgUrls, 60);

      const doc = new PDFDocument({ size: "A4", margin: 0 });
      const tempFiles: string[] = [...dlCompressedCache.values()];

      if (fs.existsSync(fontRegular)) doc.registerFont("VN", fontRegular);
      if (fs.existsSync(fontBold)) doc.registerFont("VN-Bold", fontBold);
      const fnR = fs.existsSync(fontRegular) ? "VN" : "Helvetica";
      const fnB = fs.existsSync(fontBold) ? "VN-Bold" : "Helvetica-Bold";

      const resolveImg = (imgUrl: string): string | null => {
        if (!imgUrl) return null;
        if (dlCompressedCache.has(imgUrl)) return dlCompressedCache.get(imgUrl)!;
        if (imgUrl.startsWith("data:image/")) {
          const match = imgUrl.match(/^data:image\/\w+;base64,(.+)$/);
          if (match) {
            const tmpFile = path.join(GEN_DIR, `dl_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
            try {
              fs.writeFileSync(tmpFile, Buffer.from(match[1], "base64"));
              tempFiles.push(tmpFile);
              return tmpFile;
            } catch { return null; }
          }
          return null;
        }
        if (imgUrl.startsWith("/generated/")) {
          const f = path.join(GEN_DIR, path.basename(imgUrl));
          return fs.existsSync(f) ? f : null;
        }
        if (imgUrl.startsWith("/uploads/")) {
          const f = path.join(process.cwd(), "public", "uploads", path.basename(imgUrl));
          return fs.existsSync(f) ? f : null;
        }
        return null;
      };

      const drawTitleBlock = (drawingTitle: string, itemName: string, scale?: string) => {
        const sbX = W - SB_W;
        const sbY = 0;
        const sbH = H;
        const cellH = 18;
        const padL = 4;
        const labelFs = 6;
        const valFs = 7.5;

        doc.rect(sbX, sbY, SB_W, sbH).lineWidth(1.5).stroke(BORDER);

        let cy = sbY + 8;
        doc.font(fnR).fontSize(7).fill("#555").text("CHU DAU TU", sbX + padL, cy, { width: SB_W - 8 });
        cy += 12;
        doc.font(fnB).fontSize(8).fill("#000").text(project.clientName || "", sbX + padL, cy, { width: SB_W - 8 });
        cy += 20;

        doc.moveTo(sbX, cy).lineTo(W, cy).lineWidth(0.5).stroke(BORDER);
        cy += 5;
        doc.font(fnB).fontSize(8.5).fill(DARK).text("THAM DINH THIET KE", sbX + padL, cy, { width: SB_W - 8, align: "center" });
        cy += 22;
        doc.moveTo(sbX, cy).lineTo(W, cy).lineWidth(0.5).stroke(BORDER);

        cy += 4;
        const fieldW = (SB_W - 2) / 2;

        doc.font(fnR).fontSize(labelFs).fill("#555").text("T.T (No)", sbX + padL, cy);
        cy += 10;
        doc.font(fnR).fontSize(labelFs).fill("#555").text("NGAY LAP / HIEU CHINH", sbX + padL, cy);
        doc.text("SET-UP DATE / REVISION DATE", sbX + padL, cy + 8);
        cy += 22;
        doc.moveTo(sbX, cy).lineTo(W, cy).lineWidth(0.3).stroke("#999");

        cy += 4;
        doc.font(fnR).fontSize(labelFs).fill("#555").text("MUC DICH PHAT HANH", sbX + padL, cy);
        doc.text("ISSUED FOR", sbX + padL, cy + 8);
        cy += 20;

        const checks = [
          { label: "CO SO T.K", en: "CONCEPT DESIGN", checked: true },
          { label: "TRINH DUYET", en: "APPROVAL", checked: false },
          { label: "THI CONG", en: "CONSTRUCTION", checked: false },
          { label: "HIEU CHINH", en: "REVISION", checked: false },
        ];
        for (const chk of checks) {
          const boxSize = 7;
          doc.rect(sbX + padL, cy, boxSize, boxSize).lineWidth(0.5).stroke(BORDER);
          if (chk.checked) {
            doc.font(fnB).fontSize(7).fill("#000").text("X", sbX + padL + 1.2, cy + 0.5);
          }
          doc.font(fnR).fontSize(labelFs).fill("#555").text(chk.label, sbX + padL + boxSize + 3, cy);
          doc.text(chk.en, sbX + fieldW + padL, cy);
          cy += 14;
        }
        doc.moveTo(sbX, cy).lineTo(W, cy).lineWidth(0.5).stroke(BORDER);

        cy += 6;
        doc.font(fnB).fontSize(7).fill(DARK).text("DON VI THI CONG", sbX + padL, cy, { width: SB_W - 8, align: "center" });
        cy += 14;

        if (hasLogo) {
          try {
            doc.image(logoPath, sbX + (SB_W - 60) / 2, cy, { width: 60 });
          } catch {}
        }
        cy += 55;
        doc.font(fnB).fontSize(9).fill(ACCENT).text("BMT DECOR", sbX + padL, cy, { width: SB_W - 8, align: "center" });
        cy += 16;

        doc.moveTo(sbX, cy).lineTo(W, cy).lineWidth(0.3).stroke("#999");

        const infoFields = [
          { label: "DIRECTOR", value: "VO QUOC BAO" },
          { label: "THIET KE - DESIGNED BY", value: "" },
          { label: "VE - DRAWN BY", value: "" },
          { label: "CONG TRINH - PROJECT", value: project.title },
          { label: "DIA DIEM - LOCATION", value: project.clientName ? "" : "" },
          { label: "HANG MUC - ITEM", value: itemName },
          { label: "TEN BAN VE - DRAWING TITLE", value: drawingTitle },
        ];

        for (const field of infoFields) {
          cy += 3;
          doc.font(fnR).fontSize(labelFs).fill("#555").text(field.label, sbX + padL, cy, { width: SB_W - 8 });
          cy += 9;
          if (field.value) {
            doc.font(fnB).fontSize(valFs).fill("#000").text(field.value, sbX + padL, cy, { width: SB_W - 8 });
          }
          cy += 11;
          doc.moveTo(sbX, cy).lineTo(W, cy).lineWidth(0.3).stroke("#999");
        }

        cy += 5;
        const scaleBoxW = SB_W / 3;
        doc.font(fnR).fontSize(labelFs).fill("#555").text("TL", sbX + padL, cy);
        doc.font(fnB).fontSize(valFs).fill("#000").text(scale || "", sbX + scaleBoxW + padL, cy);
        doc.text("TONG SO MAT", sbX + scaleBoxW * 2 + padL, cy);
        cy += 10;
        doc.font(fnR).fontSize(labelFs).fill("#555").text("SCALE", sbX + padL, cy);
        doc.font(fnR).text(scale || "1/50", sbX + scaleBoxW + padL, cy);
      };

      const drawPageWithTitleBlock = (imgUrl: string | null, drawingTitle: string, itemName: string, scale?: string) => {
        doc.addPage({ size: "A4", margin: 0 });
        const contentW = W - SB_W;
        const contentH = H;

        if (imgUrl) {
          const p = resolveImg(imgUrl);
          if (p) {
            try {
              doc.image(p, 0, 0, { width: contentW, height: contentH });
            } catch (e) { console.error("PDF img error:", e); }
          }
        }

        doc.rect(contentW, 0, SB_W, H).fill("#ffffff");
        drawTitleBlock(drawingTitle, itemName, scale);
      };

      const divider = (num: number, title: string, sub?: string) => {
        doc.addPage({ size: "A4", margin: 0 });
        doc.rect(0, 0, W, H).fill(NAVY);
        doc.fill("#ffffff").font(fnB).fontSize(60).text(`0${num}`, M, H / 2 - 100, { width: W - 2 * M, align: "center" });
        doc.fontSize(28).text(title, M, H / 2 - 20, { width: W - 2 * M, align: "center" });
        if (sub) { doc.moveDown(0.5); doc.font(fnR).fontSize(14).text(sub, { width: W - 2 * M, align: "center" }); }
        doc.rect(W / 2 - 40, H / 2 + 60, 80, 3).fill(ACCENT);
      };

      const sectHead = (title: string) => {
        doc.addPage({ size: "A4", margin: 0 });
        doc.rect(0, 0, W, 55).fill(DARK);
        doc.fill("#ffffff").font(fnB).fontSize(15).text(title, M, 18, { width: W - 2 * M });
        doc.fill("#000000").font(fnR).fontSize(10).text("", M, 70);
      };

      // === COVER PAGE ===
      doc.rect(0, 0, W, H).fill("#ffffff");
      doc.rect(0, 0, W, 5).fill(ACCENT);
      doc.rect(0, H - 5, W, 5).fill(ACCENT);
      doc.rect(0, 0, 5, H).fill(ACCENT);
      doc.rect(W - 5, 0, 5, H).fill(ACCENT);

      const coverLeftW = W * 0.5;
      const coverRightW = W * 0.5;

      if (hasLogo) {
        try { doc.image(logoPath, 30, 35, { width: 65 }); } catch {}
      }
      doc.font(fnB).fontSize(11).fill(DARK).text("CONG TY TNHH TMDV", 100, 40, { width: coverLeftW - 30 });
      doc.font(fnB).fontSize(16).fill(ACCENT).text("BMT DECOR", 100, 55, { width: coverLeftW - 30 });
      doc.font(fnR).fontSize(8).fill("#666").text("Dia chi: 7/92, Thanh Thai, P.14, Q.10, TP.HCM", 100, 75, { width: coverLeftW - 30 });

      doc.moveTo(25, 100).lineTo(W - 25, 100).lineWidth(1).stroke(ACCENT);

      doc.font(fnB).fontSize(28).fill(ACCENT).text("PHUONG AN", 40, 160, { width: coverLeftW - 20 });
      doc.font(fnB).fontSize(28).fill(ACCENT).text("THIET KE", 40, 195, { width: coverLeftW - 20 });

      doc.moveDown(2);
      const infoY = 280;
      doc.font(fnB).fontSize(12).fill(DARK).text("KHACH HANG:", 40, infoY, { width: coverLeftW - 20 });
      doc.font(fnR).fontSize(12).fill("#000").text(project.clientName || "N/A", 140, infoY, { width: coverLeftW - 60 });
      doc.font(fnB).fontSize(12).fill(DARK).text("DU AN:", 40, infoY + 25, { width: coverLeftW - 20 });
      doc.font(fnR).fontSize(12).fill("#000").text(project.title, 140, infoY + 25, { width: coverLeftW - 60 });
      doc.font(fnB).fontSize(12).fill(DARK).text("PHONG CACH:", 40, infoY + 50, { width: coverLeftW - 20 });
      doc.font(fnR).fontSize(12).fill("#000").text(project.style, 140, infoY + 50, { width: coverLeftW - 60 });
      doc.font(fnB).fontSize(12).fill(DARK).text("KICH THUOC:", 40, infoY + 75, { width: coverLeftW - 20 });
      doc.font(fnR).fontSize(12).fill("#000").text(`${project.landWidth}m x ${project.landLength}m (${area} m2)`, 140, infoY + 75, { width: coverLeftW - 60 });
      doc.font(fnB).fontSize(12).fill(DARK).text("SO TANG:", 40, infoY + 100, { width: coverLeftW - 20 });
      doc.font(fnR).fontSize(12).fill("#000").text(`${project.floors} tang - ${project.bedrooms} phong ngu`, 140, infoY + 100, { width: coverLeftW - 60 });
      doc.font(fnB).fontSize(12).fill(DARK).text("NGAN SACH:", 40, infoY + 125, { width: coverLeftW - 20 });
      doc.font(fnR).fontSize(12).fill("#000").text(`${project.budget} trieu VND`, 140, infoY + 125, { width: coverLeftW - 60 });

      const coverImgUrl = model3d?.facadeImages?.[0] || renderResult?.renders?.[0]?.url;
      if (coverImgUrl) {
        const cp = resolveImg(coverImgUrl);
        if (cp) {
          try {
            const imgX = coverLeftW + 10;
            const imgY = 110;
            const imgW = coverRightW - 40;
            const imgH = H - 160;
            doc.image(cp, imgX, imgY, { fit: [imgW, imgH], align: "center", valign: "center" });
          } catch {}
        }
      }

      doc.font(fnR).fontSize(8).fill("#999").text(`Ngay lap: ${new Date().toLocaleDateString("vi-VN")}`, 40, H - 30, { width: W - 80, align: "center" });

      // === COVER IMAGE FULL PAGE ===
      if (coverImgUrl) {
        const cp = resolveImg(coverImgUrl);
        if (cp) {
          try {
            doc.addPage({ size: "A4", margin: 0 });
            doc.image(cp, 0, 0, { width: W, height: H - 70 });
            doc.save(); doc.opacity(0.85); doc.rect(0, H - 70, W, 70).fill(NAVY); doc.opacity(1); doc.restore();
            doc.fill("#ffffff").font(fnB).fontSize(13).text("PHOI CANH TONG THE", M, H - 55, { width: W - 2 * M, align: "center" });
            doc.font(fnR).fontSize(9).text(project.title, M, H - 35, { width: W - 2 * M, align: "center" });
          } catch {}
        }
      }

      // === TOC ===
      doc.addPage({ size: "A4", margin: 0 });
      doc.rect(0, 0, W, 55).fill(NAVY);
      doc.fill("#ffffff").font(fnB).fontSize(20).text("MUC LUC", M, 16, { width: W - 2 * M, align: "center" });
      doc.fill("#000000").font(fnR).fontSize(12).text("", M, 80);
      for (const item of [
        { num: "01", title: "PHAN TICH HIEN TRANG", sub: "Danh gia khu dat, phong thuy" },
        { num: "02", title: "BO TRI MAT BANG", sub: "Layout cac tang, phan chia phong" },
        { num: "03", title: "BAN VE KY THUAT", sub: "Ban ve CAD, ket cau" },
        { num: "04", title: "THIET KE MAT TIEN", sub: "Kien truc ngoai that, phoi canh" },
        { num: "05", title: "THIET KE NOI THAT", sub: "Noi that tung phong, vat lieu" },
        { num: "06", title: "RENDER PHOI CANH", sub: "Hinh anh 3D chat luong cao" },
        { num: "07", title: "DU TOAN CHI PHI", sub: "Chi phi xay dung, noi that" },
      ]) {
        doc.moveDown(0.8);
        doc.font(fnB).fontSize(18).fill(ACCENT).text(item.num, M, doc.y, { continued: true });
        doc.fill(DARK).fontSize(14).text(`   ${item.title}`);
        doc.font(fnR).fontSize(10).fill("#718096").text(`      ${item.sub}`);
        doc.fill("#000000");
        doc.moveDown(0.3);
        doc.rect(M, doc.y, W - 2 * M, 0.5).fill("#e2e8f0");
      }

      // === S1: Analysis ===
      divider(1, "PHAN TICH HIEN TRANG", "Danh gia khu dat & yeu cau thiet ke");
      sectHead("1. PHAN TICH HIEN TRANG");
      doc.font(fnB).fontSize(12).fill(DARK).text("THONG TIN DU AN", M, doc.y);
      doc.moveDown(0.5);
      const pd = [
        ["Ten du an", project.title], ["Khach hang", project.clientName || "N/A"],
        ["Kich thuoc dat", `${project.landWidth}m x ${project.landLength}m = ${area} m2`],
        ["So tang", `${project.floors} tang`], ["Phong ngu", `${project.bedrooms} phong`],
        ["Phong cach", project.style], ["Ngan sach", `${project.budget} trieu VND`],
      ];
      for (let i = 0; i < pd.length; i++) {
        const y = doc.y;
        doc.rect(M, y, W - 2 * M, 22).fill(i % 2 === 0 ? LIGHT_BG : "#ffffff");
        doc.fill("#000000").font(fnB).fontSize(10).text(pd[i][0], M + 10, y + 5, { width: 200 });
        doc.font(fnR).text(String(pd[i][1]), M + 220, y + 5, { width: W - 2 * M - 230 });
      }
      doc.moveDown(1.5);
      if (analysis?.aiAnalysis) {
        doc.font(fnB).fontSize(12).fill(DARK).text("PHAN TICH AI", M, doc.y);
        doc.moveDown(0.5);
        doc.font(fnR).fontSize(9.5).fill("#000000").text(String(analysis.aiAnalysis).substring(0, 4000), M, doc.y, { width: W - 2 * M });
      }

      // === S2: Layout ===
      divider(2, "BO TRI MAT BANG", "Layout cac tang & phan chia chuc nang");
      sectHead("2. BO TRI MAT BANG");
      if (layout?.floors) {
        for (const flr of layout.floors) {
          doc.font(fnB).fontSize(13).fill(ACCENT).text(`TANG ${flr.floor}`, M, doc.y);
          doc.moveDown(0.3);
          doc.rect(M, doc.y, W - 2 * M, 1).fill(ACCENT);
          doc.moveDown(0.4);
          let flArea = 0;
          for (const room of flr.rooms) {
            const ra = room.w * room.h; flArea += ra;
            const y = doc.y;
            doc.rect(M, y, W - 2 * M, 20).fill(LIGHT_BG);
            doc.fill("#000000").font(fnR).fontSize(10);
            doc.text(`  ${room.name}`, M + 10, y + 4, { width: 200 });
            doc.text(`${room.w}m x ${room.h}m`, M + 220, y + 4, { width: 100 });
            doc.font(fnB).text(`${ra.toFixed(1)} m2`, M + 340, y + 4, { width: 80 });
            doc.y = y + 22;
          }
          doc.moveDown(0.3);
          doc.font(fnB).fontSize(10).fill(GREEN_TXT).text(`Tong tang ${flr.floor}: ${flArea.toFixed(1)} m2`, M, doc.y);
          doc.fill("#000000"); doc.moveDown(1);
          if (doc.y > H - 150) sectHead("2. BO TRI MAT BANG (tiep)");
        }
      }

      // === S3: CAD ===
      divider(3, "BAN VE KY THUAT", "Ban ve CAD & thong so ky thuat");
      sectHead("3. BAN VE KY THUAT");
      if (cad?.cadDescription) doc.font(fnR).fontSize(9.5).text(cad.cadDescription.substring(0, 4000), M, doc.y, { width: W - 2 * M });
      if (cad?.cadDrawings) {
        for (const d of cad.cadDrawings) {
          if (d.imageUrl) drawPageWithTitleBlock(d.imageUrl, d.name || "Ban ve ky thuat", "BAN VE CAD", "1/100");
        }
      }

      // === S4: Facade with title block ===
      divider(4, "THIET KE MAT TIEN", "Kien truc ngoai that & phoi canh");
      sectHead("4. THIET KE MAT TIEN");
      if (model3d?.designDescription) doc.font(fnR).fontSize(9.5).text(model3d.designDescription.substring(0, 4000), M, doc.y, { width: W - 2 * M });
      const facadeLabels = ["Mat tien ban ngay", "Mat tien ban dem", "Goc nhin 45 do", "Phoi canh tong the"];
      if (model3d?.facadeImages) {
        for (let i = 0; i < model3d.facadeImages.length; i++) {
          drawPageWithTitleBlock(model3d.facadeImages[i], facadeLabels[i] || `Phoi canh ${i + 1}`, "PHOI CANH MAT TIEN", "");
        }
      }

      // === S5: Interior with title block ===
      divider(5, "THIET KE NOI THAT", "Noi that tung phong & vat lieu");
      sectHead("5. THIET KE NOI THAT");
      if (interior?.interiorDescription) doc.font(fnR).fontSize(9.5).text(interior.interiorDescription.substring(0, 4000), M, doc.y, { width: W - 2 * M });
      if (interior?.interiorImages) {
        for (const img of interior.interiorImages) {
          drawPageWithTitleBlock(img.url, img.name || "Noi that", "THIET KE NOI THAT", "");
        }
      }

      // === S6: Renders with title block ===
      divider(6, "RENDER PHOI CANH", "Hinh anh 3D photorealistic chat luong cao");
      if (renderResult?.renders) {
        for (const r of renderResult.renders) {
          drawPageWithTitleBlock(r.url, r.name, "RENDER 3D", "");
        }
      }

      // === S7: Cost ===
      divider(7, "DU TOAN CHI PHI", "Chi phi xay dung & noi that du kien");
      sectHead("7. DU TOAN CHI PHI");
      doc.font(fnB).fontSize(13).fill(DARK).text("BANG DU TOAN CHI PHI", M, doc.y);
      doc.moveDown(0.5);
      const tTop = doc.y;
      const cw = [30, 220, 100, 145];
      const th = ["STT", "Hang muc", "Don vi", "Thanh tien (trieu VND)"];
      let tx = M;
      doc.rect(M, tTop, W - 2 * M, 28).fill(NAVY);
      for (let i = 0; i < th.length; i++) {
        doc.fill("#ffffff").font(fnB).fontSize(9).text(th[i], tx + 5, tTop + 8, { width: cw[i] - 10 });
        tx += cw[i];
      }
      doc.y = tTop + 28;
      const rows = [
        ["1", "Chi phi xay dung phan tho", `${totalArea} m2`, `${buildCost.toLocaleString("vi-VN")}`],
        ["2", "Hoan thien ngoai that", `${totalArea} m2`, `${Math.round(totalArea * 1.5).toLocaleString("vi-VN")}`],
        ["3", "Thiet ke noi that", `${totalArea} m2`, `${interiorCost.toLocaleString("vi-VN")}`],
        ["4", "He thong dien - nuoc", "1 he thong", `${Math.round(totalArea * 0.8).toLocaleString("vi-VN")}`],
        ["5", "Canh quan san vuon", `${area} m2`, `${Math.round(area * 0.5).toLocaleString("vi-VN")}`],
        ["6", "Thiet ke kien truc", "1 goi", `${Math.round(totalCost * 0.05).toLocaleString("vi-VN")}`],
        ["7", "Quan ly du an", "1 goi", `${Math.round(totalCost * 0.03).toLocaleString("vi-VN")}`],
      ];
      for (let r = 0; r < rows.length; r++) {
        const ry = doc.y;
        doc.rect(M, ry, W - 2 * M, 24).fill(r % 2 === 0 ? LIGHT_BG : "#ffffff");
        tx = M;
        for (let c = 0; c < rows[r].length; c++) {
          doc.fill("#000000").font(c === 0 ? fnB : fnR).fontSize(9).text(rows[r][c], tx + 5, ry + 6, { width: cw[c] - 10 });
          tx += cw[c];
        }
        doc.y = ry + 24;
      }
      const gt = totalCost + Math.round(totalArea * 1.5) + Math.round(totalArea * 0.8) + Math.round(area * 0.5) + Math.round(totalCost * 0.08);
      doc.moveDown(0.5);
      doc.rect(M, doc.y, W - 2 * M, 40).fill(GREEN_BG);
      const gty = doc.y;
      doc.fill(GREEN_TXT).font(fnB).fontSize(14).text(`TONG DU TOAN: ${gt.toLocaleString("vi-VN")} trieu VND`, M + 15, gty + 12, { width: W - 2 * M - 30, align: "center" });
      doc.y = gty + 50;
      doc.fill("#000000");
      doc.moveDown(1);
      doc.font(fnR).fontSize(9).fill("#718096");
      doc.text("Luu y: Day la uoc tinh so bo. Chi phi thuc te co the thay doi +-15%.", M, doc.y, { width: W - 2 * M });

      // === FINAL PAGE ===
      doc.addPage({ size: "A4", margin: 0 });
      doc.rect(0, 0, W, H).fill(NAVY);
      if (hasLogo) {
        try { doc.image(logoPath, (W - 80) / 2, 80, { width: 80 }); } catch {}
      }
      doc.fill("#ffffff").font(fnB).fontSize(36).text("BMT DECOR", M, 175, { width: W - 2 * M, align: "center" });
      doc.moveDown(0.5);
      doc.font(fnR).fontSize(14).text("CONG TY TNHH TMDV BMT DECOR", { width: W - 2 * M, align: "center" });
      doc.moveDown(1);
      doc.rect(W / 2 - 40, doc.y, 80, 3).fill(ACCENT);
      doc.moveDown(2);
      doc.font(fnB).fontSize(16).text("CAM KET CHAT LUONG", { width: W - 2 * M, align: "center" });
      doc.moveDown(1);
      doc.font(fnR).fontSize(11);
      for (const c of [
        "  Thiet ke sang tao, phu hop phong cach & ngan sach",
        "  Tu van chuyen nghiep tu doi ngu kien truc su",
        "  Ung dung cong nghe AI tien tien",
        "  Ho tro giam sat thi cong",
        "  Bao hanh thiet ke trong suot qua trinh xay dung",
      ]) {
        doc.text(c, { width: W - 2 * M, align: "center" }); doc.moveDown(0.5);
      }
      doc.moveDown(1);
      doc.font(fnB).fontSize(12).text("LIEN HE", { width: W - 2 * M, align: "center" });
      doc.moveDown(0.5);
      doc.font(fnR).fontSize(10).fill("#a0aec0");
      doc.text("Dia chi: 7/92, Thanh Thai, Phuong 14, Quan 10, TP.HCM", { width: W - 2 * M, align: "center" });
      doc.text("Director: Vo Quoc Bao", { width: W - 2 * M, align: "center" });
      doc.text("Website: thicongtramsac.vn", { width: W - 2 * M, align: "center" });
      doc.moveDown(2);
      doc.font(fnR).fontSize(9).fill("#718096").text("Cam on quy khach da tin tuong su dung dich vu CONG TY TNHH TMDV BMT DECOR", { width: W - 2 * M, align: "center" });
      doc.text(`${new Date().getFullYear()} BMT DECOR. All rights reserved.`, { width: W - 2 * M, align: "center" });

      const safeName = project.title.replace(/[^a-zA-Z0-9_ ]/g, "").replace(/\s+/g, "_") || `project_${id}`;
      const encodedName = encodeURIComponent(`BMT_Decor_${project.title}.pdf`);
      res.setHeader("Content-Type", "application/pdf");
      if (req.query.download === "1") {
        res.setHeader("Content-Disposition", `attachment; filename="BMT_Decor_${safeName}.pdf"; filename*=UTF-8''${encodedName}`);
      } else {
        res.setHeader("Content-Disposition", `inline; filename="BMT_Decor_${safeName}.pdf"; filename*=UTF-8''${encodedName}`);
      }
      doc.pipe(res);
      doc.end();

      res.on("finish", () => {
        for (const f of tempFiles) {
          try { fs.unlinkSync(f); } catch {}
        }
      });
    } catch (err) {
      console.error("PDF download error:", err);
      res.status(500).json({ message: "PDF generation failed" });
    }
  });

  app.post("/api/projects/:id/send-email", async (req, res) => {
    res.setTimeout(120000);
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });
      const { email } = req.body;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Email không hợp lệ" });
      }
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.get("host") || "thicongtramsac.vn";
      const pdfApiUrl = `${protocol}://${host}/api/projects/${id}/download-pdf`;

      const pdfResp = await fetch(pdfApiUrl);
      if (!pdfResp.ok) {
        return res.status(500).json({ message: "Không thể tạo PDF" });
      }
      const pdfBuffer = Buffer.from(await pdfResp.arrayBuffer());

      // Save PDF to public/generated/ and build public download link
      const pdfRelPath = await savePdfToGenerated(id, pdfBuffer, project.title);
      const publicPdfUrl = `https://thicongtramsac.vn${pdfRelPath}`;

      const result = await sendPdfEmail(email, project.title, project.clientName, publicPdfUrl);
      res.json(result);
    } catch (err) {
      console.error("Send email error:", err);
      res.status(500).json({ success: false, message: "Gửi email thất bại" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { projectId, message, step, enableSearch } = req.body;
      if (!message) return res.status(400).json({ message: "Message required" });

      let project = null;
      if (projectId) {
        project = await storage.getProject(projectId);
      }

      let searchContext = "";
      let searchResults: SerpResult[] = [];
      const shouldSearch = enableSearch !== false && SERPAPI_KEY && detectSearchIntent(message);

      if (shouldSearch) {
        const searchQuery = buildSearchQuery(message, project);
        searchResults = await serpSearch(searchQuery, { num: 5 });
        if (searchResults.length > 0) {
          searchContext = `\n\nKết quả tìm kiếm tham khảo từ internet:\n${formatSearchResults(searchResults)}`;
        }
      }

      let customInstructions = "";
      let knowledgeContext = "";
      try {
        const settings = await storage.getAiSettings();
        if (settings?.instructions) {
          customInstructions = `\n\nHướng dẫn tùy chỉnh từ quản trị viên:\n${settings.instructions}`;
        }
        const kFiles = await storage.getKnowledgeFiles();
        if (kFiles.length > 0) {
          const MAX_KNOWLEDGE_CHARS = 8000;
          let totalChars = 0;
          const snippets: string[] = [];
          for (const f of kFiles.slice(0, 5)) {
            const snippet = f.content.slice(0, 2000);
            if (totalChars + snippet.length > MAX_KNOWLEDGE_CHARS) break;
            snippets.push(`--- ${f.originalName} ---\n${snippet}`);
            totalChars += snippet.length;
          }
          if (snippets.length > 0) {
            knowledgeContext = `\n\nTri thức tham khảo:\n${snippets.join("\n\n")}`;
          }
        }
        const driveKnowledge = await getDriveKnowledge();
        if (driveKnowledge) {
          knowledgeContext += driveKnowledge;
        }
      } catch (e) {
        console.error("Failed to load AI settings/knowledge:", e);
      }

      const systemPrompt = `Bạn là trợ lý AI thiết kế kiến trúc & nội thất của BMT Decor (CÔNG TY TNHH TMDV BMT DECOR). Bạn là chuyên gia về:
- Thiết kế kiến trúc nhà ở Việt Nam
- Phong thủy và bố trí không gian
- Vật liệu xây dựng và nội thất
- Dự toán chi phí xây dựng
${customInstructions}
${project ? `${buildProjectContext(project as unknown as Record<string, unknown>)}
- Bước hiện tại: ${step || project.currentStep}/7 - ${STEP_NAMES[step || project.currentStep]}` : ""}
${searchContext}
${knowledgeContext}

QUAN TRỌNG - Gửi email PDF:
Khi khách hàng cung cấp email và yêu cầu gửi hồ sơ PDF, bạn PHẢI bao gồm tag đặc biệt trong phản hồi: [SEND_EMAIL:địa_chỉ_email@example.com]
Ví dụ: Nếu khách nói "gửi cho tôi qua email abc@gmail.com", bạn phản hồi kèm tag [SEND_EMAIL:abc@gmail.com] ở cuối tin nhắn.
Phản hồi nên xác nhận rằng hệ thống đang gửi email, thông tin dự án, và thời gian dự kiến (trong vòng vài phút).

Trả lời ngắn gọn, chuyên nghiệp, bằng tiếng Việt. Đưa ra gợi ý cụ thể và thực tế.
${searchContext ? "Nếu có kết quả tìm kiếm phía trên, hãy tham khảo và trích dẫn nguồn khi phù hợp." : ""}`;

      const chatHistory = (project?.chatHistory as Array<{role: string; content: string}>) || [];
      const recentHistory = chatHistory.slice(-10).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const reply = await aiChat([
        { role: "system", content: systemPrompt },
        ...recentHistory,
        { role: "user", content: message },
      ]);

      let emailSent = false;
      let emailResult: { success: boolean; message: string } | null = null;
      const emailMatch = reply.match(/\[SEND_EMAIL:([^\]]+)\]/);
      if (emailMatch && project) {
        const recipientEmail = emailMatch[1].trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
          emailResult = { success: false, message: "Email không hợp lệ" };
        } else {
          try {
            const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || req.get("host") || "localhost:5000";
            const protocol = domain.includes("localhost") ? "http" : "https";
            const pdfApiUrl = `${protocol}://${domain}/api/projects/${project.id}/download-pdf`;
            const pdfResp = await fetch(pdfApiUrl);
            if (pdfResp.ok) {
              const pdfBuffer = Buffer.from(await pdfResp.arrayBuffer());
              const pdfRelPath = await savePdfToGenerated(project.id, pdfBuffer, project.title);
              const publicPdfUrl = `https://thicongtramsac.vn${pdfRelPath}`;
              emailResult = await sendPdfEmail(recipientEmail, project.title, project.clientName, publicPdfUrl);
              emailSent = emailResult.success;
            } else {
              emailResult = { success: false, message: "Không thể tạo PDF để gửi email" };
            }
          } catch (emailErr) {
            console.error("Auto email send error:", emailErr);
            emailResult = { success: false, message: "Gửi email thất bại. Vui lòng thử lại." };
          }
        }
      }

      const cleanReply = reply.replace(/\[SEND_EMAIL:[^\]]+\]/g, "").trim();

      if (project) {
        const newHistory = [...chatHistory,
          { role: "user", content: message, timestamp: new Date().toISOString() },
          { role: "assistant", content: cleanReply, timestamp: new Date().toISOString() },
        ];
        await storage.updateProject(project.id, { chatHistory: newHistory });
      }

      res.json({
        reply: cleanReply,
        searchResults: searchResults.length > 0 ? searchResults : undefined,
        emailSent,
        emailResult: emailResult || undefined,
      });
    } catch (err) {
      console.error("Chat error:", err);
      res.status(500).json({ message: "Chat failed" });
    }
  });

  app.post("/api/generate-video", async (req, res) => {
    try {
      const { projectId, imageUrl, prompt, model } = req.body;
      if (!imageUrl || !prompt) {
        return res.status(400).json({ message: "imageUrl and prompt required" });
      }

      let fullImageUrl = imageUrl;
      if (imageUrl.startsWith("/generated/")) {
        const domain = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "";
        const host = domain ? `https://${domain}` : `http://localhost:${process.env.PORT || 5000}`;
        fullImageUrl = `${host}${imageUrl}`;
      }

      const selectedModel = model || "minimax-image-to-video";
      const job = await artificialStudioGenerate(selectedModel, {
        prompt,
        image_url: fullImageUrl,
      });

      if (!job) {
        return res.status(500).json({ message: "Video generation failed to start" });
      }

      res.json({ jobId: job._id, status: job.status, model: selectedModel });
    } catch (err) {
      console.error("Video generation error:", err);
      res.status(500).json({ message: "Video generation failed" });
    }
  });

  app.get("/api/generate-video/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      if (!ARTIFICIAL_STUDIO_KEY) {
        return res.status(500).json({ message: "Artificial Studio API not configured" });
      }
      const resp = await fetch(`https://api.artificialstudio.ai/api/generate/${jobId}`, {
        headers: { Authorization: ARTIFICIAL_STUDIO_KEY },
      });
      if (!resp.ok) {
        return res.status(resp.status).json({ message: "Failed to check status" });
      }
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      console.error("Video status error:", err);
      res.status(500).json({ message: "Status check failed" });
    }
  });

  app.post("/api/search", async (req, res) => {
    try {
      const { query, type } = req.body;
      if (!query) return res.status(400).json({ message: "Query required" });
      const results = await serpSearch(query, { num: 8, searchType: type || "web" });
      res.json({ results, query });
    } catch (err) {
      console.error("Search error:", err);
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/step-prompt/:step", (req, res) => {
    const step = parseInt(req.params.step);
    if (isNaN(step) || step < 1 || step > 7) {
      return res.status(400).json({ message: "Invalid step" });
    }
    res.json({ prompt: STEP_PROMPTS[step], stepName: STEP_NAMES[step] });
  });

  app.post("/api/settings/verify-password", (req, res) => {
    const { password } = req.body;
    const correctPassword = process.env.SETTINGS_PASSWORD;
    if (!correctPassword) {
      return res.status(500).json({ success: false, message: "Mật khẩu chưa được cấu hình trên hệ thống" });
    }
    if (password === correctPassword) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: "Mật khẩu không đúng" });
    }
  });

  app.get("/api/settings/ai", async (_req, res) => {
    try {
      const settings = await storage.getAiSettings();
      res.json(settings || { instructions: "" });
    } catch (err) {
      console.error("Get AI settings error:", err);
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  app.put("/api/settings/ai", async (req, res) => {
    try {
      const { instructions } = req.body;
      if (typeof instructions !== "string") {
        return res.status(400).json({ message: "instructions must be a string" });
      }
      const settings = await storage.upsertAiSettings(instructions);
      res.json(settings);
    } catch (err) {
      console.error("Update AI settings error:", err);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.get("/api/knowledge-files", async (_req, res) => {
    try {
      const files = await storage.getKnowledgeFiles();
      res.json(files.map(f => ({
        id: f.id,
        name: f.name,
        originalName: f.originalName,
        fileType: f.fileType,
        fileSize: f.fileSize,
        createdAt: f.createdAt,
      })));
    } catch (err) {
      console.error("Get knowledge files error:", err);
      res.status(500).json({ message: "Failed to get files" });
    }
  });

  app.get("/api/drive-files", async (_req, res) => {
    try {
      const files = await listDriveFiles();
      res.json(files);
    } catch (err) {
      console.error("Drive files error:", err);
      res.status(500).json({ message: "Failed to list Drive files" });
    }
  });

  app.post("/api/drive-cache/clear", (_req, res) => {
    clearDriveCache();
    res.json({ success: true });
  });

  app.post("/api/drive-ocr/process", async (_req, res) => {
    try {
      const progress = await processAllDriveFiles();
      res.json({ message: "OCR processing started", ...progress });
    } catch (err) {
      console.error("OCR process error:", err);
      res.status(500).json({ message: "OCR processing failed" });
    }
  });

  app.get("/api/drive-ocr/progress", (_req, res) => {
    const progress = getOcrProgress();
    if (!progress) {
      return res.json({ total: 0, processed: 0, current: "", results: [], done: true, notStarted: true });
    }
    res.json(progress);
  });

  app.get("/api/drive-folders", async (_req, res) => {
    try {
      const folders = await storage.getDriveFolders();
      res.json(folders);
    } catch (err) {
      console.error("Get drive folders error:", err);
      res.status(500).json({ message: "Failed to get folders" });
    }
  });

  app.post("/api/drive-folders", async (req, res) => {
    try {
      const { name, folderId } = req.body;
      if (!name || !folderId) {
        return res.status(400).json({ message: "Name and folderId required" });
      }
      const folder = await storage.createDriveFolder({ name, folderId });
      clearDriveCache();
      res.json(folder);
    } catch (err) {
      console.error("Create drive folder error:", err);
      res.status(500).json({ message: "Failed to create folder" });
    }
  });

  app.delete("/api/drive-folders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid folder ID" });
      await storage.deleteDriveFolder(id);
      clearDriveCache();
      res.json({ success: true });
    } catch (err) {
      console.error("Delete drive folder error:", err);
      res.status(500).json({ message: "Failed to delete folder" });
    }
  });

  const knowledgeUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [".txt", ".md", ".csv", ".json"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowed.includes(ext)) {
        return cb(new Error("Chỉ hỗ trợ file .txt, .md, .csv, .json"));
      }
      cb(null, true);
    },
  });

  app.post("/api/knowledge-files", knowledgeUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const content = req.file.buffer.toString("utf-8");
      const ext = path.extname(req.file.originalname).toLowerCase();
      const fileType = ext === ".json" ? "json" : ext === ".csv" ? "csv" : ext === ".md" ? "markdown" : "text";
      const name = path.basename(req.file.originalname, ext);

      const file = await storage.createKnowledgeFile({
        name,
        originalName: req.file.originalname,
        content,
        fileType,
        fileSize: req.file.size,
      });
      res.json({
        id: file.id,
        name: file.name,
        originalName: file.originalName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        createdAt: file.createdAt,
      });
    } catch (err) {
      console.error("Upload knowledge file error:", err);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.delete("/api/knowledge-files/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteKnowledgeFile(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete knowledge file error:", err);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const { getStripePublishableKey } = await import("./stripeClient");
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (err) {
      console.error("Stripe publishable key error:", err);
      res.status(500).json({ message: "Stripe not configured" });
    }
  });

  app.get("/api/stripe/products", async (_req, res) => {
    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const products = await stripe.products.list({ active: true, expand: ["data.default_price"] });
      res.json(products.data);
    } catch (err) {
      console.error("Stripe products error:", err);
      res.status(500).json({ message: "Failed to get products" });
    }
  });

  app.post("/api/stripe/checkout", async (req, res) => {
    try {
      const { priceId } = req.body;
      if (!priceId) return res.status(400).json({ message: "priceId required" });
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || req.get("host") || "localhost:5000";
      const protocol = domain.includes("localhost") ? "http" : "https";
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "payment",
        success_url: `${protocol}://${domain}/settings?payment=success`,
        cancel_url: `${protocol}://${domain}/settings?payment=cancel`,
      });
      res.json({ url: session.url });
    } catch (err) {
      console.error("Stripe checkout error:", err);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  try {
    await seedDatabase();
  } catch (err) {
    console.error("Failed to seed database", err);
  }

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getProjects();
  if (existing.length === 0) {
    await storage.createProject({
      title: "Biệt thự anh Nhân - chị Yến",
      clientName: "Anh Nhân - Chị Yến",
      landWidth: 5,
      landLength: 20,
      floors: 2,
      bedrooms: 3,
      style: "Wabi Sabi",
      budget: 300,
    });
  }
}
