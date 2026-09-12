import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiUser } from "@/lib/http";
import { listRecentCaptures } from "@/lib/db/queries";
import { signImageUrls } from "@/lib/storage";
import { finishCaptureUpload } from "@/lib/pipeline/create-capture";

export const runtime = "nodejs";
export const maxDuration = 30;

/** The file itself is already in Storage by the time this is called (see
 * beginCaptureUpload in /api/captures/begin) — this body is tiny JSON,
 * nowhere near Vercel's 4.5MB function body limit regardless of how large
 * the actual capture is. */
const finishSchema = z.object({
  captureId: z.string().min(1).max(40),
  mime: z.string().min(1).max(200),
  sha256: z.string().min(32).max(128),
  bytes: z.number().int().positive(),
  capturedAt: z.string().datetime().optional(),
  source: z.string().max(20).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  folderId: z.string().max(40).nullish(),
  thumbUploaded: z.boolean().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  const body = finishSchema.parse(await req.json());

  const result = await finishCaptureUpload(user, {
    captureId: body.captureId,
    mime: body.mime,
    sha256: body.sha256,
    bytes: body.bytes,
    capturedAt: body.capturedAt ? new Date(body.capturedAt) : undefined,
    source: body.source,
    width: body.width,
    height: body.height,
    folderId: body.folderId ?? null,
    thumbUploaded: body.thumbUploaded ?? false,
  });
  return NextResponse.json(result, { status: 201 });
});

export const GET = handle(async () => {
  const user = await requireApiUser();
  const rows = await listRecentCaptures(user.id, 12);
  const urls = await signImageUrls(rows.map((r) => r.thumbKey));
  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      status: r.status,
      capturedAt: r.capturedAt,
      memoryId: r.memoryId,
      type: r.type,
      title: r.title,
      thumbUrl: urls[r.thumbKey] ?? null,
      mime: r.mime,
    })),
  });
});
