import { v1, v1json, OPTIONS } from "@/lib/api-v1";

export const runtime = "nodejs";
export { OPTIONS };

export const GET = v1(async (actor) =>
  v1json({ ok: true, user_id: actor.userId, token_id: actor.tokenId }),
);
