import { z } from "zod";
import { v1, v1json, OPTIONS } from "@/lib/api-v1";
import { HttpError } from "@/lib/http";
import { createCaptureFromText, createCaptureFromUrl } from "@/lib/pipeline/create-capture";

export const runtime = "nodejs";
export const maxDuration = 30;
export { OPTIONS };

const schema = z
  .object({
    url: z.string().trim().min(4).max(2000).optional(),
    text: z.string().trim().min(1).max(40_000).optional(),
    title: z.string().trim().max(200).optional(),
  })
  .refine((b) => b.url || b.text, { message: "Pass `url` or `text`." });

/**
 * POST /api/v1/captures  — create a capture.
 *   { "url": "https://…" }              → fetch + remember the page
 *   { "text": "…", "title": "…" }       → remember a plain note
 * Returns { id, status } (202). Poll GET /api/v1/captures/{id}.
 */
export const POST = v1(async (actor, req) => {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new HttpError(400, "bad_request", parsed.error.issues[0]?.message ?? "Bad request.");
  }
  const res = parsed.data.url
    ? await createCaptureFromUrl(actor.userId, parsed.data.url)
    : await createCaptureFromText(actor.userId, {
        text: parsed.data.text!,
        title: parsed.data.title,
        source: "api",
      });
  return v1json({ id: res.id, status: res.status, deduped: !!res.deduped }, res.deduped ? 200 : 202);
});
