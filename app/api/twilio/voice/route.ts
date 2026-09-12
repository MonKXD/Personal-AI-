import { getCallById } from "@/lib/db/queries";
import { buildVoiceTwiml, validateTwilioSignature } from "@/lib/twilio";
import { reportError } from "@/lib/observe";

export const runtime = "nodejs";

/**
 * Twilio's voice webhook — hit directly by Twilio, not by a signed-in user.
 * Authenticated via X-Twilio-Signature (docs/modules/calling-assistant.md),
 * not a session cookie. Returns TwiML that hands the call to the
 * externally-hosted ConversationRelay WebSocket handler.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  const signature = req.headers.get("x-twilio-signature");
  if (!validateTwilioSignature(req.url, params, signature)) {
    reportError(new Error("Twilio signature mismatch"), { where: "twilio/voice" });
    return new Response("Forbidden", { status: 403 });
  }

  const callId = new URL(req.url).searchParams.get("callId");
  const call = callId ? await getCallById(callId) : null;

  const twiml = buildVoiceTwiml({
    callId: callId ?? "",
    purpose: call?.purpose,
    instructions: call?.instructions,
  });
  return new Response(twiml, { headers: { "content-type": "text/xml" } });
}
