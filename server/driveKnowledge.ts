import { ReplitConnectors } from "@replit/connectors-sdk";
import { storage } from "./storage";

const DEFAULT_FOLDER_ID = "1bX8XfBMq_l3oFT3edht2RLlddHiYLbaK";
const connectors = new ReplitConnectors();

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
}

interface CachedKnowledge {
  files: DriveFile[];
  textContents: Map<string, string>;
  lastFetched: number;
}

let cache: CachedKnowledge | null = null;
const CACHE_TTL = 30 * 60 * 1000;
const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function isTextFile(name: string): boolean {
  const lower = name.toLowerCase();
  return TEXT_EXTENSIONS.some(ext => lower.endsWith(ext));
}

async function listFilesFromFolder(folderId: string): Promise<DriveFile[]> {
  try {
    const response = await connectors.proxy(
      "google-drive",
      `/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size)&pageSize=100`,
      { method: "GET" }
    );
    const data = await response.json() as { files: DriveFile[] };
    return data.files || [];
  } catch (err) {
    console.error(`Drive list files error for folder ${folderId}:`, err);
    return [];
  }
}

export async function listDriveFiles(): Promise<DriveFile[]> {
  const folders = await storage.getDriveFolders();
  const defaultFolder = folders.length === 0 ? [{ id: 0, name: "Default", folderId: DEFAULT_FOLDER_ID, createdAt: new Date() }] : folders;
  
  let allFiles: DriveFile[] = [];
  for (const folder of defaultFolder) {
    const files = await listFilesFromFolder(folder.folderId);
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
        if (totalChars + snippet.length > 10000) break;
        snippets.push(`--- [Drive] ${name} ---\n${snippet}`);
        totalChars += snippet.length;
      }
      return snippets.length > 0 ? `\n\nTri thức từ Google Drive (BMT Decor):\n${snippets.join("\n\n")}` : "";
    }

    const files = await listDriveFiles();
    const textFiles = files.filter(f => isTextFile(f.name) && parseInt(f.size) < MAX_FILE_SIZE);
    const textContents = new Map<string, string>();

    for (const f of textFiles.slice(0, 10)) {
      const content = await fetchFileContent(f.id);
      if (content) textContents.set(f.name, content);
    }

    cache = { files, textContents, lastFetched: Date.now() };

    const snippets: string[] = [];
    let totalChars = 0;
    for (const [name, content] of textContents) {
      const snippet = content.slice(0, 3000);
      if (totalChars + snippet.length > 10000) break;
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
