import { z } from 'zod';
import { insertProjectSchema } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  projects: {
    list: {
      method: 'GET' as const,
      path: '/api/projects' as const,
      responses: { 200: z.array(z.any()) },
    },
    get: {
      method: 'GET' as const,
      path: '/api/projects/:id' as const,
      responses: { 200: z.any(), 404: errorSchemas.notFound },
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects' as const,
      input: insertProjectSchema,
      responses: { 201: z.any(), 400: errorSchemas.validation },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/projects/:id' as const,
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
    submitStep: {
      method: 'POST' as const,
      path: '/api/projects/:id/step/:step/submit' as const,
      input: z.any(),
      responses: { 200: z.any(), 404: errorSchemas.notFound },
    },
    processStep: {
      method: 'POST' as const,
      path: '/api/projects/:id/step/:step/process' as const,
      responses: { 200: z.any(), 404: errorSchemas.notFound },
    },
    approveStep: {
      method: 'POST' as const,
      path: '/api/projects/:id/step/:step/approve' as const,
      responses: { 200: z.any(), 404: errorSchemas.notFound },
    },
    redoStep: {
      method: 'POST' as const,
      path: '/api/projects/:id/step/:step/redo' as const,
      responses: { 200: z.any(), 404: errorSchemas.notFound },
    },
  },
  chat: {
    send: {
      method: 'POST' as const,
      path: '/api/chat' as const,
      input: z.object({
        projectId: z.number(),
        message: z.string(),
      }),
      responses: { 200: z.object({ reply: z.string() }) },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type ProjectInput = z.infer<typeof api.projects.create.input>;
