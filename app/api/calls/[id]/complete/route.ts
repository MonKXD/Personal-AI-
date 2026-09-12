import { NextResponse } from "next/server";
import { z } from "zod";
import { finishCall, getCallById } from "@/lib/db/queries";
import { extractDeadline } from "@/lib/deadlines";
import { getEnv } from "@/lib/env";
import { handle, HttpError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Called by the externally-hosted ConversationRelay WS handler when a call
 * ends (docs/modules/calling-assistant.md "On call end"). Authenticated by a
 * shared bearer secret, not a user session — the relay isn't a browser.
 */
const bodySchema = z.object({
  status: z.enum(["completed", "missed", "voicemail", "failed"]),
  transcript: z.array(z.unknown()).default([]),
  summary: z.string().max(4000).nullish(),
  extractedTasks: z.array(z.object({ title: z.string(), dueDate: z.string().nullish() })).default([]),
  durationSec: z.number().int().nonnegative().nullish(),
});

export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const secret = getEnv().CONVERSATION_RELAY_CALLBACK_SECRET;
    const auth = req.headers.get("authorization");
    if (!secret || auth !== `Bearer ${secret}`) {
      throw new HttpError(401, "unauthorized", "Missing or invalid callback secret.");
    }

    const { id } = await ctx.params;
    const call = await getCallById(id);
    if (!call) throw new HttpError(404, "not_found", "Call not found.");

    const body = bodySchema.parse(await req.json());
    await finishCall(id, {
      status: body.status,
      transcript: body.transcript,
      summary: body.summary ?? null,
      extractedTasks: body.extractedTasks,
      durationSec: body.durationSec ?? null,
    });

    // Any extracted task with a date also becomes a deadline (source: "call").
    for (const task of body.extractedTasks) {
      const text = task.dueDate ? `${task.title} (due ${task.dueDate})` : task.title;
      await extractDeadline(text, { userId: call.userId, source: "call", sourceRefId: id });
    }

    return NextResponse.json({ ok: true });
  },
);
