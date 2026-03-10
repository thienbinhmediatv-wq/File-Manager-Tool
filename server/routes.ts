import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
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
  1: "Chào bạn! Tôi là trợ lý AI thiết kế kiến trúc của Bmt Decor. Hãy cho tôi biết thông tin về khu đất và yêu cầu thiết kế của bạn. Bạn có yêu cầu đặc biệt về phong thủy, phòng thờ, gara xe không?",
  2: "Tôi đã phân tích hiện trạng khu đất. Bạn muốn điều chỉnh gì về hướng nhà, bố trí phòng, hay yêu cầu phong thủy không?",
  3: "Bản vẽ CAD đã được tạo. Bạn muốn chỉnh sửa vị trí tường, cửa, cầu thang hay kích thước phòng nào không?",
  4: "Hãy cho tôi biết phong cách mặt tiền bạn yêu thích: Hiện đại, Tân cổ điển, Minimalist, Wabi Sabi... Bạn thích tông màu nào?",
  5: "Bạn muốn nội thất phong cách nào? Hãy cho tôi biết về vật liệu ưa thích (gỗ, đá, kính...), kiểu đồ nội thất, và ngân sách dự kiến.",
  6: "Tôi sẽ render các góc nhìn cho bạn. Bạn muốn xem góc nào: mặt tiền, phòng khách, phòng ngủ, bếp, sân vườn, panorama 360°?",
  7: "Hồ sơ PDF sẽ bao gồm tất cả bản vẽ, render và thông tin kỹ thuật. Bạn muốn thêm nội dung gì vào hồ sơ không?",
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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

    let result: unknown = null;
    const area = project.landWidth * project.landLength;

    try {
      if (step === 1) {
        result = { collected: true, area, dimensions: `${project.landWidth}m x ${project.landLength}m` };
      } else if (step === 2) {
        const prompt = `Bạn là kiến trúc sư AI. Phân tích khu đất ${project.landWidth}m x ${project.landLength}m, ${project.floors} tầng, ${project.bedrooms} phòng ngủ, phong cách ${project.style}. Đề xuất bố trí layout phòng chi tiết bằng JSON gồm: tên phòng, vị trí (x,y), kích thước (w,h). Trả lời bằng tiếng Việt.`;
        const completion = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 2048,
        });
        const aiText = completion.choices[0]?.message?.content || "";
        result = {
          analysis: {
            dimensions: `${project.landWidth}m x ${project.landLength}m`,
            area: `${area} m²`,
            orientation: "Đông Nam",
            sunlight: "Tốt - ánh sáng tự nhiên buổi sáng",
            wind: "Thông thoáng - hướng gió chính Đông Nam",
            fengShui: "Hướng tốt cho gia chủ",
          },
          layout: {
            floors: Array.from({ length: project.floors }, (_, i) => ({
              floor: i + 1,
              rooms: i === 0
                ? [
                    { name: "Phòng khách", x: 0, y: 0, w: Math.round(project.landWidth * 0.6), h: Math.round(project.landLength * 0.3) },
                    { name: "Bếp + Ăn", x: 0, y: Math.round(project.landLength * 0.3), w: Math.round(project.landWidth * 0.5), h: Math.round(project.landLength * 0.25) },
                    { name: "WC", x: Math.round(project.landWidth * 0.7), y: Math.round(project.landLength * 0.3), w: Math.round(project.landWidth * 0.3), h: Math.round(project.landLength * 0.15) },
                    { name: "Gara", x: Math.round(project.landWidth * 0.6), y: 0, w: Math.round(project.landWidth * 0.4), h: Math.round(project.landLength * 0.3) },
                  ]
                : [
                    { name: `Phòng ngủ ${i === 1 ? "Master" : i}`, x: 0, y: 0, w: Math.round(project.landWidth * 0.5), h: Math.round(project.landLength * 0.5) },
                    { name: `Phòng ngủ ${i + 1}`, x: Math.round(project.landWidth * 0.5), y: 0, w: Math.round(project.landWidth * 0.5), h: Math.round(project.landLength * 0.4) },
                    { name: "WC", x: Math.round(project.landWidth * 0.5), y: Math.round(project.landLength * 0.4), w: Math.round(project.landWidth * 0.5), h: Math.round(project.landLength * 0.2) },
                    { name: "Ban công", x: 0, y: Math.round(project.landLength * 0.5), w: project.landWidth, h: Math.round(project.landLength * 0.1) },
                  ],
            })),
          },
          aiSuggestion: aiText,
        };
      } else if (step === 3) {
        result = {
          cadDrawings: [
            { name: "Mặt bằng tầng 1", type: "floorplan", floor: 1 },
            { name: "Mặt bằng tầng 2", type: "floorplan", floor: 2 },
            { name: "Mặt cắt A-A", type: "section" },
            { name: "Mặt đứng chính", type: "elevation" },
          ],
          dimensions: { totalArea: area * project.floors, wallThickness: 0.2, floorHeight: 3.3 },
          note: "Bản vẽ CAD mô phỏng. Kết nối AutoCAD/Revit server để xuất file thực.",
        };
      } else if (step === 4) {
        result = {
          facadeStyle: project.facadeStyle || project.style,
          model3d: {
            format: "glTF",
            polyCount: 125000,
            textures: ["concrete", "glass", "wood"],
          },
          facadeImages: [
            "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
          ],
          note: "Mô hình 3D mô phỏng. Kết nối Blender/SketchUp server để render thực.",
        };
      } else if (step === 5) {
        result = {
          materials: [
            { name: "Gỗ sồi tự nhiên", area: "Sàn phòng khách, phòng ngủ", cost: "850.000 VND/m²" },
            { name: "Gạch porcelain 60x60", area: "Bếp, WC", cost: "450.000 VND/m²" },
            { name: "Sơn Dulux nội thất", area: "Tường toàn bộ", cost: "120.000 VND/m²" },
            { name: "Kính cường lực 10mm", area: "Cửa sổ, vách ngăn", cost: "750.000 VND/m²" },
          ],
          furniture: [
            { room: "Phòng khách", items: ["Sofa chữ L", "Bàn trà", "Kệ TV", "Đèn trang trí"] },
            { room: "Phòng ngủ Master", items: ["Giường King", "Tủ quần áo", "Bàn trang điểm", "Đèn ngủ"] },
            { room: "Bếp", items: ["Tủ bếp chữ L", "Đảo bếp", "Máy hút mùi", "Bộ bàn ăn 6 ghế"] },
          ],
          estimatedCost: `${Math.round(area * project.floors * 8.5)} triệu VND`,
          note: "Nội thất mô phỏng. Kết nối 3D furniture library để render chi tiết.",
        };
      } else if (step === 6) {
        result = {
          renders: [
            { name: "Mặt tiền ban ngày", url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=800&fit=crop", angle: "facade" },
            { name: "Phòng khách", url: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&h=800&fit=crop", angle: "living" },
            { name: "Phòng ngủ Master", url: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1200&h=800&fit=crop", angle: "bedroom" },
            { name: "Bếp & Phòng ăn", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&h=800&fit=crop", angle: "kitchen" },
            { name: "Sân vườn", url: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&h=800&fit=crop", angle: "garden" },
          ],
          note: "Render mô phỏng từ Unsplash. Kết nối render engine để tạo hình thực.",
        };
      } else if (step === 7) {
        result = {
          pageCount: 35 + project.floors * 5,
          sections: [
            "Trang bìa & Mục lục",
            "Thông tin dự án",
            "Phân tích hiện trạng",
            "Bản vẽ mặt bằng các tầng",
            "Bản vẽ mặt cắt & mặt đứng",
            "Mô hình 3D & mặt tiền",
            "Thiết kế nội thất",
            "Render phối cảnh",
            "Bảng khối lượng & Dự toán",
          ],
          estimatedSize: "25 MB",
          downloadUrl: "#",
          note: "PDF mô phỏng. Kết nối PDF generator để tạo file thực.",
        };
      }

      const finalStatuses = { ...(project.stepStatuses as Record<string, string> || {}), [step]: "completed" };
      const updateData: Record<string, unknown> = { stepStatuses: finalStatuses };
      if (step === 2) updateData.analysisResult = (result as { analysis: unknown }).analysis;
      if (step === 2) updateData.layoutResult = (result as { layout: unknown }).layout;
      if (step === 3) updateData.cadResult = result;
      if (step === 4) updateData.model3dResult = result;
      if (step === 5) updateData.interiorResult = result;
      if (step === 6) updateData.renderResult = result;
      if (step === 7) updateData.pdfEstimate = result;

      const updated = await storage.updateProject(id, updateData);
      res.json({ project: updated, result, stepName: STEP_NAMES[step] });
    } catch (err) {
      console.error("Process step error:", err);
      const errStatuses = { ...(project.stepStatuses as Record<string, string> || {}), [step]: "error" };
      await storage.updateProject(id, { stepStatuses: errStatuses });
      res.status(500).json({ message: "Processing failed" });
    }
  });

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
      const { projectId, message, step } = req.body;
      if (!message) return res.status(400).json({ message: "Message required" });

      let project = null;
      if (projectId) {
        project = await storage.getProject(projectId);
      }

      const systemPrompt = `Bạn là trợ lý AI thiết kế kiến trúc & nội thất của Bmt Decor. Bạn là chuyên gia về:
- Thiết kế kiến trúc nhà ở Việt Nam
- Phong thủy và bố trí không gian
- Vật liệu xây dựng và nội thất
- Dự toán chi phí xây dựng

${project ? `Thông tin dự án hiện tại:
- Tên: ${project.title}
- Khách hàng: ${project.clientName}
- Kích thước đất: ${project.landWidth}m x ${project.landLength}m (${project.landWidth * project.landLength}m²)
- Số tầng: ${project.floors}
- Phòng ngủ: ${project.bedrooms}
- Phong cách: ${project.style}
- Ngân sách: ${project.budget} triệu VND
- Bước hiện tại: ${step || project.currentStep}/7 - ${STEP_NAMES[step || project.currentStep]}` : ""}

Trả lời ngắn gọn, chuyên nghiệp, bằng tiếng Việt. Đưa ra gợi ý cụ thể và thực tế.`;

      const chatHistory = (project?.chatHistory as Array<{role: string; content: string}>) || [];
      const recentHistory = chatHistory.slice(-10).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...recentHistory,
          { role: "user", content: message },
        ],
        max_completion_tokens: 2048,
      });

      const reply = completion.choices[0]?.message?.content || "Xin lỗi, tôi không thể trả lời lúc này.";

      if (project) {
        const newHistory = [...chatHistory, 
          { role: "user", content: message, timestamp: new Date().toISOString() },
          { role: "assistant", content: reply, timestamp: new Date().toISOString() },
        ];
        await storage.updateProject(project.id, { chatHistory: newHistory });
      }

      res.json({ reply });
    } catch (err) {
      console.error("Chat error:", err);
      res.status(500).json({ message: "Chat failed" });
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
