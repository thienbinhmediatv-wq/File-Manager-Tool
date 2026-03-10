import { db } from "./db";
import {
  projects,
  aiSettings,
  knowledgeFiles,
  type Project,
  type InsertProject,
  type AiSettings,
  type KnowledgeFile,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export type ProjectSummary = Pick<Project, "id" | "title" | "clientName" | "landWidth" | "landLength" | "floors" | "bedrooms" | "style" | "budget" | "currentStep" | "stepStatuses" | "status" | "createdAt">;

export interface IStorage {
  getProjects(): Promise<ProjectSummary[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: Partial<Project>): Promise<Project>;
  deleteProject(id: number): Promise<void>;
  getAiSettings(): Promise<AiSettings | undefined>;
  upsertAiSettings(instructions: string): Promise<AiSettings>;
  getKnowledgeFiles(): Promise<KnowledgeFile[]>;
  getKnowledgeFile(id: number): Promise<KnowledgeFile | undefined>;
  createKnowledgeFile(file: { name: string; originalName: string; content: string; fileType: string; fileSize: number }): Promise<KnowledgeFile>;
  deleteKnowledgeFile(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getProjects(): Promise<ProjectSummary[]> {
    return await db.select({
      id: projects.id,
      title: projects.title,
      clientName: projects.clientName,
      landWidth: projects.landWidth,
      landLength: projects.landLength,
      floors: projects.floors,
      bedrooms: projects.bedrooms,
      style: projects.style,
      budget: projects.budget,
      currentStep: projects.currentStep,
      stepStatuses: projects.stepStatuses,
      status: projects.status,
      createdAt: projects.createdAt,
    }).from(projects);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: number, updates: Partial<Project>): Promise<Project> {
    const [updated] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning();
    return updated;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getAiSettings(): Promise<AiSettings | undefined> {
    const [settings] = await db.select().from(aiSettings).limit(1);
    return settings;
  }

  async upsertAiSettings(instructions: string): Promise<AiSettings> {
    const existing = await this.getAiSettings();
    if (existing) {
      const [updated] = await db.update(aiSettings)
        .set({ instructions, updatedAt: new Date() })
        .where(eq(aiSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(aiSettings)
      .values({ instructions })
      .returning();
    return created;
  }

  async getKnowledgeFiles(): Promise<KnowledgeFile[]> {
    return await db.select().from(knowledgeFiles).orderBy(desc(knowledgeFiles.createdAt));
  }

  async getKnowledgeFile(id: number): Promise<KnowledgeFile | undefined> {
    const [file] = await db.select().from(knowledgeFiles).where(eq(knowledgeFiles.id, id));
    return file;
  }

  async createKnowledgeFile(file: { name: string; originalName: string; content: string; fileType: string; fileSize: number }): Promise<KnowledgeFile> {
    const [created] = await db.insert(knowledgeFiles).values(file).returning();
    return created;
  }

  async deleteKnowledgeFile(id: number): Promise<void> {
    await db.delete(knowledgeFiles).where(eq(knowledgeFiles.id, id));
  }
}

export const storage = new DatabaseStorage();
