import { db } from "./db";
import {
  projects,
  type Project,
  type InsertProject,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export type ProjectSummary = Pick<Project, "id" | "title" | "clientName" | "landWidth" | "landLength" | "floors" | "bedrooms" | "style" | "budget" | "currentStep" | "stepStatuses" | "status" | "createdAt">;

export interface IStorage {
  getProjects(): Promise<ProjectSummary[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: Partial<Project>): Promise<Project>;
  deleteProject(id: number): Promise<void>;
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
}

export const storage = new DatabaseStorage();
