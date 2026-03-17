import Replicate from "replicate";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const REPLICATE_API_TOKEN = process.env.CAD_API_KEY || "";

const GEN_DIR = path.join(process.cwd(), "public", "generated");

async function svgToPngBuffer(svgUrlOrPath: string): Promise<Buffer | null> {
  try {
    let svgContent: Buffer;
    if (svgUrlOrPath.startsWith("/generated/")) {
      const filePath = path.join(process.cwd(), "public", svgUrlOrPath);
      if (!fs.existsSync(filePath)) return null;
      svgContent = fs.readFileSync(filePath);
    } else if (svgUrlOrPath.startsWith("http")) {
      const fetchMod = await import("node-fetch");
      const res = await fetchMod.default(svgUrlOrPath);
      if (!res.ok) return null;
      svgContent = Buffer.from(await res.arrayBuffer());
    } else {
      svgContent = Buffer.from(svgUrlOrPath);
    }
    const pngBuffer = await sharp(svgContent).png().toBuffer();
    return pngBuffer;
  } catch (e) {
    console.error("[replicateService] svgToPngBuffer error:", e);
    return null;
  }
}

async function bufferToDataUrl(buffer: Buffer, mimeType = "image/png"): Promise<string> {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function renderWithControlNet(
  svgUrl: string,
  prompt: string,
  projectId: number,
  name: string
): Promise<string | null> {
  if (!REPLICATE_API_TOKEN) {
    console.warn("[replicateService] CAD_API_KEY not set, skipping Replicate render");
    return null;
  }

  try {
    const pngBuffer = await svgToPngBuffer(svgUrl);
    if (!pngBuffer) {
      console.warn("[replicateService] Could not convert SVG to PNG");
      return null;
    }

    const conditioningDataUrl = await bufferToDataUrl(pngBuffer);

    const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

    const output = await replicate.run(
      "jagilley/controlnet-scribble:435061a1b5a4c1e26740464bf786efdfa9cb3a3ac488595a2de23e143fdb0117",
      {
        input: {
          image: conditioningDataUrl,
          prompt,
          num_samples: "1",
          image_resolution: "512",
          detect_resolution: 512,
          ddim_steps: 20,
          scale: 9,
          seed: Math.floor(Math.random() * 2147483647),
          eta: 0,
          a_prompt: "best quality, extremely detailed, photorealistic architecture",
          n_prompt: "longbody, lowres, bad anatomy, bad hands, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality",
        },
      }
    ) as string[] | string;

    const resultUrl = Array.isArray(output) ? output[0] : output;
    if (!resultUrl) return null;

    const fetchMod = await import("node-fetch");
    const imgRes = await fetchMod.default(resultUrl);
    if (!imgRes.ok) return null;
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    const outFile = path.join(GEN_DIR, `replicate_${projectId}_${name}_${Date.now()}.png`);
    fs.writeFileSync(outFile, imgBuffer);
    return `/generated/${path.basename(outFile)}`;
  } catch (e) {
    console.error("[replicateService] Replicate render error:", e);
    return null;
  }
}
