import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

async function downloadFileBuffer(fileId: string): Promise<Buffer | null> {
  try {
    const response = await connectors.proxy(
      "google-drive",
      `/drive/v3/files/${fileId}?alt=media`,
      { method: "GET" }
    );
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("Download file error:", err);
    return null;
  }
}

export async function extractTextFromPdf(fileId: string, fileName: string): Promise<string> {
  try {
    const buffer = await downloadFileBuffer(fileId);
    if (!buffer) return "";

    const pdfParseModule = await import("pdf-parse");
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const data = await pdfParse(buffer);
    const text = data.text?.trim() || "";

    if (text.length > 100) {
      console.log(`[OCR] PDF text extracted (${text.length} chars): ${fileName}`);
      return text;
    }

    console.log(`[OCR] PDF has no extractable text (image-based), skipping: ${fileName}`);
    return "";
  } catch (err) {
    console.error(`[OCR] PDF extract error for ${fileName}:`, err);
    return "";
  }
}

async function ocrImagePdf(buffer: Buffer, fileName: string): Promise<string> {
  console.log(`[OCR] Image-based PDF detected (no text layer): ${fileName} - requires external PDF-to-image conversion`);
  return "";
}

export async function extractTextFromDocx(fileId: string, fileName: string): Promise<string> {
  try {
    const buffer = await downloadFileBuffer(fileId);
    if (!buffer) return "";

    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value?.trim() || "";
    console.log(`[OCR] DOCX extracted (${text.length} chars): ${fileName}`);
    return text;
  } catch (err) {
    console.error(`[OCR] DOCX extract error for ${fileName}:`, err);
    return "";
  }
}

export async function extractTextFromImage(fileId: string, fileName: string): Promise<string> {
  try {
    const buffer = await downloadFileBuffer(fileId);
    if (!buffer) return "";

    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("vie+eng");
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();

    console.log(`[OCR] Image OCR extracted (${text.length} chars): ${fileName}`);
    return text.trim();
  } catch (err) {
    console.error(`[OCR] Image OCR error for ${fileName}:`, err);
    return "";
  }
}

export function getFileType(name: string): "pdf" | "docx" | "image" | "text" | "unknown" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "docx";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) return "image";
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv") || lower.endsWith(".json") || 
      lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".pptx") || lower.endsWith(".ppt")) return "text";
  return "unknown";
}
