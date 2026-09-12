import "server-only";

import { reportError } from "@/lib/observe";

/**
 * Rasterise page 1 of a PDF to a PNG buffer, server-side, via MuPDF (WASM —
 * no native binaries, works on the Vercel Node runtime). Best-effort: returns
 * null on any failure, so the capture simply keeps its generic document icon.
 *
 * Mirrors the browser's `renderPdfFirstPage` (lib/pdf-thumb.ts) for capture
 * paths that have no client to do it — the Telegram bot, the share target,
 * the public API. The pipeline downsamples this PNG into display/thumb JPEGs.
 */
export async function renderPdfFirstPage(pdf: Buffer): Promise<Buffer | null> {
  try {
    const mupdf = await import("mupdf");
    const doc = mupdf.Document.openDocument(new Uint8Array(pdf), "application/pdf");
    try {
      if (doc.countPages() < 1) return null;
      const page = doc.loadPage(0);
      // scale 2 ≈ 144 dpi for a Letter page — plenty; processImage() resizes down.
      const pix = page.toPixmap(
        mupdf.Matrix.scale(2, 2),
        mupdf.ColorSpace.DeviceRGB,
        false, // no alpha — flatten onto white
        true, // show annotations
      );
      const png = Buffer.from(pix.asPNG());
      pix.destroy();
      page.destroy();
      return png;
    } finally {
      doc.destroy();
    }
  } catch (e) {
    reportError(e, { where: "pdf-render firstPage" });
    return null;
  }
}
