import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, timestamp, json, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";

export const driveFolders = pgTable("drive_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  folderId: text("folder_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  clientName: text("client_name").notNull().default(""),
  landWidth: real("land_width").notNull(),
  landLength: real("land_length").notNull(),
  floors: integer("floors").notNull().default(1),
  bedrooms: integer("bedrooms").notNull().default(1),
  style: text("style").notNull(),
  budget: integer("budget").notNull(),
  currentStep: integer("current_step").notNull().default(1),
  stepStatuses: json("step_statuses").$type<Record<string, string>>().default({
    "1": "approved", "2": "pending", "3": "pending",
    "4": "pending", "5": "pending", "6": "pending", "7": "pending"
  }),
  uploadedFiles: json("uploaded_files").$type<Array<{ name: string; type: string; url: string }>>().default([]),
  budgetSheetUrl: text("budget_sheet_url"),
  siteRequirements: json("site_requirements").$type<Record<string, boolean>>().default({}),
  analysisResult: json("analysis_result"),
  layoutResult: json("layout_result"),
  cadResult: json("cad_result"),
  model3dResult: json("model3d_result"),
  facadeStyle: text("facade_style"),
  interiorResult: json("interior_result"),
  renderResult: json("render_result"),
  pdfEstimate: json("pdf_estimate"),
  chatHistory: json("chat_history").$type<Array<{ role: string; content: string; timestamp: string }>>().default([]),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiSettings = pgTable("ai_settings", {
  id: serial("id").primaryKey(),
  instructions: text("instructions").notNull().default(""),
  indexedAt: timestamp("indexed_at"),
  pendingReindex: integer("pending_reindex").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const knowledgeCategories = pgTable("knowledge_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  icon: text("icon").default("folder"),
  color: text("color").default("orange"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const knowledgeFiles = pgTable("knowledge_files", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  originalName: text("original_name").notNull(),
  content: text("content").notNull(),
  fileType: text("file_type").notNull().default("text"),
  fileSize: integer("file_size").notNull().default(0),
  tags: text("tags").array().default([]),
  tagsManual: text("tags_manual").array().default([]),
  categoryId: integer("category_id"),
  source: text("source").notNull().default("upload"),
  pendingUpdate: integer("pending_update").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AiSettings = typeof aiSettings.$inferSelect;
export type KnowledgeFile = typeof knowledgeFiles.$inferSelect;
export type KnowledgeCategory = typeof knowledgeCategories.$inferSelect;
export type DriveFolder = typeof driveFolders.$inferSelect;

export const insertDriveFolderSchema = createInsertSchema(driveFolders).omit({
  id: true,
  createdAt: true,
});

export const insertKnowledgeCategorySchema = createInsertSchema(knowledgeCategories).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  currentStep: true,
  stepStatuses: true,
  uploadedFiles: true,
  budgetSheetUrl: true,
  siteRequirements: true,
  analysisResult: true,
  layoutResult: true,
  cadResult: true,
  model3dResult: true,
  facadeStyle: true,
  interiorResult: true,
  renderResult: true,
  pdfEstimate: true,
  chatHistory: true,
  status: true,
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type CreateProjectRequest = InsertProject;
export type ProjectResponse = Project;
