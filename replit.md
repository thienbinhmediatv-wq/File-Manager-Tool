# Bmt Decor - AI Architecture & Interior Design Tool

## Overview
Bmt Decor is an AI-powered Vietnamese architecture & interior design automation tool. It features a 7-step sequential wizard where each step includes form inputs, integrated AI chat (OpenAI via Replit AI Integrations), result preview, and approve/redo mechanism.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + wouter (routing) + TanStack Query
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **AI**: OpenAI via Replit AI Integrations (gpt-4.1-mini for chat, gpt-image-1 for images)
- **Language**: Vietnamese UI labels and prompts throughout

## Key Files
- `shared/schema.ts` - Database schema (projects table with 7-step workflow fields)
- `shared/routes.ts` - API contract definitions
- `server/routes.ts` - All API endpoints (CRUD, step operations, AI chat)
- `server/storage.ts` - DatabaseStorage class
- `server/replit_integrations/` - OpenAI integration (chat, image, audio, batch)
- `client/src/pages/Dashboard.tsx` - Project list dashboard
- `client/src/pages/ProjectWizard.tsx` - 7-step wizard with split-screen layout
- `client/src/components/steps/Step*.tsx` - Individual step components (1-7)
- `client/src/components/chat/AIChatPanel.tsx` - AI chat panel
- `client/src/hooks/use-projects.ts` - Project CRUD + step mutation hooks
- `client/src/hooks/use-chat.ts` - Chat state management hook

## 7-Step Workflow
1. Thu thập dữ liệu (Data Collection)
2. Phân tích hiện trạng & Tạo Layout (Analysis & Layout)
3. Xuất bản vẽ CAD/BIM (CAD Export)
4. Tạo mô hình 3D + Mặt tiền (3D Model & Facade)
5. Thiết kế nội thất (Interior Design)
6. Render phối cảnh (Render)
7. Xuất PDF hồ sơ (PDF Export)

## Database
- PostgreSQL with Drizzle ORM
- Projects table: serial ID, step workflow fields, JSON result columns
- Conversations + Messages tables for AI chat history

## API Endpoints
- `GET/POST /api/projects` - List/Create projects
- `GET/DELETE /api/projects/:id` - Get/Delete project
- `POST /api/projects/:id/step/:step/submit` - Submit step form data
- `POST /api/projects/:id/step/:step/process` - AI process step
- `POST /api/projects/:id/step/:step/approve` - Approve step (advance)
- `POST /api/projects/:id/step/:step/redo` - Redo step
- `POST /api/chat` - AI chat with project context

## Environment
- `DATABASE_URL` - PostgreSQL connection
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI API base URL (via Replit)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (via Replit)
- `SESSION_SECRET` - Session secret

## File Upload
- `POST /api/upload` - Multer-based multi-file upload (images, PDF, DWG, video)
- Files saved to `public/uploads/`, served via express.static
- Max 20MB per file, supports: PNG, JPG, JPEG, GIF, WebP, PDF, DWG, DXF, MP4, MOV, AVI
- Step 1 UI supports drag-and-drop + click-to-browse + file removal

## AI Processing (Real)
- **Step 1**: Data collection (no AI needed)
- **Step 2**: GPT-4.1-mini analyzes site + generates layout JSON
- **Step 3**: GPT-4.1-mini describes CAD specs + gpt-image-1 generates floor plan image
- **Step 4**: gpt-image-1 generates facade images (day/night) + GPT-4.1-mini describes design
- **Step 5**: GPT-4.1-mini describes interior design + gpt-image-1 generates living room & bedroom images
- **Step 6**: gpt-image-1 generates photorealistic renders (facade, living, bedroom)
- **Step 7**: Dual PDF generation — tries PDF Generator API first, falls back to PDFKit if API fails. Both produce real downloadable PDF files
- Processing is **async**: endpoint returns immediately, background function does AI work, frontend polls every 3s
- Generated images saved to `public/generated/` directory, served as static files
- PDF fonts: `server/fonts/Roboto-Regular.ttf` and `Roboto-Bold.ttf` for Vietnamese diacritics support

## External APIs
- **SerpAPI** (`SERPAPI_KEY`): Google search for design references, pricing, materials, trends
  - Auto-triggers when chat detects keywords (giá, vật liệu, xu hướng, phong cách, etc.)
  - Results shown as clickable references below AI responses
- **Artificial Studio** (`ARTIFICIAL_STUDIO_API_KEY`): Image-to-video generation
  - Endpoint: `https://api.artificialstudio.ai/api/generate`
  - Models: minimax-image-to-video, wan-2.1, kling-1.6-pro, etc.
  - Used in Step 6 to create flythrough videos from render images
  - Async via polling (generate → poll status → get output URL)
- **PDF Generator API** (`PDF_GENERATOR_API_KEY`, `PDF_GENERATOR_API_SECRET`, `PDF_GENERATOR_WORKSPACE`):
  - JWT auth (HS256) via `jose` library
  - Endpoint: `https://us1.pdfgeneratorapi.com/api/v4/documents/generate`
  - Used as primary PDF generator in Step 7, PDFKit is fallback
  - Template-based: sends project data as JSON, gets back PDF URL

## API Endpoints
- `POST /api/generate-video` - Start video generation from render image
- `GET /api/generate-video/:jobId` - Check video generation status
- `POST /api/search` - Search Google via SerpAPI

## Notes
- User wants to integrate multiple AIs (Claude, etc.) in future
- Auto-prompts for image generation stages will be provided by user
- Tool should learn and improve over time through usage
