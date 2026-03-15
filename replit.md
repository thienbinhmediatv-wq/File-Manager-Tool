# BMT Decor - AI Architecture & Interior Design Tool

## Overview
BMT Decor (CÔNG TY TNHH TMDV BMT DECOR) is an AI-powered Vietnamese architecture & interior design automation tool. It features a 7-step sequential wizard where each step includes form inputs, integrated AI chat (OpenAI via Replit AI Integrations), result preview, and approve/redo mechanism.
- **Company**: 7/92, Thành Thái, Phường 14, Quận 10, TP.HCM
- **Director**: Võ Quốc Bảo
- **Website**: thicongtramsac.vn

## Knowledge Management System (v2)
- **knowledge_categories** table: id, name, parentId, icon, color — tree folder structure
- **knowledge_files** extended: tags (AI tags), tagsManual (manual tags), categoryId, source (upload/drive/telegram_bot/api_sync), pendingUpdate, lastUpdated
- **API endpoints**: GET/POST/DELETE/PATCH `/api/knowledge-categories`, PATCH `/api/knowledge-files/:id`, POST `/api/knowledge/reindex`
- **Stats endpoint** `/api/knowledge-stats`: total, categories, totalTags, vectorChunks, byType, bySource, pendingCount, indexedAt
- **UI**: Stats dashboard (4 cards), Category tree (left panel), File table with expandable tags (AI+manual), Reindex button with pending state

## Cẩm Nang Knowledge System (5 files in DB)
Each step (3-7) has a corresponding Cẩm nang (handbook) stored in `knowledge_files` table:
- **Bước 3**: 2D CAD — Layer chuẩn (A-WALL, A-COLM, A-DIM, A-BOUND), Dimension 3 lớp, khoảng lùi 1.2-1.4m, cầu thang Sinh 16-18cm, Title Block A/E chuẩn
- **Bước 4**: 3D Model — Khớp 2D-3D, vật liệu theo dự toán, ánh sáng theo hướng nhà
- **Bước 5**: Nội thất — Tam giác vàng bếp, 3-layer lighting, phong thủy, ergonomics 600-900mm
- **Bước 6**: Render — Physical lighting, camera eye-level 1.6m, vật liệu thật, life-like elements
- **Bước 7**: PDF — Cấu trúc 35-70 trang chuẩn BMT, QA/QC cross-check, đặt tên file chuẩn

## Step 3 CAD Standard (Updated)
- Generates one CAD floor plan image per floor (not just one)
- Right-side vertical title block: CHỦ ĐẦU TƯ → DIRECTOR Võ Quốc Bảo → Scale 1/100 → Drawing No KT-01
- 3-layer dimension system in image prompt
- Grid references (circled numbers bottom, letters left)
- Technical specs: setback, stairSteps, layers, scale displayed in UI

## Step 7 PDF Standard (Updated)
- File naming: BMT{id}_{ClientName}_{Date}.pdf
- QA/QC cross-check report embedded in PDF data
- 7 sections: Bìa → Danh mục → Pháp lý → 2D CAD → Nội thất → Phối cảnh → Dự toán

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
- `server/driveKnowledge.ts` - Google Drive knowledge integration (BMT Decor folder)
- `server/index.ts` - Express setup with Stripe webhook (BEFORE express.json), Stripe init
- `client/src/pages/Dashboard.tsx` - Project list dashboard (navigates to /projects/new)
- `client/src/pages/NewProjectWizard.tsx` - New project creation wizard (/projects/new)
- `client/src/pages/ProjectWizard.tsx` - 7-step wizard with split-screen layout
- `client/src/pages/Settings.tsx` - AI Instructions, Knowledge Files upload, Stripe products
- `client/src/pages/Guide.tsx` - Usage guide page (7-step process documentation)
- `client/src/components/steps/Step1DataCollection.tsx` - Step 1 wrapper with 4 sub-steps navigation
- `client/src/components/steps/Step1Sub1BasicInfo.tsx` - Sub-step 1.1: Basic project info form
- `client/src/components/steps/Step1Sub2Architecture.tsx` - Sub-step 1.2: Architecture & interior style selection
- `client/src/components/steps/Step1Sub3Requirements.tsx` - Sub-step 1.3: Special requirements + file upload
- `client/src/components/steps/Step1Sub4Confirmation.tsx` - Sub-step 1.4: Summary + AI process trigger
- `client/src/components/steps/Step*.tsx` - Individual step components (2-7)
- `client/src/components/chat/AIChatPanel.tsx` - AI chat panel
- `client/src/components/layout/AppLayout.tsx` - Sidebar with logo, nav (Dashboard, Dự án, Hướng dẫn, Cài đặt)

## Database Tables
- **projects** - Project data with 7-step workflow fields, JSON result columns. Includes: projectType, bathrooms, selectedArchitecture (json), selectedInteriorStyle
- **ai_settings** - Custom AI instructions (single row, upsert pattern)
- **knowledge_files** - Uploaded knowledge files (content stored as text in DB)
- **drive_folders** - Google Drive folder IDs for multi-source knowledge (name, folderId, createdAt)
- **conversations + messages** - AI chat history

## 7-Step Workflow
1. Thu thập dữ liệu (Data Collection) — 4 sub-steps:
   - 1.1 Thông tin cơ bản (Basic Info: project type, title, dimensions, floors, bedrooms, bathrooms, budget)
   - 1.2 Kiến trúc & Nội thất (Architecture & Interior: dynamic cards by floor count, interior style)
   - 1.3 Yêu cầu đặc biệt (Special Requirements: 8 checkboxes, file upload, Google Sheet link)
   - 1.4 Xác nhận (Confirmation: summary + "Xử lý AI" button)
   - New projects: all 4 sub-steps; Existing projects: skip to 1.3
   - Architecture images: `/public/images/architecture/{1tang,2tang,3tang,4-5tang}/` (placeholder SVGs, to be replaced)
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
- Professional architectural drawing style with right-side title block sidebar (155px)
- Title block includes: CHU DAU TU, THAM DINH THIET KE, DON VI THI CONG (BMT DECOR logo), Director, Drawing info
- Cover page with split layout: left info + right facade image
- Logo from `attached_assets/logo_nobg.png`
- Orange accent color (#e8830c) matching BMT Decor brand

## Google Drive Integration
- **Multi-folder support**: Database table `drive_folders` stores multiple Drive folder IDs
- **7 configured folders**: Knowledge (depdecor.vn), DepDecor, JSON_Logic, Lenh_Kien_Thuc, Tai_lieu_mau, New Folder 1, New Folder 2
- `server/driveKnowledge.ts` - Syncs from all configured folders via Replit Connectors
- Text files (.txt, .md, .csv, .json) injected into AI chat context as knowledge
- 30-minute cache TTL for Drive content
- **OCR System**: Extract text from PDF/DOCX/images in Drive → saved to `knowledge_files` DB
  - `server/ocrService.ts` - pdf-parse v1.1.1 (CJS via createRequire), mammoth for DOCX, tesseract.js for images
  - `POST /api/drive-ocr/process` - Trigger OCR for all 70 Drive files
  - `GET /api/drive-ocr/progress` - Check OCR progress (total/processed/current/results)
- **Drive Learning Tool**: Paste any Drive link in Settings → AI extracts + saves to knowledge_files
- **API Endpoints**:
  - `GET /api/drive-folders` - List all configured folders
  - `POST /api/drive-folders` - Add new folder (name, folderId)
  - `DELETE /api/drive-folders/:id` - Remove folder
  - `GET /api/drive-files` - List files from all folders
  - `POST /api/drive-cache/clear` - Clear cache
  - `POST /api/drive-content` - Fetch content of a single Drive file by fileId
  - `GET /api/templates` - List files in Tai_lieu_mau folder
  - `POST /api/knowledge-files/from-drive` - Add Drive file to knowledge_files

## Known Behaviors
- Image-based PDFs (no text layer) return empty — expected, gracefully skipped
- OCR runs in background; must manually re-trigger via Settings after app restart
- pdf-parse uses `createRequire` (CJS) to avoid ESM path resolution issues in tsx
- AI chat auto-detects Drive links in messages and fetches file content

## Telegram Bot (BMT Decor AI Bot)
- **File**: `server/telegramBot.ts` — started via `startTelegramBot()` in `server/index.ts`
- **Token**: `TELEGRAM_BOT_TOKEN` secret
- **Admin Password**: `TELEGRAM_ADMIN_PASSWORD` secret (for secure file upload)
- **Shares**: Same PostgreSQL DB, same `ai_settings`, same `knowledge_files`, same Drive knowledge as web tool

### Public Commands (Anyone)
- `/start` — Welcome + intro
- `/help` — Full guide
- `/new` — Reset conversation
- `/lienhe` — Contact info
- `/instructions` — View AI Instructions (from Settings)
- `/knowledge` — List knowledge files

### Admin Command (Password Protected)
- `/unlock <password>` — Unlock file upload for 1 hour
  - Requires correct `TELEGRAM_ADMIN_PASSWORD`
  - Returns error if wrong password
  - Session expires after 1 hour (auto-lock)
  - Per-user session tracking

### File Upload (Admin Only)
- Only after unlocking with correct password
- Accepts: `.md`, `.txt`, `.json`, `.csv` (max 5MB)
- Bot downloads → saves to `knowledge_files` table
- AI uses immediately (no restart)
- Confirms with file stats: size, characters, words
- Logged with userId + filename

### AI Chat
- Uses same system prompt: AI Instructions + knowledge_files + Drive knowledge
- Per-user conversation memory: 20 messages (in-memory)
- Reset with `/new`
- Auto-split replies > 4096 chars
- Model: `gpt-4o-mini`
- Available to all users (no unlock needed for chat)

## External APIs (Currently Used)
- **OpenAI** (gpt-5.1, gpt-audio, DALL-E) via Replit AI Integrations — ~$5-10/tháng
- **SerpAPI** - Google search for design references — ~$5-20/tháng
- **Artificial Studio** - Image-to-video generation — ~$10-30/tháng
- **PDF Generator API** - Template-based PDF generation (fallback to PDFKit) — ~$5-20/tháng
- **Google APIs** (Drive, Sheets, Vision) - Free tier (100K requests/ngày) — $0
- **TOTAL API COST**: ~$25-80/tháng

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

---

## FUTURE FEATURES (TO-DO)

### Architecture: Centralized Knowledge Store ("Bó Nhớ") 
**Status**: Planning (Architect-approved model)
**Concept**: Single website serves as centralized knowledge store + continuous learning system. Can combine Memory (static prompts/schemas) + Learning (dynamic scraping) into one unified website. Each tool connects via simple API link, no AI retraining needed.

**Key Decision**: 1 Website (Combined) vs 2 Websites (Separate)
- **1 Website (Recommended)**: $5-10/tháng, simplified management, unified API
  - Module 1: `/api/memory/*` (static, read-only, cacheable)
  - Module 2: `/api/learning/*` (dynamic, async background jobs)
  - Shared database: knowledge_base + learning_queue
- **2 Websites (Alternative)**: $10-20/tháng, separated concerns, simpler logic per site
  - Website 1: Prompts, schemas, images (static only)
  - Website 2: Scraper, extractor, updater (dynamic only)
  - Need API-to-API sync between them

**Benefits**:
- ✅ **Lightweight Tools**: Each tool is stateless, no embedded knowledge
- ✅ **Multi-Tool Support**: Create Tool 2, Tool 3, Tool N — just link to "Bó Nhớ"
- ✅ **Zero Retraining**: AI knowledge shared across all tools automatically
- ✅ **Single Update Point**: Change prompts/schemas on website → all tools use immediately
- ✅ **Infinite Scalability**: Add 100 tools without retraining or duplicating data
- ✅ **Cost-Efficient**: One website "Bó Nhớ" + many lightweight tool instances

**Architecture Pattern**:
```
bmt-bo-nho.com (CENTRALIZED KNOWLEDGE)
├─ /api/prompts/{step}/{version}
├─ /api/schemas/
├─ /api/references/images/{step}
└─ /api/thinking/

↓ Connected by
┌────────────────────────────┐
Tool 1 (BMT Decor)
Tool 2 (Consulting)
Tool 3 (CMS)
Tool N (Future)
```

**Implementation Pattern (Each Tool)**:
```typescript
// config/knowledge-config.ts
export const BOMemoryUrl = process.env.BO_NHO_URL || "https://bmt-bo-nho.com"

// server/ai-service.ts
async function getAIContext() {
  const [prompts, schemas, images] = await Promise.all([
    fetch(`${BOMemoryUrl}/api/prompts`).then(r => r.json()),
    fetch(`${BOMemoryUrl}/api/schemas`).then(r => r.json()),
    fetch(`${BOMemoryUrl}/api/references`).then(r => r.json()),
  ])
  return { prompts, schemas, images }
}
```

---

### Feature 1: Continuous Learning from Website
**Status**: TO-DO (Planning phase)
**Description**: Tool automatically connects to user's website/blogger to continuously extract and learn from project data. AI extracts architectural rules, design patterns, color schemes, material ratios instead of just copying data.

**Implementation Requirements**:
- Web scraper/API client to fetch projects and templates from website
- Data extraction logic to parse architectural rules, ratios, color schemes from project data
- Scheduled background jobs (Cloud Tasks) to sync every 6-24 hours
- Database schema updates to track extracted knowledge and prevent duplicates
- Settings UI to configure website URL, sync frequency, and enable/disable

**Website Architecture for Optimal Learning**:
- API endpoints: `/api/projects` (list), `/api/projects/:id` (detail), `/api/templates` (designs)
- JSON response format with standardized fields: style, color_palette, materials, spatial_ratios, typical_dimensions
- Color palette using HEX codes (#ffffff, #333333)
- Dimensions using metric system (meters, centimeters)
- Metadata consistency (avoid nested JSON >3-4 levels)

**API Integration Points**:
- Tool will call website API to fetch: project list, project details, template design patterns
- Extract from JSON: style (Neoclassic, Modern, Wabi Sabi), color schemes, materials, architectural rules
- Store extracted insights in knowledge_files table for AI to reference

**Cost Estimation**:
- Web scraping: $0 (HTTP requests to custom website are free)
- Data processing via OpenAI: $6-7/tháng (or $0.50-1.50 with Google API)
- Google Cloud Run (if migrated): $0.02/tháng (batch processing)
- **Total**: $7-8/tháng (minimal)

**Alternative - Auto-sync Drive Folder** (simpler version):
- Background job periodically scans a fixed Drive folder
- OCRs new files automatically
- Updates knowledge base without user action
- Cost: Same as above ($0.50-1/tháng with Google API)

---

### Feature 2: API Optimization - Switch to Google APIs
**Status**: TO-DO (Decision pending)
**Description**: Evaluate switching from OpenAI to Google Gemini/Vision APIs to reduce costs

**Current API Usage**:
- OpenAI: gpt-5.1 (chat), DALL-E (images), gpt-audio (audio) — ~$5-10/tháng
- SerpAPI: Web search — ~$5-20/tháng
- Artificial Studio: Video generation — ~$10-30/tháng
- PDF Generator: PDF export — ~$5-20/tháng
- **TOTAL**: ~$25-80/tháng

**Google Alternative Costs**:
- Google Vision (OCR): $0.0015/image instead of $0.01 (6-7x cheaper)
- Google Gemini (chat): $0.000125/1K tokens instead of $0.0001 (similar)
- Google Vertex AI: $0.50-1.50/tháng for full processing
- **Potential Savings**: 20-30% reduction

**Decision**: Pending user choice (currently using OpenAI)

---

### Knowledge Management Strategy (Current & Future)
**Current Approach** (Phase 1 - Now):
- Manual upload via Settings → Knowledge Base
- Upload JSON, Markdown, CSV files
- Cost: $0
- Method: Settings Upload (Trực Tiếp)

**Future Approach** (Phase 2 - 6-12 months):
- Automatic website/blogger sync
- Continuous learning from live projects
- Cost: $7-15/tháng (depending on volume)
- Method: Website Kết Nối (Auto)

**Hybrid Approach** (Phase 3 - 1+ year):
- Website auto-sync for continuous updates
- Manual Settings upload for fine-tuning/special knowledge
- AI learning "sống" (live) + "chuẩn xác" (accurate)
- Cost: $7-15/tháng
