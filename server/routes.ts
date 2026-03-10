import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get(api.projects.list.path, async (req, res) => {
    const allProjects = await storage.getProjects();
    res.json(allProjects);
  });

  app.get(api.projects.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    const project = await storage.getProject(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json(project);
  });

  app.post(api.projects.create.path, async (req, res) => {
    try {
      const bodySchema = api.projects.create.input.extend({
        landWidth: z.coerce.number(),
        landLength: z.coerce.number(),
        floors: z.coerce.number(),
        bedrooms: z.coerce.number(),
        budget: z.coerce.number(),
      });
      const input = bodySchema.parse(req.body);
      const project = await storage.createProject(input);
      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.projects.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const input = api.projects.update.input.parse(req.body);
      
      const existing = await storage.getProject(id);
      if (!existing) return res.status(404).json({ message: "Project not found" });

      const updated = await storage.updateProject(id, input);
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.projects.delete.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const existing = await storage.getProject(id);
    if (!existing) return res.status(404).json({ message: "Project not found" });
    
    await storage.deleteProject(id);
    res.status(204).send();
  });

  app.post(api.projects.startPipeline.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const existing = await storage.getProject(id);
    if (!existing) return res.status(404).json({ message: "Project not found" });

    // In a real system, this would trigger background AI tasks.
    // For now, we'll mark it as processing and simulate it.
    const updated = await storage.updateProject(id, { status: "processing" });

    // Mock an async pipeline processing
    setTimeout(async () => {
      try {
        await storage.updateProject(id, { 
          status: "completed",
          layoutData: {
            living_room: [0, 0, 4, 5],
            kitchen: [4, 0, 3, 4],
            bedroom1: [0, 5, 4, 4]
          },
          conceptImageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=800",
          pdfUrl: "#"
        });
      } catch (err) {
        console.error("Pipeline error", err);
      }
    }, 10000); // Complete after 10 seconds for demo

    res.status(200).json(updated);
  });

  // Seed database if empty
  try {
    await seedDatabase();
  } catch (err) {
    console.error("Failed to seed database", err);
  }

  return httpServer;
}

async function seedDatabase() {
  const projects = await storage.getProjects();
  if (projects.length === 0) {
    const p1 = await storage.createProject({
      title: "Biệt thự anh Nhân - chị Yến",
      landWidth: 5,
      landLength: 20,
      floors: 2,
      bedrooms: 3,
      style: "Wabi Sabi",
      budget: 300,
    });
    
    await storage.updateProject(p1.id, {
      status: "completed",
      layoutData: {
        living_room: [0, 0, 4, 5],
        kitchen: [4, 0, 3, 4],
        bedroom1: [0, 5, 4, 4]
      },
      conceptImageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=800"
    });
  }
}
