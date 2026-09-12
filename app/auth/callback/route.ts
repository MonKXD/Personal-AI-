import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { isEmailAllowed, countProfilesExcluding } from "@/lib/db/queries";

export const runtime = "nodejs";

/**
 * OAuth / magic-link return handler. Exchanges the PKCE `code` for a session,
 * then enforces the sign-up allowlist (OAuth can't be pre-checked like the
 * magic link). A rejected sign-up is signed out and its auth user deleted.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(errorDescription)}`,
    );
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error.message)}`,
    );
  }

  const email = data.user?.email?.toLowerCase();
  const owner = getEnv().OWNER_EMAIL?.toLowerCase();

  // Seat cap for OAuth: the email is only known now, after the user row (and,
  // via the sync trigger, its profile) has been created. Treat an account
  // created within the last 2 minutes as a fresh sign-up; count everyone
  // *else* and reject if that already fills the cap. Returning users and the
  // owner pass straight through. Fails open on any DB error.
  const max = getEnv().MAX_USERS;
  const createdAt = data.user?.created_at ? Date.parse(data.user.created_at) : 0;
  const isFreshSignup = createdAt > 0 && Date.now() - createdAt < 120_000;
  if (max > 0 && isFreshSignup && data.user && email !== owner) {
    let others = 0;
    try {
      others = await countProfilesExcluding(data.user.id);
    } catch {
      others = 0; // fail open
    }
    if (others >= max) {
      await supabase.auth.signOut();
      try {
        await createAdminClient().auth.admin.deleteUser(data.user.id);
      } catch {
        /* best effort */
      }
      return NextResponse.redirect(`${origin}/sign-in?error=at_capacity`);
    }
  }

  if (getEnv().INVITE_ONLY && email && email !== owner) {
    let allowed = true;
    try {
      allowed = await isEmailAllowed(email);
    } catch {
      allowed = true; // fail open (table missing / DB blip)
    }
    if (!allowed) {
      await supabase.auth.signOut();
      try {
        if (data.user?.id) await createAdminClient().auth.admin.deleteUser(data.user.id);
      } catch {
        /* best effort */
      }
      return NextResponse.redirect(`${origin}/sign-in?error=not_invited`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}

function sanitizeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/capture";
  return value;
}
