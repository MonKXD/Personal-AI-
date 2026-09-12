import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiUser } from "@/lib/http";
import { addFeedback, addNotification, ownerUserId } from "@/lib/db/queries";
import { reportError } from "@/lib/observe";

export const runtime = "nodejs";

const schema = z.object({
  message: z.string().trim().min(3).max(4000),
  page: z.string().max(200).optional(),
});

/** POST /api/feedback — a signed-in user's "report a problem" note. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { message, page } = schema.parse(await req.json());

  await addFeedback({
    userId: user.id,
    message,
    page: page ?? null,
    userAgent: req.headers.get("user-agent"),
  });

  // Nudge the owner (best-effort).
  try {
    const owner = await ownerUserId();
    if (owner) {
      await addNotification({
        userId: owner,
        kind: "feedback",
        title: "New feedback",
        body: `${user.email ?? "someone"}: ${message.slice(0, 140)}`,
        href: "/settings/feedback",
        dedupeKey: null,
      });
    }
  } catch (e) {
    reportError(e, { where: "POST /api/feedback (notify)" });
  }

  return NextResponse.json({ ok: true });
});
