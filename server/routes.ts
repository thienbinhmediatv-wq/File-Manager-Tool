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
    const filename = `${projectId}_${name}_${Date.now()}.png`;
    const filepath = path.join(GEN_DIR, filename);
    fs.writeFileSync(filepath, Buffer.from(b64, "base64"));
    return `/generated/${filename}`;
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
      const uploaded = files.map(f => ({
        originalName: f.originalname,
        filename: f.filename,
        url: `/uploads/${f.filename}`,
        size: f.size,
        type: f.mimetype,
      }));
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

          const resolveImage = (imgUrl: string): string | null => {
            if (!imgUrl) return null;
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
              try {
                const tmpFile = path.join(GEN_DIR, `tmp_pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
                const { execSync } = require("child_process");
                execSync(`curl -sL -o "${tmpFile}" "${imgUrl}"`, { timeout: 15000 });
                return fs.existsSync(tmpFile) && fs.statSync(tmpFile).size > 100 ? tmpFile : null;
              } catch { return null; }
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
          doc.text("Email: info@bmtdecor.com", { width: CW, align: "center" });
          doc.text("Hotline: 0901 234 567", { width: CW, align: "center" });
          doc.text("Website: www.bmtdecor.com", { width: CW, align: "center" });
          doc.moveDown(3);
          doc.font(fnR).fontSize(9).fill("#718096").text("Cảm ơn quý khách đã tin tưởng sử dụng dịch vụ BMT Decor", { width: CW, align: "center" });
          doc.text(`© ${new Date().getFullYear()} BMT DECOR. All rights reserved.`, { width: CW, align: "center" });

          doc.end();
          await new Promise<void>((resolve) => writeStream.on("finish", resolve));

          pageCount = pdfKitPages;
          downloadUrl = `/generated/${pdfFilename}`;
          const fileSizeBytes = fs.statSync(pdfPath).size;
          estimatedSize = fileSizeBytes > 1024 * 1024
            ? `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.round(fileSizeBytes / 1024)} KB`;
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
      const errStatuses = { ...(project.stepStatuses as Record<string, string> || {}), [step]: "error" };
      await storage.updateProject(id, { stepStatuses: errStatuses });
    }
  }

  app.post("/api/projects/:id/step/:step/approve", async (req, res) => {
    const id = parseInt(req.params.id);
    const step = parseInt(req.params.step);
    if (isNaN(id) || isNaN(step) || step < 1 || step > 7) return res.status(400).json({ message: "Invalid step" });
    const project = await storage.getProject(id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const currentStatus = ((project.stepStatuses as Record<string, string>) || {})[String(step)];
    if (currentStatus !== "completed") {
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

      const systemPrompt = `Bạn là trợ lý AI thiết kế kiến trúc & nội thất của Bmt Decor. Bạn là chuyên gia về:
- Thiết kế kiến trúc nhà ở Việt Nam
- Phong thủy và bố trí không gian
- Vật liệu xây dựng và nội thất
- Dự toán chi phí xây dựng

${project ? `${buildProjectContext(project as unknown as Record<string, unknown>)}
- Bước hiện tại: ${step || project.currentStep}/7 - ${STEP_NAMES[step || project.currentStep]}` : ""}
${searchContext}

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

      if (project) {
        const newHistory = [...chatHistory,
          { role: "user", content: message, timestamp: new Date().toISOString() },
          { role: "assistant", content: reply, timestamp: new Date().toISOString() },
        ];
        await storage.updateProject(project.id, { chatHistory: newHistory });
      }

      res.json({
        reply,
        searchResults: searchResults.length > 0 ? searchResults : undefined,
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
