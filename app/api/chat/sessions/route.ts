import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/http";
import { createChatSession, listChatSessions } from "@/lib/db/queries";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireApiUser();
  const rows = await listChatSessions(user.id);
  return NextResponse.json({ items: rows });
});

export const POST = handle(async () => {
  const user = await requireApiUser();
  const id = await createChatSession(user.id);
  return NextResponse.json({ id, title: "New chat" }, { status: 201 });
});
