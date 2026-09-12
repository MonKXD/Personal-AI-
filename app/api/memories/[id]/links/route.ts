import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { linkMemories, listLinkedMemories } from "@/lib/db/queries";
import { signImageUrls } from "@/lib/storage";

export const runtime = "nodejs";

export const GET = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const linked = await listLinkedMemories(user.id, id);
    const urls = await signImageUrls(linked.map((m) => m.thumbKey));
    return NextResponse.json({
      items: linked.map((m) => ({
        id: m.id,
        type: m.type,
        title: m.title,
        thumbUrl: urls[m.thumbKey] ?? null,
        mime: m.mime,
      })),
    });
  },
);

const bodySchema = z.object({ targetId: z.string().min(1).max(40) });

export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    const { targetId } = bodySchema.parse(await req.json());
    const ok = await linkMemories(user.id, id, targetId);
    if (!ok) throw new HttpError(404, "not_found", "Memory not found.");
    return NextResponse.json({ ok: true }, { status: 201 });
  },
);
