import { NextResponse } from "next/server";
import { HttpError } from "@/lib/http";
import { reportError } from "@/lib/observe";
import { bearerFrom, hashToken } from "@/lib/api-tokens";
import { resolveApiToken } from "@/lib/db/queries";

/**
 * Auth + plumbing for the public REST API (`/api/v1/*`). Bearer-token only —
 * no cookies — so CORS `*` is safe (no ambient credentials to abuse).
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-max-age": "86400",
};

export type ApiActor = { userId: string; tokenId: string };

// crude in-memory limiter — 120 req/min per token. Resets on cold start;
// fine for a ~10-user beta, and writes are still gated by the daily caps.
const hits = new Map<string, { n: number; reset: number }>();
function rateLimit(tokenId: string) {
  const now = Date.now();
  const cur = hits.get(tokenId);
  if (!cur || now > cur.reset) {
    hits.set(tokenId, { n: 1, reset: now + 60_000 });
    return;
  }
  if (++cur.n > 120) {
    throw new HttpError(429, "rate_limited", "Too many requests — slow down.");
  }
}

export async function requireToken(req: Request): Promise<ApiActor> {
  const raw = bearerFrom(req);
  if (!raw) {
    throw new HttpError(401, "unauthorized", "Pass `Authorization: Bearer mm_...`.");
  }
  const actor = await resolveApiToken(hashToken(raw));
  if (!actor) throw new HttpError(401, "invalid_token", "That token is invalid or revoked.");
  rateLimit(actor.tokenId);
  return actor;
}

export function v1json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: CORS });
}

/** Wrap a v1 handler: OPTIONS preflight, token auth, HttpError → JSON, CORS. */
export function v1<T extends unknown[]>(
  fn: (actor: ApiActor, req: Request, ...rest: T) => Promise<NextResponse>,
) {
  return async (req: Request, ...rest: T): Promise<NextResponse> => {
    if (req.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: CORS });
    try {
      const actor = await requireToken(req);
      return await fn(actor, req, ...rest);
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status >= 500) reportError(err, { where: `v1 ${req.method} ${new URL(req.url).pathname}` });
        return NextResponse.json(
          { error_code: err.errorCode, message: err.message },
          { status: err.status, headers: CORS },
        );
      }
      reportError(err, { where: `v1 ${req.method} ${new URL(req.url).pathname}` });
      return NextResponse.json({ error_code: "internal_error", message: "Something went wrong." }, { status: 500, headers: CORS });
    }
  };
}

export const OPTIONS = () => new NextResponse(null, { status: 204, headers: CORS });
