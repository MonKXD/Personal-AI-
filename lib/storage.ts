import "server-only";

import { createAdminClient, CAPTURES_BUCKET } from "@/lib/supabase/admin";

const DEFAULT_TTL = 60 * 60; // 1h

/** Batch sign object keys in the private captures bucket. Returns key -> url. */
export async function signImageUrls(
  keys: string[],
  ttl = DEFAULT_TTL,
): Promise<Record<string, string>> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return {};
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(CAPTURES_BUCKET)
    .createSignedUrls(unique, ttl);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  data.forEach((row, i) => {
    if (row.signedUrl) out[unique[i]] = row.signedUrl;
  });
  return out;
}

export async function signImageUrl(key: string, ttl = DEFAULT_TTL): Promise<string | null> {
  const map = await signImageUrls([key], ttl);
  return map[key] ?? null;
}

export function captureObjectKey(userId: string, captureId: string, name: string) {
  return `${userId}/${captureId}/${name}`;
}

/** Mints a one-time upload URL so the browser can PUT bytes straight into
 * Storage, bypassing the Vercel function body-size limit entirely. Minted
 * via the admin client (bypasses RLS) — authorization already happened in
 * the caller (auth + daily-cap check) before this is ever called. */
export async function createUploadUrl(
  key: string,
): Promise<{ uploadUrl: string; token: string; path: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(CAPTURES_BUCKET)
    .createSignedUploadUrl(key, { upsert: true });
  if (error || !data) return null;
  return { uploadUrl: data.signedUrl, token: data.token, path: data.path };
}

/** Best-effort removal of objects from the captures bucket. Never throws. */
export async function removeStorageObjects(keys: string[]): Promise<number> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return 0;
  try {
    const { error } = await createAdminClient()
      .storage.from(CAPTURES_BUCKET)
      .remove(unique);
    if (error) return 0;
    return unique.length;
  } catch {
    return 0;
  }
}
