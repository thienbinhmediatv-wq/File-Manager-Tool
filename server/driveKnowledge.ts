import { ReplitConnectors } from "@replit/connectors-sdk";
import { storage } from "./storage";
import { extractTextFromPdf, extractTextFromDocx, extractTextFromImage, getFileType } from "./ocrService";

const DEFAULT_FOLDER_ID = "1bX8XfBMq_l3oFT3edht2RLlddHiYLbaK";
const connectors = new ReplitConnectors();

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  shortcutDetails?: { targetId: string; targetMimeType: string };
}

interface CachedKnowledge {
  files: DriveFile[];
  textContents: Map<string, string>;
  lastFetched: number;
}

let cache: CachedKnowledge | null = null;
const CACHE_TTL = 30 * 60 * 1000;
const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_DEPTH = 5;

function isTextFile(name: string): boolean {
  const lower = name.toLowerCase();
  return TEXT_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function isProcessableFile(name: string): boolean {
  const type = getFileType(name);
  return type === "pdf" || type === "docx" || type === "image" || type === "text";
}

export interface OcrProgress {
  total: number;
  processed: number;
  current: string;
  results: { name: string; chars: number; status: "ok" | "empty" | "error" }[];
  done: boolean;
}

let ocrProgress: OcrProgress | null = null;

export function getOcrProgress(): OcrProgress | null {
  return ocrProgress;
}

export async function processAllDriveFiles(): Promise<OcrProgress> {
  if (ocrProgress && !ocrProgress.done) {
    return ocrProgress;
  }

  const files = await listDriveFiles();
  const processable = files.filter(f => isProcessableFile(f.name));

  ocrProgress = {
    total: processable.length,
    processed: 0,
    current: "",
    results: [],
    done: false,
  };

  (async () => {
    for (const file of processable) {
      ocrProgress!.current = file.name;

      try {
        const type = getFileType(file.name);
        let text = "";

        if (type === "pdf") {
          text = await extractTextFromPdf(file.id, file.name);
        } else if (type === "docx") {
          text = await extractTextFromDocx(file.id, file.name);
        } else if (type === "image") {
          text = await extractTextFromImage(file.id, file.name);
        } else if (type === "text") {
          const response = await connectors.proxy("google-drive", `/drive/v3/files/${file.id}?alt=media`, { method: "GET" });
          text = await response.text();
        }

        if (text && text.length > 50) {
          const safeName = file.name.replace(/\//g, "_");
          const existing = (await storage.getKnowledgeFiles()).find(f => f.originalName === file.name);
          if (existing) {
            await storage.deleteKnowledgeFile(existing.id);
          }
          await storage.createKnowledgeFile({
            name: safeName,
            originalName: file.name,
            content: text.slice(0, 100000),
            fileType: getFileType(file.name),
            fileSize: text.length,
          });
          ocrProgress!.results.push({ name: file.name, chars: text.length, status: "ok" });
        } else {
          ocrProgress!.results.push({ name: file.name, chars: 0, status: "empty" });
        }
      } catch (err) {
        console.error(`OCR process error for ${file.name}:`, err);
        ocrProgress!.results.push({ name: file.name, chars: 0, status: "error" });
      }

      ocrProgress!.processed++;
    }

    ocrProgress!.done = true;
    ocrProgress!.current = "";
    clearDriveCache();
    console.log("[OCR] All files processed!");
  })();

  return ocrProgress;
}

function isFolder(mimeType: string): boolean {
  return mimeType === "application/vnd.google-apps.folder";
}

function isShortcut(mimeType: string): boolean {
  return mimeType === "application/vnd.google-apps.shortcut";
}

async function listFilesFromFolder(folderId: string): Promise<DriveFile[]> {
  try {
    const response = await connectors.proxy(
      "google-drive",
      `/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size,shortcutDetails)&pageSize=200`,
      { method: "GET" }
    );
    const data = await response.json() as { files: DriveFile[] };
    return data.files || [];
  } catch (err) {
    console.error(`Drive list files error for folder ${folderId}:`, err);
    return [];
  }
}

async function listFilesRecursive(folderId: string, prefix: string = "", depth: number = 0): Promise<DriveFile[]> {
  if (depth > MAX_DEPTH) return [];

  const items = await listFilesFromFolder(folderId);
  let allFiles: DriveFile[] = [];

  for (const item of items) {
    const displayName = prefix ? `${prefix}/${item.name}` : item.name;

    if (isFolder(item.mimeType)) {
      const subFiles = await listFilesRecursive(item.id, displayName, depth + 1);
      allFiles = allFiles.concat(subFiles);
    } else if (isShortcut(item.mimeType) && item.shortcutDetails) {
      if (item.shortcutDetails.targetMimeType === "application/vnd.google-apps.folder") {
        const subFiles = await listFilesRecursive(item.shortcutDetails.targetId, displayName, depth + 1);
        allFiles = allFiles.concat(subFiles);
      } else {
        allFiles.push({ ...item, id: item.shortcutDetails.targetId, name: displayName });
      }
    } else {
      allFiles.push({ ...item, name: displayName });
    }
  }

  return allFiles;
}

export async function listDriveFiles(): Promise<DriveFile[]> {
  const folders = await storage.getDriveFolders();
  const folderList = folders.length === 0
    ? [{ id: 0, name: "Default", folderId: DEFAULT_FOLDER_ID, createdAt: new Date() }]
    : folders;

  let allFiles: DriveFile[] = [];
  for (const folder of folderList) {
    const files = await listFilesRecursive(folder.folderId, folder.name);
    allFiles = allFiles.concat(files);
  }
  return allFiles;
}

async function fetchFileContent(fileId: string): Promise<string> {
  try {
    const response = await connectors.proxy(
      "google-drive",
      `/drive/v3/files/${fileId}?alt=media`,
      { method: "GET" }
    );
    const text = await response.text();
    return text.slice(0, MAX_FILE_SIZE);
  } catch (err) {
    console.error("Drive fetch file error:", err);
    return "";
  }
}

export async function getDriveKnowledge(): Promise<string> {
  try {
    if (cache && Date.now() - cache.lastFetched < CACHE_TTL) {
      const snippets: string[] = [];
      let totalChars = 0;
      for (const [name, content] of cache.textContents) {
        const snippet = content.slice(0, 3000);
        if (totalChars + snippet.length > 15000) break;
        snippets.push(`--- [Drive] ${name} ---\n${snippet}`);
        totalChars += snippet.length;
      }
      return snippets.length > 0 ? `\n\nTri thức từ Google Drive (BMT Decor):\n${snippets.join("\n\n")}` : "";
    }

    const files = await listDriveFiles();
    const textFiles = files.filter(f => isTextFile(f.name) && (!f.size || parseInt(f.size) < MAX_FILE_SIZE));
    const textContents = new Map<string, string>();

    for (const f of textFiles.slice(0, 20)) {
      const content = await fetchFileContent(f.id);
      if (content) textContents.set(f.name, content);
    }

    cache = { files, textContents, lastFetched: Date.now() };

    const snippets: string[] = [];
    let totalChars = 0;
    for (const [name, content] of textContents) {
      const snippet = content.slice(0, 3000);
      if (totalChars + snippet.length > 15000) break;
      snippets.push(`--- [Drive] ${name} ---\n${snippet}`);
      totalChars += snippet.length;
    }
    return snippets.length > 0 ? `\n\nTri thức từ Google Drive (BMT Decor):\n${snippets.join("\n\n")}` : "";
  } catch (err) {
    console.error("Drive knowledge error:", err);
    return "";
  }
}

export function clearDriveCache(): void {
  cache = null;
}
