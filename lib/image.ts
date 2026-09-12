/**
 * Client-side capture-file helpers. Images get downscaled before upload so
 * we never ship a 12-megapixel phone photo to the server or the vision
 * model; PDFs/Word/PowerPoint upload as-is (lib/pipeline/create-capture.ts
 * has the authoritative per-kind size caps — the ones here are just for
 * early, friendly client-side feedback). See docs/02-TRD.md §8 and
 * docs/06-RULES.md §9.
 */

export const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/tiff",
];
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const DOCUMENT_TYPES = ["application/pdf", DOCX_MIME, PPTX_MIME];

const MAX_BYTES_BY_KIND: Record<"image" | "document", number> = {
  image: 20 * 1024 * 1024,
  document: 40 * 1024 * 1024,
};

export const FILE_INPUT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,.heic,.heif,.pdf,.docx,.pptx,application/pdf," +
  `${DOCX_MIME},${PPTX_MIME}`;

export type PreparedImage = {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  originalName: string;
};

async function loadBitmap(source: Blob): Promise<ImageBitmap> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(source);
  }
  // Fallback via <img>
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // @ts-expect-error – older browsers
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareImage(
  file: File,
  { maxEdge = 1600, quality = 0.85 }: { maxEdge?: number; quality?: number } = {},
): Promise<PreparedImage> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality,
    ),
  );
  const dataUrl = canvas.toDataURL("image/jpeg", quality);

  return { blob, dataUrl, width, height, originalName: file.name };
}

export type FileKind = "image" | "document" | "unsupported";

/** Extension fallback matters here — some browsers report an empty
 * `file.type` for HEIC, and Windows sometimes reports docx/pptx as a
 * generic zip mimetype. */
export function classifyFileKind(file: File): FileKind {
  const looksHeic = /\.(heic|heif)$/i.test(file.name);
  const looksDocx = /\.docx$/i.test(file.name);
  const looksPptx = /\.pptx$/i.test(file.name);
  const looksPdf = /\.pdf$/i.test(file.name);
  if (IMAGE_TYPES.includes(file.type) || looksHeic) return "image";
  if (DOCUMENT_TYPES.includes(file.type) || looksDocx || looksPptx || looksPdf) return "document";
  return "unsupported";
}

export function validateFile(file: File): string | null {
  const kind = classifyFileKind(file);
  if (kind === "unsupported") {
    return "That file type isn't supported. Use a JPG, PNG, WebP, HEIC image, a PDF, or a Word/PowerPoint (.docx/.pptx) file.";
  }
  const max = MAX_BYTES_BY_KIND[kind];
  if (file.size > max) {
    return `That file is over ${max / 1024 / 1024} MB.`;
  }
  return null;
}
