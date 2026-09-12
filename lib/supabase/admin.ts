import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

/**
 * Service-role Supabase client — bypasses RLS. Use ONLY in trusted server code
 * (the capture pipeline, which runs after the response via `after()` and has no
 * user cookie context). Every query here must still scope by user id.
 */
export function createAdminClient() {
  const env = getEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for the capture pipeline. Add it to .env.local.",
    );
  }
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const CAPTURES_BUCKET = "captures";
