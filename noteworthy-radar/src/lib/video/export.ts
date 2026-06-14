import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BRAND_HANDLE } from "@/lib/constants";

export interface BlurBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderOptions {
  inputBuffer: Buffer;
  inputFileName: string;
  topLabel: string;
  captionText: string;
  creditLine: string;
  blurBoxes: BlurBox[];
}

export interface RenderResult {
  status: "rendered" | "stubbed";
  outputBuffer?: Buffer;
  note?: string;
}

const TARGET_W = 1080;
const TARGET_H = 1920;

const FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/System/Library/Fonts/Helvetica.ttc",
  "/Library/Fonts/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
];

function findFont(): string | null {
  return FONT_CANDIDATES.find((p) => existsSync(p)) ?? null;
}

/** Escapes text for ffmpeg drawtext. */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\u2019")
    .replace(/%/g, "\\%")
    .replace(/\n/g, " ");
}

/**
 * Renders a 9:16 branded clip with burned-in label, caption, credit, and
 * optional blur boxes. If FFmpeg or a usable font is unavailable, returns a
 * "stubbed" result so the caller records intent without failing the request.
 */
export async function renderVerticalExport(opts: RenderOptions): Promise<RenderResult> {
  let ffmpegPath: string | null = null;
  let ffmpeg: typeof import("fluent-ffmpeg");
  try {
    // Lazy-load native deps so the rest of the app builds without them.
    const ffmpegStatic = (await import("ffmpeg-static")).default as unknown as string;
    ffmpeg = (await import("fluent-ffmpeg")).default;
    ffmpegPath = ffmpegStatic;
    if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
  } catch (err) {
    return { status: "stubbed", note: `FFmpeg unavailable: ${(err as Error).message}` };
  }

  const font = findFont();
  if (!font) {
    return {
      status: "stubbed",
      note: "No usable system font found for text overlay; recorded export intent without rendering.",
    };
  }

  const dir = await mkdtemp(join(tmpdir(), "radar-export-"));
  const inputPath = join(dir, opts.inputFileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "input.mp4");
  const outputPath = join(dir, "export.mp4");

  try {
    await writeFile(inputPath, opts.inputBuffer);

    // Base: fit into 1080x1920, pad with black bars.
    const filters: string[] = [
      `[0:v]scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=decrease,pad=${TARGET_W}:${TARGET_H}:(ow-iw)/2:(oh-ih)/2:color=black[base]`,
    ];
    let last = "base";

    opts.blurBoxes.forEach((b, i) => {
      const x = Math.round(b.x * TARGET_W);
      const y = Math.round(b.y * TARGET_H);
      const w = Math.max(8, Math.round(b.w * TARGET_W));
      const h = Math.max(8, Math.round(b.h * TARGET_H));
      const blurLabel = `blur${i}`;
      // Crop region, blur it, overlay back at the same position.
      filters.push(
        `[${last}]crop=${w}:${h}:${x}:${y},boxblur=20:2[cb${i}]`,
        `[${last}][cb${i}]overlay=${x}:${y}[${blurLabel}]`,
      );
      last = blurLabel;
    });

    const drawables: string[] = [];
    if (opts.topLabel.trim()) {
      drawables.push(
        `drawtext=fontfile='${font}':text='${esc(opts.topLabel)}':fontcolor=white:fontsize=54:box=1:boxcolor=red@0.85:boxborderw=18:x=(w-text_w)/2:y=80`,
      );
    }
    if (opts.captionText.trim()) {
      drawables.push(
        `drawtext=fontfile='${font}':text='${esc(opts.captionText)}':fontcolor=white:fontsize=40:box=1:boxcolor=black@0.7:boxborderw=22:x=(w-text_w)/2:y=h-360:line_spacing=8`,
      );
    }
    const credit = opts.creditLine.trim() || `${BRAND_HANDLE}`;
    drawables.push(
      `drawtext=fontfile='${font}':text='${esc(credit)}':fontcolor=white:fontsize=30:box=1:boxcolor=black@0.6:boxborderw=12:x=(w-text_w)/2:y=h-150`,
    );
    drawables.push(
      `drawtext=fontfile='${font}':text='${esc(BRAND_HANDLE)}':fontcolor=white@0.85:fontsize=28:x=(w-text_w)/2:y=h-90`,
    );

    filters.push(`[${last}]${drawables.join(",")}[outv]`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(filters, "outv")
        .outputOptions(["-map", "0:a?", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-movflags", "+faststart", "-t", "60"])
        .on("end", () => resolve())
        .on("error", (e: Error) => reject(e))
        .save(outputPath);
    });

    const outputBuffer = await readFile(outputPath);
    return { status: "rendered", outputBuffer };
  } catch (err) {
    return { status: "stubbed", note: `Render failed, recorded intent: ${(err as Error).message}` };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
