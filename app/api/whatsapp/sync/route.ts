import { NextResponse } from "next/server";
import { z } from "zod";
import { getWhatsappCategorizer } from "@/lib/ai";
import { extractDeadline } from "@/lib/deadlines";
import { getEnv } from "@/lib/env";
import { handle, HttpError } from "@/lib/http";
import { getWhatsappFilterRules, insertWhatsappMessage } from "@/lib/db/queries";
import { newId } from "@/lib/ids";

export const runtime = "nodejs";

/**
 * Called by the externally-hosted, passive Baileys listener on every
 * incoming message (docs/modules/whatsapp-triage.md "Data flow"). Never
 * sends or replies — this endpoint only observes and categorizes.
 *
 * Authenticated by a shared bearer secret, not a user session, since the
 * listener is a standalone process, not a browser. The listener passes
 * `userId` explicitly (this is a personal, single-account WhatsApp link —
 * see the module doc for why there's no per-chat OAuth here).
 */
const syncSchema = z.object({
  userId: z.string().uuid(),
  chatId: z.string().min(1),
  chatName: z.string().nullish(),
  sender: z.string().nullish(),
  text: z.string().min(1),
  timestamp: z.string(),
  direction: z.enum(["in", "out"]).default("in"),
  recentContext: z.array(z.string()).max(10).default([]),
});

export const POST = handle(async (req: Request) => {
  const secret = getEnv().WHATSAPP_SYNC_WEBHOOK_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    throw new HttpError(401, "unauthorized", "Missing or invalid sync secret.");
  }

  const body = syncSchema.parse(await req.json());
  const occurredAt = new Date(body.timestamp);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new HttpError(400, "invalid_timestamp", "timestamp is not a valid date.");
  }

  const rules = await getWhatsappFilterRules(body.userId);
  const rule = rules.find((r) => r.chatId === body.chatId);

  let category: "important" | "deadline" | "routine" | "promotional" | "filtered";
  let reason: string;
  if (rule?.action === "mute") {
    category = "filtered";
    reason = "Chat muted by user.";
  } else if (rule?.action === "always_flag") {
    category = "important";
    reason = "Chat always flagged as important by user.";
  } else if (body.direction === "out") {
    // Outbound messages (sent from Harsh's own linked device by him, never by
    // this app) are logged for context but never triaged.
    category = "routine";
    reason = "Outbound message.";
  } else {
    const result = await getWhatsappCategorizer().categorize({
      chatName: body.chatName ?? body.chatId,
      sender: body.sender ?? "unknown",
      text: body.text,
      recentContext: body.recentContext,
    });
    category = result.category;
    reason = result.reason;
  }

  let deadlineId: string | null = null;
  if (category === "deadline") {
    const id = newId();
    const created = await extractDeadline(body.text, {
      userId: body.userId,
      source: "whatsapp",
      sourceRefId: id,
    });
    deadlineId = created?.id ?? null;
  }

  const id = newId();
  await insertWhatsappMessage({
    id,
    userId: body.userId,
    chatId: body.chatId,
    chatName: body.chatName ?? null,
    sender: body.sender ?? null,
    direction: body.direction,
    text: body.text,
    category,
    reason,
    isDeadline: category === "deadline",
    deadlineId,
    occurredAt,
  });

  return NextResponse.json({ id, category, reason, deadlineId });
});
