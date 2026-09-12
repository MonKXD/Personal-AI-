import "server-only";

import { createAdminClient, CAPTURES_BUCKET } from "@/lib/supabase/admin";
import {
  getVisionExtractor,
  getAudioTranscriber,
  getTextDocumentExtractor,
  getEmbedder,
  aiMode,
} from "@/lib/ai";
import type { AudioInput, VisionInput } from "@/lib/ai/types";
import {
  DOCUMENT_TEXT_PROMPT_VERSION,
  EXTRACT_PROMPT_VERSION,
  TRANSCRIBE_PROMPT_VERSION,
} from "@/lib/ai/prompts";
import { chunkMemory } from "./chunk";
import { extractOfficeText, type OfficeKind } from "./office-text";
import { processImage } from "@/lib/images/process";
import { captureObjectKey } from "@/lib/storage";
import { reportError } from "@/lib/observe";
import {
  autoLinkMemory,
  addNotification,
  clearMemoryForCapture,
  insertMemoryGraph,
  listFolderPaths,
  loadCaptureForPipeline,
  setCaptureStatus,
  setMemoryFolder,
  setSuggestedFolder,
  updateCaptureDerivedKeys,
} from "@/lib/db/queries";
import { suggestFolderId } from "./folder-suggest";
const TZ = "Asia/Kolkata";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/**
 * The capture pipeline. Invoked via `after()` from POST /api/captures (and from
 * the retry route). Runs trusted server code — DB via Drizzle (service role),
 * storage via the admin client. Updates captures.status as it progresses.
 */
export async function runPipeline(captureId: string): Promise<void> {
  const t0 = Date.now();
  const timings: Record<string, number> = {};

  try {
    const capture = await loadCaptureForPipeline(captureId);
    if (!capture) return;
    if (capture.status === "ready") return;

    await setCaptureStatus(captureId, "extracting");

    // 1. fetch the original bytes — the one key every capture always has.
    const supabase = createAdminClient();
    const dl = await supabase.storage.from(CAPTURES_BUCKET).download(capture.originalKey);
    if (dl.error || !dl.data) {
      throw new Error(`storage download failed: ${dl.error?.message ?? "no data"}`);
    }
    let buf: Buffer = Buffer.from(await dl.data.arrayBuffer());
    timings.download_ms = Date.now() - t0;

    const isAudio = capture.mime.startsWith("audio/");
    const isPdf = capture.mime === "application/pdf";
    const isOffice = capture.mime === DOCX_MIME || capture.mime === PPTX_MIME;
    const isText = capture.mime === "text/plain"; // URL capture — readable text already pulled
    const isImage = !isAudio && !isPdf && !isOffice && !isText;

    // 1b. images: generate display/thumb JPEGs now (moved here from upload
    // time — the browser uploads the original file straight to Storage, so
    // there's no request body left for the server to process synchronously).
    if (isImage) {
      const tProcess = Date.now();
      const processed = await processImage(buf);
      const displayKey = captureObjectKey(capture.userId, captureId, "display.jpg");
      const thumbKey = captureObjectKey(capture.userId, captureId, "thumb.jpg");
      const uploads = await Promise.all([
        supabase.storage.from(CAPTURES_BUCKET).upload(displayKey, processed.display, {
          contentType: "image/jpeg",
          upsert: true,
        }),
        supabase.storage.from(CAPTURES_BUCKET).upload(thumbKey, processed.thumb, {
          contentType: "image/jpeg",
          upsert: true,
        }),
      ]);
      const failed = uploads.find((u) => u.error);
      if (failed?.error) throw new Error(`derivative upload failed: ${failed.error.message}`);
      await updateCaptureDerivedKeys(captureId, displayKey, thumbKey);
      buf = processed.display; // reuse in memory — no need to re-download
      timings.image_process_ms = Date.now() - tProcess;
    }

    // 1c. PDFs with no client-rendered page-1 image (Telegram bot, share
    // target, public API) — rasterise page 1 server-side so the memory has a
    // real thumbnail everywhere, like a browser upload. `buf` stays the raw
    // PDF (extraction still needs it). Best-effort: a failure leaves the
    // generic document icon and never fails the capture.
    if (isPdf && capture.displayKey === capture.originalKey) {
      const tPdf = Date.now();
      try {
        const { renderPdfFirstPage } = await import("./pdf-render");
        const png = await renderPdfFirstPage(buf);
        if (png) {
          const processed = await processImage(png);
          const displayKey = captureObjectKey(capture.userId, captureId, "display.jpg");
          const thumbKey = captureObjectKey(capture.userId, captureId, "thumb.jpg");
          const uploads = await Promise.all([
            supabase.storage.from(CAPTURES_BUCKET).upload(displayKey, processed.display, {
              contentType: "image/jpeg",
              upsert: true,
            }),
            supabase.storage.from(CAPTURES_BUCKET).upload(thumbKey, processed.thumb, {
              contentType: "image/jpeg",
              upsert: true,
            }),
          ]);
          if (!uploads.some((u) => u.error)) {
            await updateCaptureDerivedKeys(captureId, displayKey, thumbKey);
          }
        }
      } catch (e) {
        reportError(e, { where: "pipeline pdf thumbnail", captureId });
      }
      timings.pdf_thumb_ms = Date.now() - tPdf;
    }

    // 2. extraction — vision (image/PDF), audio transcription, or office text
    const tExtract = Date.now();
    let extraction, extractorName: string, extractorModel: string, promptVersion: string;

    if (isAudio) {
      const transcriber = getAudioTranscriber();
      console.log(
        `[pipeline] ${captureId} provider=${aiMode().provider} audio=${transcriber.name}:${transcriber.model}`,
      );
      extraction = await transcriber.transcribe({
        audioBase64: buf.toString("base64"),
        mediaType: capture.mime as AudioInput["mediaType"],
        now: new Date().toISOString(),
        timezone: TZ,
        seed: capture.sha256,
      });
      // Every render site that skips <img> for audio trusts this — don't
      // rely on the model actually following the "always voice_note" prompt
      // instruction, enforce it server-side.
      extraction.type = "voice_note";
      extractorName = transcriber.name;
      extractorModel = transcriber.model;
      promptVersion = TRANSCRIBE_PROMPT_VERSION;
    } else if (isOffice || isText) {
      const kind: string = isText
        ? "web"
        : capture.mime === PPTX_MIME
          ? "pptx"
          : "docx";
      const text = isText ? buf.toString("utf8") : await extractOfficeText(buf, kind as OfficeKind);
      const extractor = getTextDocumentExtractor();
      console.log(
        `[pipeline] ${captureId} provider=${aiMode().provider} doc=${extractor.name}:${extractor.model} kind=${kind}`,
      );
      extraction = await extractor.extractFromText({
        text,
        sourceKind: kind,
        now: new Date().toISOString(),
        timezone: TZ,
        seed: capture.sha256,
      });
      extractorName = extractor.name;
      extractorModel = extractor.model;
      promptVersion = DOCUMENT_TEXT_PROMPT_VERSION;
    } else {
      // image or PDF — same extractor, same interface, just a different
      // mediaType. Gemini reads a PDF's text/images/diagrams natively
      // across every page, so this needs no special-casing beyond that.
      const extractor = getVisionExtractor();
      console.log(
        `[pipeline] ${captureId} provider=${aiMode().provider} vision=${extractor.name}:${extractor.model}`,
      );
      const mediaType: VisionInput["mediaType"] = isPdf
        ? "application/pdf"
        : capture.mime === "image/png"
          ? "image/png"
          : capture.mime === "image/webp"
            ? "image/webp"
            : "image/jpeg"; // sharp's output for every other image format
      extraction = await extractor.extract({
        imageBase64: buf.toString("base64"),
        mediaType,
        now: new Date().toISOString(),
        timezone: TZ,
        seed: capture.sha256,
      });
      extractorName = extractor.name;
      extractorModel = extractor.model;
      promptVersion = EXTRACT_PROMPT_VERSION;
    }
    timings.extract_ms = Date.now() - tExtract;

    // 3. reset any prior memory (retry-safe) then chunk + embed
    await clearMemoryForCapture(captureId);
    await setCaptureStatus(captureId, "embedding");

    const chunkList = chunkMemory({
      title: extraction.title,
      summary: extraction.summary,
      text: extraction.text,
    });

    const tEmbed = Date.now();
    const embedder = getEmbedder();
    const vectors =
      chunkList.length > 0 ? await embedder.embed(chunkList.map((c) => c.content)) : [];
    timings.embed_ms = Date.now() - tEmbed;

    // 4. persist the memory graph
    const { memoryId } = await insertMemoryGraph({
      userId: capture.userId,
      captureId,
      capturedAt: capture.capturedAt,
      extraction,
      chunkList,
      vectors,
      embeddingModel: embedder.model,
      embeddingDims: embedder.dims,
      extractor: extractorName,
      modelMeta: {
        provider: aiMode().provider,
        vision: extractorModel,
        prompt_version: promptVersion,
        embeddings: embedder.name,
        embedding_model: embedder.model,
      },
    });

    // 5. folder: a capture-time choice wins; otherwise ask the AI for a
    //    suggestion the user can confirm later (best-effort, never fails).
    if (capture.folderId) {
      await setMemoryFolder(capture.userId, [memoryId], capture.folderId).catch(() => {});
    } else {
      try {
        const paths = await listFolderPaths(capture.userId);
        const sug = await suggestFolderId(paths, {
          title: extraction.title,
          summary: extraction.summary,
          text: extraction.text,
        });
        if (sug) await setSuggestedFolder(capture.userId, memoryId, sug);
      } catch (e) {
        console.warn("[pipeline] folder suggest skipped for", captureId, (e as Error).message);
      }
    }

    // 6. auto-link to nearest neighbours (best-effort — never fail the capture)
    try {
      const linked = await autoLinkMemory(capture.userId, memoryId);
      if (linked) timings.auto_linked = linked;
    } catch (e) {
      console.warn("[pipeline] auto-link skipped for", captureId, (e as Error).message);
    }

    // 7. nudge the user if we weren't confident we read it right
    if (extraction.ocr_confidence === "low") {
      await addNotification({
        userId: capture.userId,
        kind: "needs_review",
        title: "A capture may need a review",
        body: `"${extraction.title}" — MirrorMind wasn't confident it read this. Open it to fix the text.`,
        href: `/memory/${memoryId}`,
        dedupeKey: `review:${memoryId}`,
      }).catch(() => {});
    }

    timings.total_ms = Date.now() - t0;
    await setCaptureStatus(captureId, "ready", { timings });

    // 8. outbound webhooks (best-effort, never throws)
    void import("@/lib/webhooks").then(({ dispatchWebhooks }) => {
      const payload = {
        memory_id: memoryId,
        capture_id: captureId,
        type: extraction.type,
        title: extraction.title,
        summary: extraction.summary,
      };
      dispatchWebhooks(capture.userId, "capture.completed", payload);
      dispatchWebhooks(capture.userId, "memory.created", payload);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setCaptureStatus(captureId, "failed", {
      errorCode: classifyError(message),
      errorDetail: message.slice(0, 500),
      timings,
    }).catch(() => {});
    reportError(err, { where: "pipeline", captureId, errorCode: classifyError(message) });
  }
}

function classifyError(msg: string): string {
  if (/storage download|derivative upload/i.test(msg)) return "file_unavailable";
  if (/busy|high demand|unavailable|overloaded|rate limit|429|50[234]/i.test(msg))
    return "model_busy";
  if (/embedding|voyage|openai/i.test(msg)) return "embeddings_unavailable";
  if (/anthropic|gemini|vision|404|not[_ ]?found/i.test(msg)) return "vision_unavailable";
  if (/office|docx|pptx/i.test(msg)) return "document_unreadable";
  return "pipeline_error";
}
