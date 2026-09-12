import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { insertCall, listCalls, setCallProviderSid } from "@/lib/db/queries";
import { newId } from "@/lib/ids";
import { getEnv } from "@/lib/env";
import { isConversationRelayConfigured, isTwilioConfigured, placeOutboundCall } from "@/lib/twilio";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireApiUser();
  const calls = await listCalls(user.id);
  return NextResponse.json({ calls });
});

const placeCallSchema = z.object({
  to: z.string().min(6).max(20), // E.164
  purpose: z.string().max(200).optional(),
  instructions: z.string().min(1).max(2000),
});

/** `place_call` — see docs/modules/calling-assistant.md. Needs both a Twilio
 * account (to originate the call) and a separately-hosted ConversationRelay
 * WebSocket handler (to actually run the conversation) configured — this
 * app can't hold that connection itself. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  if (!isTwilioConfigured() || !isConversationRelayConfigured()) {
    throw new HttpError(
      501,
      "calling_not_configured",
      "Calling assistant isn't configured yet — set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_PHONE_NUMBER and CONVERSATION_RELAY_WS_URL (see docs/modules/calling-assistant.md).",
    );
  }
  const body = placeCallSchema.parse(await req.json());
  const id = newId();
  await insertCall({
    id,
    userId: user.id,
    direction: "outbound",
    counterpart: body.to,
    purpose: body.purpose ?? null,
    instructions: body.instructions,
  });

  const siteUrl = getEnv().NEXT_PUBLIC_SITE_URL;
  const { sid } = await placeOutboundCall({
    to: body.to,
    voiceUrl: `${siteUrl}/api/twilio/voice?callId=${id}`,
  });
  await setCallProviderSid(id, sid);

  return NextResponse.json({ id, sid, status: "in_progress" }, { status: 201 });
});
