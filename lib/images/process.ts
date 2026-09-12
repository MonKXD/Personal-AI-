import "server-only";

import sharp, { type Sharp } from "sharp";

/**
 * Server-side image pipeline. Every capture becomes three JPEGs:
 *   - original : full-res (capped), auto-oriented, metadata stripped
 *   - display  : ~1400px long edge, for the memory page + vision model
 *   - thumb    : ~400px long edge, for grids and citation chips
 *
 * Handles HEIC/HEIF (iPhone) transparently. EXIF/GPS is dropped (sharp strips
 * metadata on output unless `withMetadata()` is called).
 */

sharp.concurrency(2);

export type ProcessedImage = {
  original: Buffer;
  display: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  mime: "image/jpeg";
};

const ORIGINAL_MAX = 3000;
const DISPLAY_MAX = 1400;
const THUMB_MAX = 400;

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  // Normalise orientation once; every derivative starts from this.
  const base = sharp(input, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (!srcW || !srcH) {
    throw new Error("unreadable_image");
  }

  const toJpeg = (b: Sharp, max: number, quality: number) =>
    b
      .clone()
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

  const [orig, disp, thb] = await Promise.all([
    toJpeg(base, ORIGINAL_MAX, 90),
    toJpeg(base, DISPLAY_MAX, 82),
    toJpeg(base, THUMB_MAX, 70),
  ]);

  return {
    original: orig.data,
    display: disp.data,
    thumb: thb.data,
    width: disp.info.width,
    height: disp.info.height,
    mime: "image/jpeg",
  };
}
