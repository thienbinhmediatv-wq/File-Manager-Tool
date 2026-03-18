import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { storage } from "./storage";

const ATTACHED_DIR = path.join(process.cwd(), "attached_assets");
const TIMESTAMP = "1773816624596";

function countSamples(text: string): number {
  const matches = text.match(/mẫu\s+\d+/gi) || [];
  return matches.length;
}

interface SpaceConfig {
  contentKeywords: string[];
  filenameKeywords: string[];
  title: string;
  tags: string[];
  spaceType: string;
  fileType: "docx" | "pdf";
}

const SPACE_CONFIGS: SpaceConfig[] = [
  {
    contentKeywords: [],
    filenameKeywords: ["3d", "_3D"],
    title: "BMT Decor \u2013 Danh m\u1ee5c m\u1eabu M\u1eb7t ti\u1ec1n nh\u00e0 2 t\u1ea7ng",
    tags: ["m\u1eb7t ti\u1ec1n", "ngo\u1ea1i th\u1ea5t", "3D", "m\u1eabu thi\u1ebft k\u1ebf", "nh\u00e0 2 t\u1ea7ng"],
    spaceType: "M\u1eb7t ti\u1ec1n nh\u00e0 2 t\u1ea7ng",
    fileType: "docx",
  },
  {
    contentKeywords: ["PHÒNG ĂN", "PH\u00d2NG \u0102N"],
    filenameKeywords: [],
    title: "BMT Decor \u2013 Danh m\u1ee5c m\u1eabu Ph\u00f2ng \u0103n",
    tags: ["ph\u00f2ng \u0103n", "n\u1ed9i th\u1ea5t", "m\u1eabu thi\u1ebft k\u1ebf"],
    spaceType: "Ph\u00f2ng \u0103n",
    fileType: "docx",
  },
  {
    contentKeywords: ["PHÒNG BẾP", "PH\u00d2NG B\u1EEBP"],
    filenameKeywords: [],
    title: "BMT Decor \u2013 Danh m\u1ee5c m\u1eabu Ph\u00f2ng b\u1ebfp",
    tags: ["ph\u00f2ng b\u1ebfp", "n\u1ed9i th\u1ea5t", "m\u1eabu thi\u1ebft k\u1ebf"],
    spaceType: "Ph\u00f2ng b\u1ebfp",
    fileType: "docx",
  },
  {
    contentKeywords: [],
    filenameKeywords: ["WC_"],
    title: "BMT Decor \u2013 Danh m\u1ee5c m\u1eabu WC / Ph\u00f2ng t\u1eafm",
    tags: ["WC", "ph\u00f2ng t\u1eafm", "n\u1ed9i th\u1ea5t", "m\u1eabu thi\u1ebft k\u1ebf"],
    spaceType: "WC / Ph\u00f2ng t\u1eafm",
    fileType: "docx",
  },
  {
    contentKeywords: ["PHÒNG THỜ", "PH\u00d2NG TH\u1edaI"],
    filenameKeywords: [],
    title: "BMT Decor \u2013 Danh m\u1ee5c m\u1eabu Ph\u00f2ng th\u1edd",
    tags: ["ph\u00f2ng th\u1edd", "n\u1ed9i th\u1ea5t", "m\u1eabu thi\u1ebft k\u1ebf"],
    spaceType: "Ph\u00f2ng th\u1edd",
    fileType: "docx",
  },
  {
    contentKeywords: ["SÂN VƯỜN", "S\u00c2N V\u01b0\u1edcN"],
    filenameKeywords: [],
    title: "BMT Decor \u2013 Danh m\u1ee5c m\u1eabu S\u00e2n v\u01b0\u1eddn",
    tags: ["s\u00e2n v\u01b0\u1eddn", "ngo\u1ea1i th\u1ea5t", "m\u1eabu thi\u1ebft k\u1ebf"],
    spaceType: "S\u00e2n v\u01b0\u1eddn",
    fileType: "docx",
  },
  {
    contentKeywords: ["PHÒNG KHÁCH CÓ PHÒNG THỜ", "PH\u00d2NG KH\u00c1CH C\u00d3 PH\u00d2NG TH\u1edaI"],
    filenameKeywords: [],
    title: "BMT Decor \u2013 Danh m\u1ee5c m\u1eabu Ph\u00f2ng kh\u00e1ch c\u00f3 ph\u00f2ng th\u1edd",
    tags: ["ph\u00f2ng kh\u00e1ch", "ph\u00f2ng th\u1edd", "n\u1ed9i th\u1ea5t", "m\u1eabu thi\u1ebft k\u1ebf"],
    spaceType: "Ph\u00f2ng kh\u00e1ch c\u00f3 ph\u00f2ng th\u1edd",
    fileType: "docx",
  },
  {
    contentKeywords: ["PHÒNG KHÁCH KHÔNG CÓ PHÒNG THỜ", "PH\u00d2NG KH\u00c1CH KH\u00d4NG C\u00d3 PH\u00d2NG TH\u1edaI"],
    filenameKeywords: [],
    title: "BMT Decor \u2013 Danh m\u1ee5c m\u1eabu Ph\u00f2ng kh\u00e1ch kh\u00f4ng c\u00f3 ph\u00f2ng th\u1edd",
    tags: ["ph\u00f2ng kh\u00e1ch", "n\u1ed9i th\u1ea5t", "m\u1eabu thi\u1ebft k\u1ebf"],
    spaceType: "Ph\u00f2ng kh\u00e1ch kh\u00f4ng c\u00f3 ph\u00f2ng th\u1edd",
    fileType: "docx",
  },
  {
    contentKeywords: [],
    filenameKeywords: ["Mau_Ket", "QUA"],
    title: "BMT Decor \u2013 H\u1ed3 s\u01a1 d\u1ef1 \u00e1n th\u1ef1c t\u1ebf (M\u1eabu k\u1ebft qu\u1ea3 ho\u00e0n ch\u1ec9nh)",
    tags: ["h\u1ed3 s\u01a1 d\u1ef1 \u00e1n th\u1ef1c t\u1ebf", "m\u1eabu k\u1ebft qu\u1ea3", "h\u1ed3 s\u01a1 ho\u00e0n ch\u1ec9nh", "d\u1ef1 \u00e1n th\u1ef1c t\u1ebf"],
    spaceType: "H\u1ed3 s\u01a1 d\u1ef1 \u00e1n",
    fileType: "pdf",
  },
];

interface FileInfo {
  fileName: string;
  filePath: string;
  content: string;
}

async function scanTargetFiles(): Promise<FileInfo[]> {
  const allFiles = fs.readdirSync(ATTACHED_DIR);
  const targetFiles = allFiles.filter(f => f.includes(TIMESTAMP) && (f.endsWith(".docx") || f.endsWith(".pdf")));
  
  const result: FileInfo[] = [];
  for (const fname of targetFiles) {
    const fpath = path.join(ATTACHED_DIR, fname);
    if (fname.endsWith(".docx")) {
      try {
        const buffer = fs.readFileSync(fpath);
        const extracted = await mammoth.extractRawText({ buffer });
        result.push({ fileName: fname, filePath: fpath, content: extracted.value?.trim() || "" });
      } catch {
        result.push({ fileName: fname, filePath: fpath, content: "" });
      }
    } else {
      result.push({ fileName: fname, filePath: fpath, content: "" });
    }
  }
  return result;
}

function matchConfig(config: SpaceConfig, fileInfo: FileInfo): boolean {
  const ext = config.fileType === "docx" ? ".docx" : ".pdf";
  if (!fileInfo.fileName.endsWith(ext)) return false;

  if (config.filenameKeywords.length > 0) {
    return config.filenameKeywords.some(kw => fileInfo.fileName.includes(kw));
  }

  if (config.contentKeywords.length > 0) {
    const upper = fileInfo.content.toUpperCase();
    return config.contentKeywords.some(kw => {
      const kwUpper = kw.toUpperCase();
      return upper.includes(kwUpper);
    });
  }

  return false;
}

function buildDocxKnowledgeContent(rawText: string, spaceType: string, sampleCount: number): string {
  const sampleList = Array.from({ length: sampleCount }, (_, i) => `  - Mẫu ${i + 1}`).join("\n");
  return `BMT Decor \u2013 Danh m\u1ee5c m\u1eabu thi\u1ebft k\u1ebf: ${spaceType}

S\u1ed1 l\u01b0\u1ee3ng m\u1eabu: ${sampleCount} m\u1eabu thi\u1ebft k\u1ebf 3D

Danh s\u00e1ch m\u1eabu:
${sampleList}

Th\u00f4ng tin: \u0110\u00e2y l\u00e0 b\u1ed9 s\u01b0u t\u1eadp ${sampleCount} m\u1eabu thi\u1ebft k\u1ebf ${spaceType} c\u1ee7a BMT Decor. C\u00e1c m\u1eabu \u0111\u01b0\u1ee3c thi\u1ebft k\u1ebf 3D v\u1edbi phong c\u00e1ch \u0111a d\u1ea1ng ph\u00f9 h\u1ee3p v\u1edbi nhi\u1ec1u phong c\u00e1ch ki\u1ebfn tr\u00fac n\u1ed9i/ngo\u1ea1i th\u1ea5t hi\u1ec7n \u0111\u1ea1i v\u00e0 truy\u1ec1n th\u1ed1ng.

N\u1ed9i dung g\u1ed1c t\u1eeb file:
${rawText}`;
}

function buildPdfKnowledgeContent(): string {
  return `BMT Decor \u2013 H\u1ed3 s\u01a1 d\u1ef1 \u00e1n th\u1ef1c t\u1ebf ho\u00e0n ch\u1ec9nh

\u0110\u00e2y l\u00e0 file h\u1ed3 s\u01a1 d\u1ef1 \u00e1n m\u1eabu c\u1ee7a BMT Decor th\u1ec3 hi\u1ec7n c\u1ea5u tr\u00fac m\u1ed9t h\u1ed3 s\u01a1 thi\u1ebft k\u1ebf ho\u00e0n ch\u1ec9nh bao g\u1ed3m:
- B\u1ea3n v\u1ebd m\u1eb7t b\u1eb1ng 2D (c\u00e1c t\u1ea7ng)
- M\u00f4 h\u00ecnh 3D v\u00e0 ph\u1ed1i c\u1ea3nh
- Thi\u1ebft k\u1ebf n\u1ed9i th\u1ea5t t\u1eebng ph\u00f2ng
- Render ph\u1ed1i c\u1ea3nh ngo\u1ea1i th\u1ea5t v\u00e0 n\u1ed9i th\u1ea5t
- Th\u00f4ng tin k\u1ef9 thu\u1eadt v\u00e0 v\u1eadt li\u1ec7u

File n\u00e0y l\u00e0 t\u00e0i li\u1ec7u tham chi\u1ebfu chu\u1ea9n \u0111\u1ec3 AI hi\u1ec3u c\u1ea5u tr\u00fac v\u00e0 n\u1ed9i dung c\u1ee7a m\u1ed9t h\u1ed3 s\u01a1 thi\u1ebft k\u1ebf ho\u00e0n ch\u1ec9nh theo quy tr\u00ecnh BMT Decor.

L\u01b0u \u00fd: File PDF g\u1ed1c (28MB) ch\u1ee7 y\u1ebfu ch\u1ee9a h\u00ecnh \u1ea3nh render v\u00e0 b\u1ea3n v\u1ebd k\u1ef9 thu\u1eadt, kh\u00f4ng c\u00f3 text layer. N\u1ed9i dung \u0111\u01b0\u1ee3c t\u00f3m t\u1eaft th\u1ee7 c\u00f4ng \u0111\u1ec3 AI c\u00f3 th\u1ec3 tham kh\u1ea3o.`;
}

async function checkDuplicate(title: string): Promise<boolean> {
  const files = await storage.getKnowledgeFiles();
  return files.some(f => f.name === title);
}

export async function importDesignDocuments(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  console.log("[ImportDesignDocs] Starting import of design documents...");

  const fileInfos = await scanTargetFiles();
  console.log("[ImportDesignDocs] Scanned files:", fileInfos.map(f => f.fileName));

  for (const config of SPACE_CONFIGS) {
    const match = fileInfos.find(fi => matchConfig(config, fi));

    if (!match) {
      const msg = `File not found for space: ${config.spaceType} (${config.fileType})`;
      console.warn("[ImportDesignDocs]", msg);
      errors.push(msg);
      continue;
    }

    console.log(`[ImportDesignDocs] Matched: ${config.spaceType} -> ${match.fileName}`);

    const isDuplicate = await checkDuplicate(config.title);
    if (isDuplicate) {
      console.log(`[ImportDesignDocs] Skipping duplicate: ${config.title}`);
      skipped++;
      continue;
    }

    try {
      let content: string;
      if (config.fileType === "docx") {
        const sampleCount = countSamples(match.content);
        content = buildDocxKnowledgeContent(match.content, config.spaceType, sampleCount);
        console.log(`[ImportDesignDocs] ${config.spaceType}: ${sampleCount} samples`);
      } else {
        content = buildPdfKnowledgeContent();
      }

      const stat = fs.statSync(match.filePath);
      const created = await storage.createKnowledgeFile({
        name: config.title,
        originalName: match.fileName,
        content,
        fileType: config.fileType,
        fileSize: stat.size,
        source: "import_script",
      });

      await storage.updateKnowledgeFile(created.id, { tags: config.tags });
      console.log(`[ImportDesignDocs] Imported: ${config.title}`);
      imported++;
    } catch (err) {
      const msg = `Error importing ${match.fileName}: ${err}`;
      console.error("[ImportDesignDocs]", msg);
      errors.push(msg);
    }
  }

  const oversizedPdfs: Array<{ fileName: string; sizeMB: number; reason: string }> = [];
  const allFiles = fs.readdirSync(ATTACHED_DIR);
  const largePdfs = allFiles.filter(f => f.includes(TIMESTAMP) && f.endsWith(".pdf") && (f.includes("Mau_3D_9") || f.includes("Mau_banve_3D_10")));
  for (const fname of largePdfs) {
    const fpath = path.join(ATTACHED_DIR, fname);
    const stat = fs.statSync(fpath);
    const sizeMB = Math.round(stat.size / 1024 / 1024);
    oversizedPdfs.push({ fileName: fname, sizeMB, reason: "File quá lớn (>50MB), chủ yếu là ảnh render, không có text layer" });
    console.warn(`[ImportDesignDocs] Oversized PDF not processed: ${fname} (${sizeMB}MB)`);
  }

  console.log(`[ImportDesignDocs] Done. Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors.length}, Oversized PDFs: ${oversizedPdfs.length}`);
  return { imported, skipped, errors, oversizedPdfs };
}
