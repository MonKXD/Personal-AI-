import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getEnv } from "@/lib/env";
import { isEmailAllowed } from "@/lib/db/queries";
import { isDemoUser } from "@/lib/demo";

/** Returns the current user or null. Never throws. */
export async function getUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export function isOwner(user: User | null): boolean {
  const owner = getEnv().OWNER_EMAIL?.toLowerCase();
  return !!owner && user?.email?.toLowerCase() === owner;
}

/** True unless invite-only is on AND the user's email has been removed from the
 * allowlist. Owner and the read-only demo are always allowed. Fail-open. */
async function stillAllowed(user: User): Promise<boolean> {
  if (isOwner(user) || isDemoUser(user.id)) return true;
  // Open sign-ups: the allowlist table isn't a gate, so don't consult it here
  // (it may hold only a partial list, or be empty).
  if (!getEnv().INVITE_ONLY) return true;
  const email = user.email?.toLowerCase();
  if (!email) return true;
  try {
    return await isEmailAllowed(email);
  } catch {
    return true; // table missing / transient DB issue — don't lock people out
  }
}

/** Returns the current user or redirects to sign-in. Use in the app layout. */
export async function requireUser(nextPath?: string): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirect(nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in");
  }

  if (!(await stillAllowed(user))) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/sign-in?error=not_invited");
  }

  return user;
}

/** Display helpers for the user menu. */
export function userDisplayName(user: User): string {
  return (
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "You"
  );
}

export function userInitials(user: User): string {
  const name = userDisplayName(user).trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
