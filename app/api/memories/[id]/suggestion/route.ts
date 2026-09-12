import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/http";
import { clearSuggestedFolder } from "@/lib/db/queries";

export const runtime = "nodejs";

/** Dismiss the AI folder suggestion for a memory (accepting it just uses
 * PATCH /api/memories/folder, which clears the suggestion too). */
export const DELETE = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    await clearSuggestedFolder(user.id, id);
    return new NextResponse(null, { status: 204 });
  },
);
