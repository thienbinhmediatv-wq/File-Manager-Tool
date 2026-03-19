import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

function getStabilityApiKey(): string {
  return process.env.STABILITY_API_KEY_2DCAD || "";
}
const GEN_DIR = path.join(process.cwd(), "public", "generated");

const STABILITY_ENDPOINT_CORE = "https://api.stability.ai/v2beta/stable-image/generate/core";
const STABILITY_ENDPOINT_ULTRA = "https://api.stability.ai/v2beta/stable-image/generate/ultra";

export interface StabilityOptions {
  aspectRatio?: string;
  useUltra?: boolean;
}

async function svgUrlToPngBuffer(svgUrl: string): Promise<Buffer | null> {
  try {
    let svgContent: Buffer;
    if (svgUrl.startsWith("/generated/")) {
      const filePath = path.join(process.cwd(), "public", svgUrl);
      if (!fs.existsSync(filePath)) return null;
      svgContent = fs.readFileSync(filePath);
    } else if (svgUrl.startsWith("http")) {
      const fetchMod = await import("node-fetch");
      const res = await fetchMod.default(svgUrl);
      if (!res.ok) return null;
      svgContent = Buffer.from(await res.arrayBuffer());
    } else {
      svgContent = Buffer.from(svgUrl);
    }
    const pngBuffer = await sharp(svgContent).png().toBuffer();
    return pngBuffer;
  } catch (e) {
    console.error("[stabilityService] svgUrlToPngBuffer error:", e);
    return null;
  }
}

export async function renderWithStabilityAI(
  prompt: string,
  svgBuffer?: Buffer | null,
  opts: StabilityOptions = {}
): Promise<string | null> {
  const apiKey = getStabilityApiKey();
  if (!apiKey) {
    console.warn("[stabilityService] STABILITY_API_KEY_2DCAD not set, skipping Stability AI render");
    return null;
  }

  const endpoint = opts.useUltra ? STABILITY_ENDPOINT_ULTRA : STABILITY_ENDPOINT_CORE;

  try {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("output_format", "png");

    if (opts.aspectRatio) {
      form.append("aspect_ratio", opts.aspectRatio);
    }

    if (svgBuffer) {
      const blob = new Blob([svgBuffer], { type: "image/png" });
      form.append("image", blob, "reference.png");
      form.append("strength", "0.65");
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*",
      },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[stabilityService] API error ${response.status}:`, errText);
      return null;
    }

    const imgBuffer = Buffer.from(await response.arrayBuffer());
    const outFile = path.join(GEN_DIR, `stability_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
    fs.writeFileSync(outFile, imgBuffer);
    const resultUrl = `/generated/${path.basename(outFile)}`;
    console.log("[stabilityService] Stability AI used — result:", resultUrl);
    return resultUrl;
  } catch (e) {
    console.error("[stabilityService] Stability AI render error:", e);
    return null;
  }
}

export async function renderWithStabilityAIFromSvgUrl(
  svgUrl: string | null,
  prompt: string,
  opts: StabilityOptions = {}
): Promise<string | null> {
  let svgBuffer: Buffer | null = null;
  if (svgUrl) {
    svgBuffer = await svgUrlToPngBuffer(svgUrl);
  }
  return renderWithStabilityAI(prompt, svgBuffer, opts);
}
