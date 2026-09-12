import { NextResponse } from "next/server";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { unlinkMemory } from "@/lib/db/queries";

export const runtime = "nodejs";

export const DELETE = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string; targetId: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id, targetId } = await ctx.params;
    const ok = await unlinkMemory(user.id, id, targetId);
    if (!ok) throw new HttpError(404, "not_found", "Memory not found.");
    return new NextResponse(null, { status: 204 });
  },
);
