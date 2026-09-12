import { NextResponse } from "next/server";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import {
  assertSessionOwner,
  deleteChatSession,
  getChatMessages,
} from "@/lib/db/queries";
import { hydrateChatMessages } from "@/lib/chat-hydrate";

export const runtime = "nodejs";

export const GET = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const owned = await assertSessionOwner(user.id, id);
    if (!owned) throw new HttpError(404, "not_found", "Chat not found.");
    const rows = await getChatMessages(user.id, id);
    return NextResponse.json({
      id,
      title: owned.title,
      messages: await hydrateChatMessages(rows),
    });
  },
);

export const DELETE = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    await deleteChatSession(user.id, id);
    return new NextResponse(null, { status: 204 });
  },
);
