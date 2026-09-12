import { NextResponse } from "next/server";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { setMemoryPin } from "@/lib/db/queries";

export const runtime = "nodejs";

/** POST → pin to the Timeline shelf, DELETE → unpin. */
export const POST = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    if (!(await setMemoryPin(user.id, id, true)))
      throw new HttpError(404, "not_found", "Memory not found.");
    return NextResponse.json({ ok: true, pinned: true });
  },
);

export const DELETE = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    await setMemoryPin(user.id, id, false);
    return NextResponse.json({ ok: true, pinned: false });
  },
);
