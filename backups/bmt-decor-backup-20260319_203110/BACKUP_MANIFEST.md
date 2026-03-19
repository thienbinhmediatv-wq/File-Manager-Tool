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
