import { NextResponse, after } from "next/server";
import { z } from "zod";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import {
  captureKeysForMemory,
  getMemoryDetail,
  softDeleteMemory,
  updateMemoryTags,
} from "@/lib/db/queries";
import { removeStorageObjects, signImageUrl } from "@/lib/storage";

export const runtime = "nodejs";

export const GET = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const detail = await getMemoryDetail(user.id, id);
    if (!detail) throw new HttpError(404, "not_found", "Memory not found.");

    const [displayUrl, thumbUrl] = await Promise.all([
      signImageUrl(detail.capture.displayKey),
      signImageUrl(detail.capture.thumbKey),
    ]);

    return NextResponse.json({
      id: detail.memory.id,
      captureId: detail.memory.captureId,
      type: detail.memory.type,
      typeConfidence: detail.memory.typeConfidence,
      title: detail.memory.title,
      summary: detail.memory.summary,
      text: detail.memory.correctedText ?? detail.memory.text,
      ocrConfidence: detail.memory.ocrConfidence,
      structured: detail.memory.structured,
      capturedAt: detail.memory.capturedAt,
      displayUrl,
      thumbUrl,
      entities: detail.entities.map((e) => ({
        id: e.id,
        kind: e.kind,
        valueText: e.valueText,
        valueNorm: e.valueNorm,
        tsValue: e.tsValue,
      })),
      tags: detail.tags,
      actionItems: detail.actionItems.map((a) => ({
        id: a.id,
        title: a.title,
        dueAt: a.dueAt,
        status: a.status,
      })),
    });
  },
);

const patchSchema = z.object({
  tags: z.array(z.string().max(40)).max(20).optional(),
});

export const PATCH = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    if (body.tags) {
      const ok = await updateMemoryTags(user.id, id, body.tags);
      if (!ok) throw new HttpError(404, "not_found", "Memory not found.");
    }
    return NextResponse.json({ ok: true });
  },
);

export const DELETE = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    const keys = await captureKeysForMemory(user.id, id);
    const removed = await softDeleteMemory(user.id, id);
    // "Delete" means delete — drop the files too (no undo UI exists).
    if (removed && keys.length) after(() => removeStorageObjects(keys));
    return new NextResponse(null, { status: 204 });
  },
);
