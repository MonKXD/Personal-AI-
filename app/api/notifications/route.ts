import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiUser } from "@/lib/http";
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
} from "@/lib/db/queries";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireApiUser();
  const [items, unread] = await Promise.all([
    listNotifications(user.id),
    countUnreadNotifications(user.id),
  ]);
  return NextResponse.json({
    unread,
    items: items.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      href: n.href,
      read: n.readAt != null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
});

const readSchema = z.object({ ids: z.array(z.string().max(40)).max(100).optional() });

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { ids } = readSchema.parse(await req.json().catch(() => ({})));
  await markNotificationsRead(user.id, ids);
  return NextResponse.json({ ok: true });
});
