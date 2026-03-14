import { db } from "./db";
import {
  projects,
  aiSettings,
  knowledgeFiles,
  knowledgeCategories,
  driveFolders,
  type Project,
  type InsertProject,
  type AiSettings,
  type KnowledgeFile,
  type KnowledgeCategory,
  type DriveFolder,
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export type ProjectSummary = Pick<Project, "id" | "title" | "clientName" | "landWidth" | "landLength" | "floors" | "bedrooms" | "style" | "budget" | "currentStep" | "stepStatuses" | "status" | "createdAt">;

export interface IStorage {
  getProjects(): Promise<ProjectSummary[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: Partial<Project>): Promise<Project>;
  deleteProject(id: number): Promise<void>;
  getAiSettings(): Promise<AiSettings | undefined>;
  upsertAiSettings(instructions: string): Promise<AiSettings>;
  setReindexStatus(pending: boolean, indexedAt?: Date): Promise<void>;
  getKnowledgeFiles(): Promise<KnowledgeFile[]>;
  getKnowledgeFile(id: number): Promise<KnowledgeFile | undefined>;
  createKnowledgeFile(file: { name: string; originalName: string; content: string; fileType: string; fileSize: number; source?: string; categoryId?: number }): Promise<KnowledgeFile>;
  updateKnowledgeFile(id: number, updates: { tags?: string[]; tagsManual?: string[]; categoryId?: number | null; pendingUpdate?: number }): Promise<KnowledgeFile>;
  updateKnowledgeFileTags(id: number, tags: string[]): Promise<KnowledgeFile>;
  deleteKnowledgeFile(id: number): Promise<void>;
  getKnowledgeCategories(): Promise<KnowledgeCategory[]>;
  getKnowledgeCategory(id: number): Promise<KnowledgeCategory | undefined>;
  createKnowledgeCategory(cat: { name: string; parentId?: number | null; icon?: string; color?: string }): Promise<KnowledgeCategory>;
  updateKnowledgeCategory(id: number, updates: { name?: string; parentId?: number | null; icon?: string; color?: string }): Promise<KnowledgeCategory>;
  deleteKnowledgeCategory(id: number): Promise<void>;
  getDriveFolders(): Promise<DriveFolder[]>;
  getDriveFolder(id: number): Promise<DriveFolder | undefined>;
  createDriveFolder(folder: { name: string; folderId: string }): Promise<DriveFolder>;
  deleteDriveFolder(id: number): Promise<void>;
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
    const [created] = await db.insert(aiSettings).values({ instructions }).returning();
    return created;
  }

  async setReindexStatus(pending: boolean, indexedAt?: Date): Promise<void> {
    const existing = await this.getAiSettings();
    const updates: any = { pendingReindex: pending ? 1 : 0 };
    if (indexedAt) updates.indexedAt = indexedAt;
    if (existing) {
      await db.update(aiSettings).set(updates).where(eq(aiSettings.id, existing.id));
    } else {
      await db.insert(aiSettings).values({ instructions: "", pendingReindex: pending ? 1 : 0, indexedAt });
    }
  }

  async getKnowledgeFiles(): Promise<KnowledgeFile[]> {
    return await db.select().from(knowledgeFiles).orderBy(desc(knowledgeFiles.createdAt));
  }

  async getKnowledgeFile(id: number): Promise<KnowledgeFile | undefined> {
    const [file] = await db.select().from(knowledgeFiles).where(eq(knowledgeFiles.id, id));
    return file;
  }

  async createKnowledgeFile(file: { name: string; originalName: string; content: string; fileType: string; fileSize: number; source?: string; categoryId?: number }): Promise<KnowledgeFile> {
    const [created] = await db.insert(knowledgeFiles).values({
      ...file,
      source: file.source || "upload",
      lastUpdated: new Date(),
    }).returning();
    return created;
  }

  async updateKnowledgeFile(id: number, updates: { tags?: string[]; tagsManual?: string[]; categoryId?: number | null; pendingUpdate?: number }): Promise<KnowledgeFile> {
    const [updated] = await db.update(knowledgeFiles)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(knowledgeFiles.id, id))
      .returning();
    return updated;
  }

  async updateKnowledgeFileTags(id: number, tags: string[]): Promise<KnowledgeFile> {
    const [updated] = await db.update(knowledgeFiles)
      .set({ tags, lastUpdated: new Date(), pendingUpdate: 1 })
      .where(eq(knowledgeFiles.id, id))
      .returning();
    return updated;
  }

  async deleteKnowledgeFile(id: number): Promise<void> {
    await db.delete(knowledgeFiles).where(eq(knowledgeFiles.id, id));
  }

  async getKnowledgeCategories(): Promise<KnowledgeCategory[]> {
    return await db.select().from(knowledgeCategories).orderBy(knowledgeCategories.name);
  }

  async getKnowledgeCategory(id: number): Promise<KnowledgeCategory | undefined> {
    const [cat] = await db.select().from(knowledgeCategories).where(eq(knowledgeCategories.id, id));
    return cat;
  }

  async createKnowledgeCategory(cat: { name: string; parentId?: number | null; icon?: string; color?: string }): Promise<KnowledgeCategory> {
    const [created] = await db.insert(knowledgeCategories).values(cat).returning();
    return created;
  }

  async updateKnowledgeCategory(id: number, updates: { name?: string; parentId?: number | null; icon?: string; color?: string }): Promise<KnowledgeCategory> {
    const [updated] = await db.update(knowledgeCategories).set(updates).where(eq(knowledgeCategories.id, id)).returning();
    return updated;
  }

  async deleteKnowledgeCategory(id: number): Promise<void> {
    await db.update(knowledgeFiles).set({ categoryId: null }).where(eq(knowledgeFiles.categoryId, id));
    await db.delete(knowledgeCategories).where(eq(knowledgeCategories.id, id));
  }

  async getDriveFolders(): Promise<DriveFolder[]> {
    return await db.select().from(driveFolders).orderBy(desc(driveFolders.createdAt));
  }

  async getDriveFolder(id: number): Promise<DriveFolder | undefined> {
    const [folder] = await db.select().from(driveFolders).where(eq(driveFolders.id, id));
    return folder;
  }

  async createDriveFolder(folder: { name: string; folderId: string }): Promise<DriveFolder> {
    const [created] = await db.insert(driveFolders).values(folder).returning();
    return created;
  }

  async deleteDriveFolder(id: number): Promise<void> {
    await db.delete(driveFolders).where(eq(driveFolders.id, id));
  }
}

export const storage = new DatabaseStorage();
