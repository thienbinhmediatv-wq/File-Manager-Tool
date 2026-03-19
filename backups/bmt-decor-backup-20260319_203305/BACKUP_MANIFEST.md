# BMT Decor Full Backup Manifest

**Backup Date:** 20260319_203305
**Backup Directory:** bmt-decor-backup-20260319_203305

## ✅ Checklist Đầy Đủ

| Thành phần | Trạng thái | Chi tiết |
|---|---|---|
| Database (PostgreSQL) | ✅ | 2870 dòng SQL |
| client/ (Frontend React) | ✅ | Toàn bộ pages, components, hooks |
| server/ (Backend Express) | ✅ | routes, storage, telegramBot, stabilityService |
| shared/ (Schema Drizzle) | ✅ | schema.ts |
| scripts/ | ✅ | backup.sh, post-merge.sh |
| Config files | ✅ | package.json, vite.config, tailwind, tsconfig |
| Generated assets | ✅ | SVG, renders, PDFs |
| Git history | ✅ | 382 commits |
| .env template | ✅ | Không có secrets thật |
| Archive .tar.gz | ✅ | Nén toàn bộ |

**Tổng files source:** 278 files

## 📁 Cấu trúc Backup

```
bmt-decor-backup-20260319_203305/
├── database-dump.sql        ← Toàn bộ database PostgreSQL
├── generated/               ← SVG, renders, PDFs
├── source/
│   ├── client/              ← Frontend (React + Tailwind)
│   │   └── src/
│   │       ├── pages/       ← ProjectWizard, Settings, Home...
│   │       ├── components/  ← Steps, Layout, UI...
│   │       └── hooks/       ← useToast, etc
│   ├── server/              ← Backend (Express)
│   │   ├── routes.ts        ← API endpoints
│   │   ├── storage.ts       ← Database queries
│   │   ├── telegramBot.ts   ← Telegram bot
│   │   ├── stabilityService.ts ← Stability AI
│   │   ├── geometry/        ← Geometry Engine
│   │   └── cad/             ← CAD SVG Generator
│   ├── shared/
│   │   └── schema.ts        ← Drizzle schema
│   ├── scripts/             ← backup.sh, post-merge.sh
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── drizzle.config.ts
│   └── replit.md
├── git-history.txt          ← 380+ commits lịch sử
├── git-graph.txt            ← Git tree graph
├── .env.example             ← Template env vars
└── BACKUP_MANIFEST.md       ← File này
```

## 🔄 Khôi phục (Restore)

### Full Restore (Replit Project mới):
```bash
# 1. Upload source lên Replit mới (kéo thả folder source/)
# 2. Install dependencies
npm install

# 3. Tạo PostgreSQL database trong Replit > Databases

# 4. Restore database
psql $DATABASE_URL < database-dump.sql

# 5. Restore generated files
cp -r generated/* public/generated/

# 6. Set environment variables (theo .env.example)

# 7. Push schema
npm run db:push

# 8. Start
npm run dev
```

## 📊 Dữ liệu

- Projects: 19 dự án (có đầy đủ step data, geometry, renders)
- Knowledge Files: 85 files (1,474 vector chunks)
- Chat histories: Toàn bộ lịch sử trò chuyện
- Settings: AI instructions, knowledge base config

---
**BMT Decor Backup — Đầy đủ 100%**
