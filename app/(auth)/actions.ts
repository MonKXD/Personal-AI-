"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv, isSupabaseConfigured, getEnv } from "@/lib/env";
import { isEmailAllowed, countProfiles, emailHasProfile } from "@/lib/db/queries";

const NOT_INVITED =
  "This email isn't on the invite list yet. Ask the owner to add you.";

const AT_CAPACITY =
  "Personal AI is at capacity right now — the beta is limited to a small group. Existing members can still sign in; new spots open up when someone leaves.";

/** Allowlist check. Open sign-ups by default (INVITE_ONLY unset); fails open
 * if the table isn't there yet. The same gate runs again in
 * app/auth/callback/route.ts so it also covers OAuth. */
async function emailPermitted(email: string): Promise<boolean> {
  if (!getEnv().INVITE_ONLY) return true;
  if (email === getEnv().OWNER_EMAIL?.toLowerCase()) return true;
  try {
    return await isEmailAllowed(email);
  } catch {
    return true;
  }
}

/** Seat cap. A brand-new email is refused once MAX_USERS accounts exist;
 * anyone who already has an account is always let through. Fails open on a
 * DB error so a blip can't lock everyone out. The OAuth door is guarded
 * separately in app/auth/callback/route.ts (email is unknown until then). */
async function seatAvailableFor(email: string): Promise<boolean> {
  const max = getEnv().MAX_USERS;
  if (max <= 0) return true;
  try {
    if (await emailHasProfile(email)) return true;
    return (await countProfiles()) < max;
  } catch {
    return true;
  }
}

async function siteOrigin() {
  // Prefer the configured site URL; fall back to the request's own origin.
  if (publicEnv.siteUrl) return publicEnv.siteUrl.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export type AuthFormState = {
  ok: boolean;
  message?: string;
  email?: string;
};

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

const NOT_CONFIGURED =
  "Sign-in isn't configured yet. Add your Supabase keys to .env.local (see docs/14-SETUP.md).";

export async function sendMagicLink(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return { ok: false, message: NOT_CONFIGURED };

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const email = parsed.data;
  const next = sanitizeNext(formData.get("next"));

  if (!(await emailPermitted(email))) {
    return { ok: false, message: NOT_INVITED, email };
  }

  if (!(await seatAvailableFor(email))) {
    return { ok: false, message: AT_CAPACITY, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });

  if (error) return { ok: false, message: error.message, email };
  return {
    ok: true,
    email,
    message: `We sent a sign-in link to ${email}. Check your inbox.`,
  };
}

/** One-click entry to the seeded read-only demo account. No inbox round-trip:
 * signs in with the demo password server-side and lands on the timeline. */
export async function signInAsDemo() {
  const email = process.env.DEMO_USER_EMAIL?.trim();
  const password = process.env.DEMO_USER_PASSWORD;
  if (!isSupabaseConfigured || !email || !password) {
    redirect(`/sign-in?error=${encodeURIComponent("The demo isn't available right now.")}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent("Couldn't open the demo. Try again.")}`);
  }
  redirect("/timeline");
}

export async function signInWithGoogle(formData: FormData) {
  if (!isSupabaseConfigured) {
    redirect(`/sign-in?error=${encodeURIComponent(NOT_CONFIGURED)}`);
  }
  const next = sanitizeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) {
    redirect(`/sign-in?error=${encodeURIComponent(error?.message ?? "oauth_failed")}`);
  }
  redirect(data.url);
}

function sanitizeNext(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  if (!v.startsWith("/") || v.startsWith("//")) return "/capture";
  return v;
}
