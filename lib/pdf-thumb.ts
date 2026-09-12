"use client";

/**
 * Render page 1 of a PDF to a small JPEG, in the browser. pdfjs-dist is
 * imported lazily so it (and its worker) only load when someone actually
 * uploads a PDF. Best-effort: returns null on any failure — the capture
 * still works, it just falls back to the generic document icon.
 */
export async function renderPdfFirstPage(
  file: File | Blob,
  maxEdge = 900,
): Promise<Blob | null> {
  try {
    const pdfjs = await import("pdfjs-dist");
    // Turbopack/webpack resolve `new URL(asset, import.meta.url)` to a served file.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf, disableAutoFetch: true }).promise;
    const page = await doc.getPage(1);

    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1.6, maxEdge / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    page.cleanup();

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82),
    );
  } catch {
    return null;
  }
}
