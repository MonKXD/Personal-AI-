import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiUser } from "@/lib/http";
import { savePushSubscription, deletePushSubscription } from "@/lib/db/queries";

export const runtime = "nodejs";

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(300), auth: z.string().max(300) }),
});

/** POST — register a browser push subscription. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  const sub = subSchema.parse(await req.json());
  await savePushSubscription(user.id, {
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  });
  return NextResponse.json({ ok: true });
});

/** DELETE — remove one subscription (body: { endpoint }). */
export const DELETE = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  const { endpoint } = z
    .object({ endpoint: z.string().url().max(1000) })
    .parse(await req.json().catch(() => ({})));
  await deletePushSubscription(user.id, endpoint);
  return NextResponse.json({ ok: true });
});
