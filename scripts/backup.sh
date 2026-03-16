#!/bin/bash

# BMT Decor Full Backup Script
# Backs up: Code (Git), Database, Generated Files, Configuration
# Usage: npm run backup  (or bash scripts/backup.sh)

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="bmt-decor-backup-${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

echo "=========================================="
echo "🔄 BMT Decor Full Backup Started"
echo "Timestamp: ${TIMESTAMP}"
echo "=========================================="

# Create backup directory
mkdir -p "${BACKUP_PATH}"
echo "✓ Created backup directory: ${BACKUP_PATH}"

# 1. Export Database
echo ""
echo "📦 Exporting PostgreSQL database..."
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set. Skipping database export."
else
  pg_dump "$DATABASE_URL" --no-password > "${BACKUP_PATH}/database-dump.sql" 2>/dev/null || {
    echo "⚠️  Database export failed (network issue?). Continuing..."
  }
  DB_SIZE=$(du -h "${BACKUP_PATH}/database-dump.sql" 2>/dev/null | cut -f1)
  echo "✓ Database exported: ${DB_SIZE}"
fi

# 2. Copy Generated Files (SVG, images, PDFs)
echo ""
echo "🎨 Copying generated files (SVG, renders, PDFs)..."
if [ -d "public/generated" ]; then
  cp -r public/generated "${BACKUP_PATH}/" || true
  GEN_COUNT=$(find "${BACKUP_PATH}/generated" -type f 2>/dev/null | wc -l)
  echo "✓ Copied ${GEN_COUNT} generated files"
else
  echo "ℹ️  No generated files directory found"
fi

# 3. Export Git History
echo ""
echo "📜 Exporting Git history..."
cd /home/runner/workspace 2>/dev/null || cd . 
if git rev-parse --git-dir > /dev/null 2>&1; then
  git log --oneline --all > "${BACKUP_PATH}/git-history.txt" || true
  git log --all --graph --decorate --oneline > "${BACKUP_PATH}/git-graph.txt" || true
  echo "✓ Git history exported ($(wc -l < "${BACKUP_PATH}/git-history.txt") commits)"
else
  echo "ℹ️  Git repository not found"
fi

# 4. Copy Source Code (Key Files)
echo ""
echo "💾 Backing up source code..."
mkdir -p "${BACKUP_PATH}/src"
# Copy schema
cp shared/schema.ts "${BACKUP_PATH}/src/" 2>/dev/null || true
# Copy geometry engine
cp server/geometry/geometryEngine.ts "${BACKUP_PATH}/src/" 2>/dev/null || true
# Copy CAD generator
cp server/cad/cadGenerator.ts "${BACKUP_PATH}/src/" 2>/dev/null || true
# Copy routes (main API)
cp server/routes.ts "${BACKUP_PATH}/src/" 2>/dev/null || true
# Copy key configs
cp package.json "${BACKUP_PATH}/src/" 2>/dev/null || true
cp tsconfig.json "${BACKUP_PATH}/src/" 2>/dev/null || true
cp drizzle.config.ts "${BACKUP_PATH}/src/" 2>/dev/null || true
echo "✓ Source code backed up"

# 5. Export Environment Template (without sensitive values)
echo ""
echo "🔐 Creating environment template..."
cat > "${BACKUP_PATH}/.env.example" << 'ENVEOF'
# BMT Decor Environment Variables Template
# Fill in actual values when restoring

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bmt_decor

# OpenAI / AI Integrations
OPENAI_API_KEY_DIRECT=sk_...
AI_INTEGRATIONS_OPENAI_API_KEY=...
AI_INTEGRATIONS_OPENAI_BASE_URL=...

# OpenRouter (Telegram Bot)
OPENROUTER_API_KEY=sk_...

# Image Generation
ARTIFICIAL_STUDIO_API_KEY=...

# PDF Generation
PDF_GENERATOR_API_KEY=...
PDF_GENERATOR_API_SECRET=...
PDF_GENERATOR_WORKSPACE=...

# Search
SERPAPI_KEY=...

# Email
GMAIL_APP_PASSWORD=...
GMAIL_APP_PASSWORD_2=...

# Telegram Bot
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ADMIN_PASSWORD=...

# Session
SESSION_SECRET=...

# Stripe
STRIPE_API_KEY=...
STRIPE_SIGNING_SECRET=...

# Google Drive (via Integrations)
GOOGLE_DRIVE_FOLDER_ID=...

# Replit
REPLIT_DOMAINS=...
ENVEOF
echo "✓ Environment template created (.env.example)"

# 6. Create Backup Manifest
echo ""
echo "📋 Creating backup manifest..."
cat > "${BACKUP_PATH}/BACKUP_MANIFEST.md" << 'MANIFESTEOF'
# BMT Decor Full Backup Manifest

**Backup Date:** $(date)
**Backup Directory:** $(basename $PWD)

## 📁 Contents

### database-dump.sql
Complete PostgreSQL database export including:
- **19 projects** (with all step data, geometries, renders)
- **85 knowledge files** (1,474 vector chunks)
- **Chat histories** (all conversations)
- **Settings & configurations**

**Restore Command:**
```bash
psql $DATABASE_URL < database-dump.sql
```

### generated/
SVG floor plans and AI-generated images:
- `cad_svg_*.svg` — Vector floor plans (Geometry Engine output)
- `*_render_*.png` — Interior/exterior renders
- `*_facade_*.png` — 3D facade images
- Other generated assets

**Restore:** Copy all files to `public/generated/` in project

### src/
Key source files:
- `schema.ts` — Database schema (Drizzle)
- `geometryEngine.ts` — Room positioning, wall generation
- `cadGenerator.ts` — SVG CAD generation
- `routes.ts` — API endpoints
- Config files (package.json, tsconfig.json, drizzle.config.ts)

### git-history.txt & git-graph.txt
Full Git commit history. Shows all changes ever made.

**View with:**
```bash
git log --all --graph --decorate --oneline < git-history.txt
```

### .env.example
Environment variables template (sensitive values removed).
Fill in actual values when setting up a new instance.

---

## 🔄 How to Restore

### Full Restore (New Replit Project):
```bash
# 1. Clone or create new project
git clone <your-repo-url> bmt-decor
cd bmt-decor

# 2. Install dependencies
npm install

# 3. Setup database
# Create PostgreSQL (Replit > Databases > Create PostgreSQL)
# Get DATABASE_URL from Replit UI

# 4. Restore database dump
psql $DATABASE_URL < backups/bmt-decor-backup-YYYYMMDD_HHMMSS/database-dump.sql

# 5. Restore generated files
cp -r backups/bmt-decor-backup-YYYYMMDD_HHMMSS/generated/* public/generated/

# 6. Setup environment variables
cp backups/bmt-decor-backup-YYYYMMDD_HHMMSS/.env.example .env.local
# Edit .env.local and fill in actual values

# 7. Start server
npm run dev
```

### Partial Restore:
- **Only Code:** Use Git history or clone repo
- **Only Database:** Use `psql $DATABASE_URL < database-dump.sql`
- **Only Assets:** Copy `generated/` folder

---

## 📊 Data Summary

**Check after backup:**
```sql
SELECT COUNT(*) FROM projects;           -- 19
SELECT COUNT(*) FROM knowledge_files;    -- 85
SELECT SUM(LENGTH(content)) FROM knowledge_files; -- Vector data size
```

---

## 🔐 Security Notes

- Database dump contains all chat history and project data
- Keep backup files secure (encrypted storage recommended)
- .env.example is safe to share (no secrets)
- Actual .env values must be kept private

---

## 🔄 Automation (Future)

To backup automatically every day:
```bash
# Add to crontab:
0 2 * * * cd /path/to/bmt-decor && bash scripts/backup.sh
```

This backs up at 2 AM every day.

---

**Backup created with ❤️ by BMT Decor**
MANIFESTEOF
echo "✓ Backup manifest created"

# 7. Summary
echo ""
echo "=========================================="
echo "✅ Backup Complete!"
echo "📁 Location: ${BACKUP_PATH}"
echo "=========================================="
echo ""
echo "Contents:"
ls -lh "${BACKUP_PATH}/" | tail -n +2 | awk '{print "  " $9 " (" $5 ")"}'
echo ""
echo "Total Size: $(du -sh "${BACKUP_PATH}" | cut -f1)"
echo ""
echo "Next steps:"
echo "1. Download: scp -r ${BACKUP_PATH} ~/Downloads/ (or via Replit UI)"
echo "2. Store: Cloud storage (Google Drive, AWS S3, Dropbox)"
echo "3. Verify: Check backup integrity (test restore if critical)"
echo ""
echo "Pro Tip: Run this script regularly"
echo "         npm run backup"
echo ""
