# BMT Decor - AI Architecture & Interior Design Tool

## Overview
BMT Decor (CÔNG TY TNHH TMDV BMT DECOR) is an AI-powered Vietnamese architecture & interior design automation tool. It features a 7-step sequential wizard where each step includes form inputs, integrated AI chat (OpenAI via Replit AI Integrations), result preview, and approve/redo mechanism.
- **Company**: 7/92, Thành Thái, Phường 14, Quận 10, TP.HCM
- **Director**: Võ Quốc Bảo
- **Website**: thicongtramsac.vn

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + wouter (routing) + TanStack Query
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **AI**: OpenAI via Replit AI Integrations (gpt-4.1-mini for chat, gpt-image-1 for images)
- **Payments**: Stripe via Replit Connectors (stripe-replit-sync for webhook/sync)
- **Language**: Vietnamese UI labels and prompts throughout

## Key Files
- `shared/schema.ts` - Database schema (projects, aiSettings, knowledgeFiles tables)
- `server/routes.ts` - All API endpoints (CRUD, step operations, AI chat, settings, knowledge files, Stripe)
- `server/storage.ts` - DatabaseStorage class with IStorage interface
- `server/stripeClient.ts` - Stripe client via Replit Connectors (getUncachableStripeClient, getStripeSync)
- `server/index.ts` - Express setup with Stripe webhook (BEFORE express.json), Stripe init
- `client/src/pages/Dashboard.tsx` - Project list dashboard
- `client/src/pages/ProjectWizard.tsx` - 7-step wizard with split-screen layout
- `client/src/pages/Settings.tsx` - AI Instructions, Knowledge Files upload, Stripe products
- `client/src/pages/Guide.tsx` - Usage guide page (7-step process documentation)
- `client/src/components/steps/Step*.tsx` - Individual step components (1-7)
- `client/src/components/chat/AIChatPanel.tsx` - AI chat panel
- `client/src/components/layout/AppLayout.tsx` - Sidebar with logo, nav (Dashboard, Dự án, Hướng dẫn, Cài đặt)

## Database Tables
- **projects** - Project data with 7-step workflow fields, JSON result columns
- **ai_settings** - Custom AI instructions (single row, upsert pattern)
- **knowledge_files** - Uploaded knowledge files (content stored as text in DB)
- **conversations + messages** - AI chat history

## 7-Step Workflow
1. Thu thập dữ liệu (Data Collection)
2. Phân tích hiện trạng & Tạo Layout (Analysis & Layout)
3. Xuất bản vẽ CAD/BIM (CAD Export)
4. Tạo mô hình 3D + Mặt tiền (3D Model & Facade)
5. Thiết kế nội thất (Interior Design)
6. Render phối cảnh (Render)
7. Xuất PDF hồ sơ (PDF Export)

## API Endpoints
- `GET/POST /api/projects` - List/Create projects
- `GET/DELETE /api/projects/:id` - Get/Delete project
- `POST /api/projects/:id/step/:step/submit` - Submit step form data
- `POST /api/projects/:id/step/:step/process` - AI process step
- `POST /api/projects/:id/step/:step/approve` - Approve step
- `POST /api/projects/:id/step/:step/redo` - Redo step
- `POST /api/chat` - AI chat with project context + custom instructions + knowledge files + auto email PDF
- `POST /api/projects/:id/send-email` - Send PDF to email address
- `POST /api/settings/verify-password` - Verify settings page password
- `GET /api/settings/ai` - Get AI settings
- `PUT /api/settings/ai` - Update AI instructions
- `GET /api/knowledge-files` - List knowledge files (metadata only)
- `POST /api/knowledge-files` - Upload knowledge file (multer memory storage)
- `DELETE /api/knowledge-files/:id` - Delete knowledge file
- `GET /api/stripe/publishable-key` - Get Stripe publishable key
- `GET /api/stripe/products` - List Stripe products
- `POST /api/stripe/checkout` - Create Stripe checkout session
- `POST /api/stripe/webhook` - Stripe webhook (raw body, registered before express.json)
- `GET /api/projects/:id/download-pdf` - Streaming PDF download

## AI Integration
- Custom instructions from `ai_settings` table injected into every AI chat system prompt
- Knowledge files content injected as reference context in system prompt
- System prompt includes: base expertise + custom instructions + project context + search results + knowledge files

## Stripe Integration
- Connected via Replit Connectors (OAuth)
- `server/stripeClient.ts` - getUncachableStripeClient(), getStripePublishableKey(), getStripeSync()
- Webhook route registered BEFORE express.json() in index.ts
- stripe-replit-sync handles schema migration, webhook processing, data backfill
- Products listed via Stripe API, checkout sessions created for payments

## Image Storage
- AI images stored as base64 data URLs in PostgreSQL JSON columns (not filesystem)
- User uploads converted to base64 data URLs on upload
- Production-safe, survives ephemeral filesystem restarts

## PDF Generation
- Streaming endpoint `GET /api/projects/:id/download-pdf` — generates on-demand
- PDF fonts: `server/fonts/Roboto-Regular.ttf` and `Roboto-Bold.ttf`
- PDFKit creates 20+ page professional document with BMT Decor branding

## External APIs
- **SerpAPI** (`SERPAPI_KEY`): Google search for design references
- **Artificial Studio** (`ARTIFICIAL_STUDIO_API_KEY`): Image-to-video generation
- **PDF Generator API**: Template-based PDF generation (fallback to PDFKit)

## Email Integration
- 2 Gmail senders with fallback: thienbinhmedia.tv@gmail.com → thuyndp.data2@gmail.com
- `server/emailService.ts` - Nodemailer Gmail SMTP with fallback logic
- AI chat auto-detects email requests via [SEND_EMAIL:email] tag in AI response
- Step 7 has direct "Gửi hồ sơ qua Email" button
- Professional HTML email template with BMT Decor branding

## Settings Page Password Protection
- Settings page requires password to access (SETTINGS_PASSWORD env var)
- Session-based auth (sessionStorage) - persists during browser session
- Password: stored in SETTINGS_PASSWORD environment variable

## Environment
- `DATABASE_URL` - PostgreSQL connection
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI API base URL (via Replit)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (via Replit)
- `SESSION_SECRET` - Session secret
- `GMAIL_SENDER` / `GMAIL_SENDER_2` - Sender email addresses
- `GMAIL_APP_PASSWORD` / `GMAIL_APP_PASSWORD_2` - Gmail App Passwords
- `SETTINGS_PASSWORD` - Password for Settings page access
- Stripe credentials managed via Replit Connectors (auto-injected)
