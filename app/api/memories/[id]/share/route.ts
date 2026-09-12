import { NextResponse } from "next/server";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { setMemoryShare } from "@/lib/db/queries";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";

const shareUrl = (shareId: string) =>
  `${publicEnv.siteUrl.replace(/\/$/, "")}/m/${shareId}`;

/** Turn on a public link for this memory. */
export const POST = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    const res = await setMemoryShare(user.id, id, true);
    if (!res) throw new HttpError(404, "not_found", "Memory not found.");
    return NextResponse.json({
      shareId: res.shareId,
      url: res.shareId ? shareUrl(res.shareId) : null,
    });
  },
);

/** Revoke the public link. */
export const DELETE = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    const res = await setMemoryShare(user.id, id, false);
    if (!res) throw new HttpError(404, "not_found", "Memory not found.");
    return NextResponse.json({ ok: true });
  },
);
