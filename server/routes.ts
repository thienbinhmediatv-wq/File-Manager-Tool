import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const SERPAPI_KEY = process.env.SERPAPI_KEY || "";

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

  app.use("/generated", (await import("express")).default.static(GEN_DIR));

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

        const facadeUrl1 = await aiGenerateImage(
          `Exterior facade of a beautiful ${project.floors}-story Vietnamese residential house, ${facadeStyle} architecture style, ${project.landWidth}m wide, daytime, professional architectural visualization, photorealistic, lush landscaping, clean modern design`,
          id, "facade_day"
        );

        const facadeUrl2 = await aiGenerateImage(
          `Exterior facade of a beautiful ${project.floors}-story Vietnamese residential house, ${facadeStyle} architecture style, ${project.landWidth}m wide, night time with warm interior lighting, professional architectural visualization, photorealistic`,
          id, "facade_night"
        );

        const designText = await aiChat([
          { role: "system", content: "Bạn là kiến trúc sư AI chuyên thiết kế mặt tiền nhà Việt Nam." },
          { role: "user", content: `Mô tả chi tiết thiết kế mặt tiền phong cách ${facadeStyle} cho nhà ${project.floors} tầng, ${project.landWidth}m rộng:
- Vật liệu mặt tiền
- Tỷ lệ cửa sổ
- Mái và chi tiết kiến trúc
- Màu sắc chủ đạo
- Cây xanh trang trí` }
        ]);

        result = {
          facadeStyle,
          facadeImages: [facadeUrl1, facadeUrl2],
          designDescription: designText,
        };

      } else if (step === 5) {
        const interiorText = await aiChat([
          { role: "system", content: "Bạn là nhà thiết kế nội thất AI chuyên nghiệp tại Việt Nam. Trả lời bằng tiếng Việt." },
          { role: "user", content: `Thiết kế nội thất chi tiết cho dự án:
${ctx}

Cho mỗi phòng (phòng khách, phòng ngủ master, bếp, WC), hãy đề xuất:
1. Vật liệu sàn, tường, trần
2. Đồ nội thất cụ thể (tên, kích thước, giá ước tính VND)
3. Hệ thống ánh sáng
4. Tổng chi phí nội thất ước tính

Trả lời chi tiết, có số liệu cụ thể.` }
        ], 3000);

        const interiorUrl = await aiGenerateImage(
          `Interior design of a luxurious Vietnamese ${project.style} style living room, modern furniture, natural wood materials, warm lighting, indoor plants, professional interior photography, photorealistic, 4K quality`,
          id, "interior_living"
        );

        const bedroomUrl = await aiGenerateImage(
          `Interior design of a beautiful ${project.style} style master bedroom, Vietnamese residential, elegant bed, warm ambient lighting, natural materials, cozy atmosphere, professional interior photography`,
          id, "interior_bedroom"
        );

        result = {
          interiorDescription: interiorText,
          interiorImages: [
            { name: "Phòng khách", url: interiorUrl },
            { name: "Phòng ngủ Master", url: bedroomUrl },
          ],
          estimatedCost: `${Math.round(area * project.floors * 8.5)} triệu VND`,
        };

      } else if (step === 6) {
        const renderPrompts = [
          { name: "Mặt tiền ban ngày", prompt: `Photorealistic exterior render of a ${project.floors}-story ${project.style} Vietnamese house, ${project.landWidth}m x ${project.landLength}m lot, daytime, beautiful landscaping, blue sky, professional architectural visualization, 8K quality` },
          { name: "Phòng khách", prompt: `Photorealistic interior render of a spacious ${project.style} style living room in Vietnamese house, natural light through large windows, modern furniture, warm atmosphere, professional interior visualization` },
          { name: "Phòng ngủ Master", prompt: `Photorealistic interior render of a ${project.style} style master bedroom, Vietnamese residential, elegant design, warm lighting, comfortable atmosphere, high quality visualization` },
        ];

        const renders = [];
        for (const r of renderPrompts) {
          const url = await aiGenerateImage(r.prompt, id, `render_${r.name.replace(/\s/g, "_")}`);
          renders.push({ name: r.name, url, angle: r.name });
        }

        result = { renders };

      } else if (step === 7) {
        const pdfFilename = `${id}_hoso_${Date.now()}.pdf`;
        const pdfPath = path.join(GEN_DIR, pdfFilename);

        const doc = new PDFDocument({ size: "A4", margin: 50 });
        let pageCount = 1;
        doc.on("pageAdded", () => { pageCount++; });
        const writeStream = fs.createWriteStream(pdfPath);
        doc.pipe(writeStream);

        doc.fontSize(24).text("BMT DECOR", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(18).text("HO SO THIET KE KIEN TRUC", { align: "center" });
        doc.moveDown(2);

        doc.fontSize(14).text(`Du an: ${project.title}`);
        doc.text(`Khach hang: ${project.clientName || "N/A"}`);
        doc.text(`Kich thuoc dat: ${project.landWidth}m x ${project.landLength}m (${area} m2)`);
        doc.text(`So tang: ${project.floors}`);
        doc.text(`Phong ngu: ${project.bedrooms}`);
        doc.text(`Phong cach: ${project.style}`);
        doc.text(`Ngan sach: ${project.budget} trieu VND`);
        doc.moveDown(2);

        doc.fontSize(16).text("1. PHAN TICH HIEN TRANG", { underline: true });
        doc.moveDown(0.5);
        const analysis = project.analysisResult as Record<string, string> | null;
        if (analysis?.aiAnalysis) {
          doc.fontSize(10).text(String(analysis.aiAnalysis).substring(0, 2000));
        } else if (analysis) {
          doc.fontSize(10).text(JSON.stringify(analysis, null, 2).substring(0, 1000));
        }
        doc.moveDown(1);

        doc.addPage();
        doc.fontSize(16).text("2. BO TRI LAYOUT", { underline: true });
        doc.moveDown(0.5);
        const layout = project.layoutResult;
        if (layout) {
          doc.fontSize(10).text(JSON.stringify(layout, null, 2).substring(0, 2000));
        }
        doc.moveDown(1);

        doc.addPage();
        doc.fontSize(16).text("3. BAN VE CAD", { underline: true });
        doc.moveDown(0.5);
        const cad = project.cadResult as { cadDescription?: string; cadDrawings?: Array<{imageUrl?: string}> } | null;
        if (cad?.cadDescription) {
          doc.fontSize(10).text(cad.cadDescription.substring(0, 2000));
        }
        if (cad?.cadDrawings) {
          for (const drawing of cad.cadDrawings) {
            if (drawing.imageUrl && drawing.imageUrl.startsWith("/generated/")) {
              const imgPath = path.join(GEN_DIR, drawing.imageUrl.replace("/generated/", ""));
              if (fs.existsSync(imgPath)) {
                try { doc.addPage().image(imgPath, { fit: [500, 400], align: "center" }); } catch {}
              }
            }
          }
        }

        doc.addPage();
        doc.fontSize(16).text("4. MO HINH 3D & MAT TIEN", { underline: true });
        doc.moveDown(0.5);
        const model3d = project.model3dResult as { facadeImages?: string[]; designDescription?: string } | null;
        if (model3d?.designDescription) {
          doc.fontSize(10).text(model3d.designDescription.substring(0, 2000));
        }
        if (model3d?.facadeImages) {
          for (const imgUrl of model3d.facadeImages) {
            if (imgUrl.startsWith("/generated/")) {
              const imgPath = path.join(GEN_DIR, imgUrl.replace("/generated/", ""));
              if (fs.existsSync(imgPath)) {
                try { doc.addPage().image(imgPath, { fit: [500, 400], align: "center" }); } catch {}
              }
            }
          }
        }

        doc.addPage();
        doc.fontSize(16).text("5. THIET KE NOI THAT", { underline: true });
        doc.moveDown(0.5);
        const interior = project.interiorResult as { interiorDescription?: string; interiorImages?: Array<{url: string}> } | null;
        if (interior?.interiorDescription) {
          doc.fontSize(10).text(interior.interiorDescription.substring(0, 2000));
        }
        if (interior?.interiorImages) {
          for (const img of interior.interiorImages) {
            if (img.url.startsWith("/generated/")) {
              const imgPath = path.join(GEN_DIR, img.url.replace("/generated/", ""));
              if (fs.existsSync(imgPath)) {
                try { doc.addPage().image(imgPath, { fit: [500, 400], align: "center" }); } catch {}
              }
            }
          }
        }

        doc.addPage();
        doc.fontSize(16).text("6. RENDER PHOI CANH", { underline: true });
        const renderResult = project.renderResult as { renders?: Array<{name: string; url: string}> } | null;
        if (renderResult?.renders) {
          for (const r of renderResult.renders) {
            if (r.url.startsWith("/generated/")) {
              const imgPath = path.join(GEN_DIR, r.url.replace("/generated/", ""));
              if (fs.existsSync(imgPath)) {
                try {
                  doc.addPage();
                  doc.fontSize(12).text(r.name);
                  doc.moveDown(0.5);
                  doc.image(imgPath, { fit: [500, 400], align: "center" });
                } catch {}
              }
            }
          }
        }

        doc.addPage();
        doc.fontSize(16).text("7. DU TOAN CHI PHI", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Tong dien tich xay dung: ${area * project.floors} m2`);
        doc.text(`Don gia xay dung uoc tinh: 6-10 trieu VND/m2`);
        doc.text(`Chi phi xay dung tho: ${Math.round(area * project.floors * 7)} trieu VND`);
        doc.text(`Chi phi noi that: ${Math.round(area * project.floors * 3.5)} trieu VND`);
        doc.text(`Tong du toan: ${Math.round(area * project.floors * 10.5)} trieu VND`);
        doc.moveDown(2);
        doc.fontSize(10).text("Luu y: Day la uoc tinh so bo. Chi phi thuc te co the thay doi tuy theo vat lieu va nha thau.", { italic: true });

        doc.end();

        await new Promise<void>((resolve) => writeStream.on("finish", resolve));

        result = {
          pageCount,
          downloadUrl: `/generated/${pdfFilename}`,
          sections: [
            "Trang bìa & Thông tin dự án",
            "Phân tích hiện trạng",
            "Bố trí Layout",
            "Bản vẽ CAD",
            "Mô hình 3D & Mặt tiền",
            "Thiết kế nội thất",
            "Render phối cảnh",
            "Dự toán chi phí",
          ],
          estimatedSize: `${Math.round(fs.statSync(pdfPath).size / 1024)} KB`,
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
