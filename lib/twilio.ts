import "server-only";

import { createHmac } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * Twilio Voice + ConversationRelay adapter (docs/modules/calling-assistant.md).
 * Plain REST calls over fetch — no vendor SDK — to keep this app's dependency
 * footprint small; Twilio's Voice API is simple form-encoded POSTs.
 *
 * The live conversation itself (speech in/out, Claude deciding what to say)
 * happens on CONVERSATION_RELAY_WS_URL, a WebSocket server you host outside
 * this Next.js app (Vercel serverless functions can't hold a persistent
 * connection). This module only originates the call and returns the TwiML
 * that points Twilio at that WS handler.
 */

export function isTwilioConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER);
}

export function isConversationRelayConfigured(): boolean {
  return Boolean(getEnv().CONVERSATION_RELAY_WS_URL);
}

/** Originate an outbound call. `voiceUrl` is this app's own
 * /api/twilio/voice route (Twilio POSTs here for the TwiML). */
export async function placeOutboundCall(args: {
  to: string;
  voiceUrl: string;
}): Promise<{ sid: string }> {
  const env = getEnv();
  if (!isTwilioConfigured()) {
    throw new Error(
      "Twilio isn't configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.",
    );
  }
  const body = new URLSearchParams({
    To: args.to,
    From: env.TWILIO_PHONE_NUMBER!,
    Url: args.voiceUrl,
  });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Twilio call origination failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { sid: string };
  return { sid: json.sid };
}

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/** TwiML for both the outbound call's Url and the inbound number's voice
 * webhook: hands the call to ConversationRelay, passing call context as
 * custom parameters the WS handler reads off the "setup" message. */
export function buildVoiceTwiml(args: {
  callId: string;
  purpose?: string | null;
  instructions?: string | null;
}): string {
  const env = getEnv();
  const wsUrl = env.CONVERSATION_RELAY_WS_URL;
  if (!wsUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>This assistant is not fully configured yet.</Say><Hangup/></Response>`;
  }
  const params = [
    `<Parameter name="callId" value="${xmlEscape(args.callId)}"/>`,
    args.purpose ? `<Parameter name="purpose" value="${xmlEscape(args.purpose)}"/>` : "",
    args.instructions ? `<Parameter name="instructions" value="${xmlEscape(args.instructions)}"/>` : "",
  ]
    .filter(Boolean)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><ConversationRelay url="${xmlEscape(wsUrl)}" welcomeGreeting="Hi, this is Harsh's AI assistant calling on his behalf.">${params}</ConversationRelay></Connect></Response>`;
}

/** Verifies Twilio's X-Twilio-Signature on inbound webhooks (voice URL,
 * status callbacks) per Twilio's request-validation scheme:
 * base64(HMAC-SHA1(authToken, url + sorted "key" + "value" pairs)). */
export function validateTwilioSignature(
  fullUrl: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  const authToken = getEnv().TWILIO_AUTH_TOKEN;
  if (!authToken || !signature) return false;
  const data =
    fullUrl +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const expected = createHmac("sha1", authToken).update(data, "utf-8").digest("base64");
  return expected === signature;
}
