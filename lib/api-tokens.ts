import { createHash, randomBytes } from "node:crypto";

/**
 * Personal API tokens. Format: `mm_<43 base64url chars>`. We store only the
 * SHA-256 hash; the raw value is shown to the user exactly once.
 */

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

export function generateToken(): { token: string; hash: string; prefix: string } {
  const token = `mm_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 11) };
}

/** Pull the bearer token out of an Authorization header. */
export function bearerFrom(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(mm_[A-Za-z0-9_-]{20,})\s*$/.exec(h);
  return m ? m[1] : null;
}
