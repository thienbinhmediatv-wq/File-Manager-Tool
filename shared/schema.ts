import { pgTable, text, serial, integer, boolean, timestamp, json, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  landWidth: real("land_width").notNull(),
  landLength: real("land_length").notNull(),
  floors: integer("floors").notNull().default(1),
  bedrooms: integer("bedrooms").notNull().default(1),
  style: text("style").notNull(),
  budget: integer("budget").notNull(), // in millions VND
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  layoutData: json("layout_data"), // To store the generated floorplan JSON
  conceptImageUrl: text("concept_image_url"),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ 
  id: true, 
  createdAt: true,
  status: true,
  layoutData: true,
  conceptImageUrl: true,
  pdfUrl: true
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

// Request types
export type CreateProjectRequest = InsertProject;
export type UpdateProjectRequest = Partial<Project>;

// Response types
export type ProjectResponse = Project;
export type ProjectsListResponse = Project[];
