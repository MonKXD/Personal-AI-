import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { correctMemoryText } from "@/lib/pipeline/correct";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({ text: z.string().trim().min(1).max(20000) });

export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    const { text } = bodySchema.parse(await req.json());
    const ok = await correctMemoryText(user.id, id, text);
    if (!ok) throw new HttpError(404, "not_found", "Memory not found.");
    return NextResponse.json({ ok: true });
  },
);
