import "server-only";

import { after } from "next/server";
import { createHash } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { CAPTURES_BUCKET, createAdminClient } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/http";
import { newId } from "@/lib/ids";
import {
  countCapturesSince,
  findCaptureBySha,
  insertCapture,
} from "@/lib/db/queries";
import { captureObjectKey, createUploadUrl } from "@/lib/storage";
import { runPipeline } from "@/lib/pipeline/run";
import { getEnv } from "@/lib/env";
import { isDemoUser, DEMO_READONLY_MESSAGE } from "@/lib/demo";
import { startOfUtcDayForTz } from "@/lib/time";
import type { CaptureStatus } from "@/lib/memory-types";

/**
 * Capture intake, in two calls so the file's bytes never pass through a
 * Vercel function (hard 4.5MB body limit — see docs/15-BUILD-LOG.md):
 *   1. beginCaptureUpload() — auth + daily cap + dedupe, mints a signed
 *      Storage upload URL. The browser PUTs the file straight to Storage.
 *   2. finishCaptureUpload() — tiny JSON body, inserts the capture row
 *      (the file is already sitting in Storage by now) and kicks off the
 *      pipeline.
 *
 * share-target (app/share-target/route.ts) is the one exception: the OS
 * share sheet POSTs the file's bytes directly to our origin, so it's bound
 * by the 4.5MB limit no matter what we do — createCaptureFromServerBytes()
 * keeps the old single-call flow for that one caller, which already has
 * the bytes in hand.
 */

const MAX_BYTES: Record<"image" | "audio" | "pdf" | "office", number> = {
  image: 20 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
  pdf: 40 * 1024 * 1024,
  office: 25 * 1024 * 1024,
};

const ACCEPTED_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/tiff",
]);
const ACCEPTED_AUDIO = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"]);
const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const ACCEPTED_OFFICE = new Set([DOCX_MIME, PPTX_MIME]);

export type CaptureKind = "image" | "audio" | "pdf" | "office";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
  "image/avif": "avif",
  "image/tiff": "tiff",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  [PDF_MIME]: "pdf",
  [DOCX_MIME]: "docx",
  [PPTX_MIME]: "pptx",
};

/** Normalizes a File/Blob's reported type (strips `;codecs=...` etc.) and
 * classifies it, throwing a friendly 415 for anything unrecognized. */
export function classifyMime(rawMime: string): { mime: string; kind: CaptureKind } {
  const mime = (rawMime || "image/jpeg").split(";")[0].trim();
  if (ACCEPTED_IMAGE.has(mime)) return { mime, kind: "image" };
  if (ACCEPTED_AUDIO.has(mime)) return { mime, kind: "audio" };
  if (mime === PDF_MIME) return { mime, kind: "pdf" };
  if (ACCEPTED_OFFICE.has(mime)) return { mime, kind: "office" };
  throw new HttpError(
    415,
    "unsupported_media_type",
    "Unsupported file type. Use JPG, PNG, WebP, HEIC, a voice recording, a PDF, or a Word/PowerPoint (.docx/.pptx) file.",
  );
}

/** Deterministic from (userId, captureId, mime) alone — begin and finish
 * independently agree on the same key without sharing any state. */
export function originalKeyFor(userId: string, captureId: string, mime: string): string {
  const ext = EXT_BY_MIME[mime] ?? "bin";
  return captureObjectKey(userId, captureId, `original.${ext}`);
}

async function assertUnderDailyCap(userId: string): Promise<void> {
  const env = getEnv();
  const dayStart = startOfUtcDayForTz(new Date(), env.APP_TZ);
  const todayCount = await countCapturesSince(userId, dayStart);
  if (todayCount >= env.DAILY_CAPTURE_LIMIT) {
    throw new HttpError(
      429,
      "daily_limit_reached",
      `You've hit today's limit of ${env.DAILY_CAPTURE_LIMIT} captures. It resets at midnight.`,
    );
  }
}

function assertNotDemo(userId: string): void {
  if (isDemoUser(userId)) {
    throw new HttpError(403, "demo_read_only", DEMO_READONLY_MESSAGE);
  }
}

/** Shared free-tier guard: refuse new captures once the whole app has spent
 * its daily Gemini call budget (each capture costs several calls). */
async function assertAiBudget(): Promise<void> {
  const { aiBudgetExceeded, AI_BUDGET_MESSAGE } = await import("@/lib/ai/usage");
  if (await aiBudgetExceeded()) {
    throw new HttpError(429, "ai_budget_reached", AI_BUDGET_MESSAGE);
  }
}

export type BeginCaptureResult =
  | { deduped: true; id: string; status: CaptureStatus }
  | {
      deduped: false;
      captureId: string;
      uploadUrl: string;
      token: string;
      path: string;
      /** For PDFs: a second slot for the browser-rendered page-1 JPEG. */
      thumb?: { uploadUrl: string; token: string; path: string };
    };

export async function beginCaptureUpload(
  user: User,
  input: { mime: string; sha256: string; bytes: number },
): Promise<BeginCaptureResult> {
  assertNotDemo(user.id);
  await assertUnderDailyCap(user.id);
  await assertAiBudget();
  const { mime, kind } = classifyMime(input.mime);
  if (input.bytes > MAX_BYTES[kind]) {
    throw new HttpError(
      413,
      "file_too_large",
      `That file is over ${MAX_BYTES[kind] / 1024 / 1024} MB.`,
    );
  }

  const existing = await findCaptureBySha(user.id, input.sha256);
  if (existing) {
    return { deduped: true, id: existing.id, status: existing.status };
  }

  const captureId = newId();
  const key = originalKeyFor(user.id, captureId, mime);
  const signed = await createUploadUrl(key);
  if (!signed) {
    throw new HttpError(502, "storage_error", "Couldn't prepare the upload. Try again.");
  }

  let thumbSlot: { uploadUrl: string; token: string; path: string } | undefined;
  if (mime === PDF_MIME) {
    const tKey = captureObjectKey(user.id, captureId, "thumb.jpg");
    const tSigned = await createUploadUrl(tKey);
    if (tSigned) {
      thumbSlot = { uploadUrl: tSigned.uploadUrl, token: tSigned.token, path: tSigned.path };
    }
  }

  return {
    deduped: false,
    captureId,
    uploadUrl: signed.uploadUrl,
    token: signed.token,
    path: signed.path,
    thumb: thumbSlot,
  };
}

export async function finishCaptureUpload(
  user: User,
  input: {
    captureId: string;
    mime: string;
    sha256: string;
    bytes: number;
    capturedAt?: Date;
    source?: string;
    width?: number | null;
    height?: number | null;
    folderId?: string | null;
    /** PDF only: the browser uploaded a page-1 JPEG to `thumb.jpg`. */
    thumbUploaded?: boolean;
  },
): Promise<{ id: string; status: "queued" }> {
  const { mime } = classifyMime(input.mime);
  const key = originalKeyFor(user.id, input.captureId, mime);
  // A PDF stays as its original bytes, but if the browser rendered page 1
  // we point display/thumb at that JPEG so it shows like a photo everywhere.
  const derived =
    mime === PDF_MIME && input.thumbUploaded
      ? captureObjectKey(user.id, input.captureId, "thumb.jpg")
      : key;

  await insertCapture({
    id: input.captureId,
    userId: user.id,
    originalKey: key,
    // Non-image kinds never get derivatives; images get theirs generated
    // in the pipeline and this row updated (updateCaptureDerivedKeys).
    displayKey: derived,
    thumbKey: derived,
    mime,
    bytes: input.bytes,
    width: input.width ?? null,
    height: input.height ?? null,
    sha256: input.sha256,
    source: normalizeSource(input.source),
    folderId: input.folderId ?? null,
    capturedAt: input.capturedAt ?? new Date(),
  });

  after(() => runPipeline(input.captureId));
  return { id: input.captureId, status: "queued" };
}

function normalizeSource(source?: string): string {
  return source === "webcam" || source === "share" || source === "telegram"
    ? source
    : "upload";
}

/** Only used by share-target, which already has the file's bytes in hand
 * (the OS POSTed them to us) — no benefit to a signed-URL round trip when
 * we're already past the 4.5MB body limit's chokepoint either way. */
export async function createCaptureFromServerBytes(
  user: User,
  file: Blob,
  opts: { capturedAt?: Date; source?: string; folderId?: string | null } = {},
): Promise<{ id: string; status: "queued"; deduped?: boolean }> {
  assertNotDemo(user.id);
  await assertUnderDailyCap(user.id);
  await assertAiBudget();
  const { mime } = classifyMime(file.type);

  const raw = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(raw).digest("hex");

  const existing = await findCaptureBySha(user.id, sha256);
  if (existing) {
    return { id: existing.id, status: "queued", deduped: true };
  }

  const captureId = newId();
  const key = originalKeyFor(user.id, captureId, mime);
  const supabase = createAdminClient();
  const up = await supabase.storage
    .from(CAPTURES_BUCKET)
    .upload(key, raw, { contentType: mime, upsert: true });
  if (up.error) {
    throw new HttpError(502, "storage_error", `Upload failed: ${up.error.message}`);
  }

  const result = await finishCaptureUpload(user, {
    captureId,
    mime,
    sha256,
    bytes: raw.length,
    capturedAt: opts.capturedAt,
    source: opts.source,
    folderId: opts.folderId ?? null,
  });
  return result;
}

/**
 * URL capture: fetch a public web page, pull its readable text, and store that
 * text as a text/plain capture. The pipeline routes text/plain through the same
 * text extractor as DOCX/PPTX. SSRF is guarded in lib/pipeline/web-fetch.ts.
 */
export async function createCaptureFromUrl(
  userId: string,
  rawUrl: string,
  folderId: string | null = null,
): Promise<{ id: string; status: "queued"; deduped?: boolean }> {
  assertNotDemo(userId);
  await assertUnderDailyCap(userId);
  await assertAiBudget();

  const { fetchReadable, WebFetchError } = await import("@/lib/pipeline/web-fetch");
  let page;
  try {
    page = await fetchReadable(rawUrl);
  } catch (e) {
    if (e instanceof WebFetchError) throw new HttpError(422, "url_unreadable", e.message);
    throw new HttpError(502, "url_error", "Couldn't read that link.");
  }

  const body = `${page.title}\n${page.siteName ? page.siteName + "\n" : ""}${page.finalUrl}\n\n${page.text}`;
  const buf = Buffer.from(body, "utf8");
  const sha256 = createHash("sha256").update(buf).digest("hex");

  const existing = await findCaptureBySha(userId, sha256);
  if (existing) return { id: existing.id, status: "queued", deduped: true };

  const captureId = newId();
  const key = captureObjectKey(userId, captureId, "web.txt");
  const supabase = createAdminClient();
  const up = await supabase.storage
    .from(CAPTURES_BUCKET)
    .upload(key, buf, { contentType: "text/plain", upsert: true });
  if (up.error) {
    throw new HttpError(502, "storage_error", `Upload failed: ${up.error.message}`);
  }

  await insertCapture({
    id: captureId,
    userId: userId,
    originalKey: key,
    displayKey: key,
    thumbKey: key,
    mime: "text/plain",
    bytes: buf.length,
    width: null,
    height: null,
    sha256,
    source: "url",
    sourceUrl: page.finalUrl,
    folderId,
    capturedAt: new Date(),
  });

  after(() => runPipeline(captureId));
  return { id: captureId, status: "queued" };
}

/** Plain-text note capture (public API). Stored as a text/plain object and run
 * through the same text extractor as URL / office captures. */
export async function createCaptureFromText(
  userId: string,
  input: { text: string; title?: string; source?: string; folderId?: string | null },
): Promise<{ id: string; status: "queued"; deduped?: boolean }> {
  assertNotDemo(userId);
  await assertUnderDailyCap(userId);
  await assertAiBudget();

  const text = input.text.trim();
  if (text.length < 3) throw new HttpError(422, "empty", "Nothing to capture.");
  const body = `${(input.title ?? "").trim()}\n\n${text}`.trim().slice(0, 40_000);
  const buf = Buffer.from(body, "utf8");
  const sha256 = createHash("sha256").update(buf).digest("hex");

  const existing = await findCaptureBySha(userId, sha256);
  if (existing) return { id: existing.id, status: "queued", deduped: true };

  const captureId = newId();
  const key = captureObjectKey(userId, captureId, "note.txt");
  const supabase = createAdminClient();
  const up = await supabase.storage
    .from(CAPTURES_BUCKET)
    .upload(key, buf, { contentType: "text/plain", upsert: true });
  if (up.error) throw new HttpError(502, "storage_error", `Upload failed: ${up.error.message}`);

  await insertCapture({
    id: captureId,
    userId: userId,
    originalKey: key,
    displayKey: key,
    thumbKey: key,
    mime: "text/plain",
    bytes: buf.length,
    width: null,
    height: null,
    sha256,
    source: input.source ?? "api",
    folderId: input.folderId ?? null,
    capturedAt: new Date(),
  });

  after(() => runPipeline(captureId));
  return { id: captureId, status: "queued" };
}
