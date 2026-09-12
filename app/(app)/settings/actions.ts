"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, isOwner } from "@/lib/auth";
import { assertCanMutate } from "@/lib/http";
import { isDemoUser } from "@/lib/demo";
import { createAdminClient, CAPTURES_BUCKET } from "@/lib/supabase/admin";
import {
  addAllowedEmail,
  removeAllowedEmail,
  deleteAllUserData,
  listUserObjectKeys,
  upsertPrefs,
  createApiToken,
  revokeApiToken,
} from "@/lib/db/queries";
import { generateToken } from "@/lib/api-tokens";

const emailSchema = z.string().trim().toLowerCase().email();

async function assertOwner() {
  const user = await requireUser("/settings");
  if (!isOwner(user)) throw new Error("Not authorised.");
  return user;
}

export async function addInvite(formData: FormData): Promise<{ error?: string }> {
  const user = await assertOwner();
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email." };
  const note = (formData.get("note") as string | null)?.slice(0, 120) ?? null;
  await addAllowedEmail(parsed.data, note, user.id);
  revalidatePath("/settings/access");
  return {};
}

export async function removeInvite(formData: FormData): Promise<void> {
  await assertOwner();
  const email = formData.get("email");
  if (typeof email === "string") await removeAllowedEmail(email);
  revalidatePath("/settings/access");
}

/**
 * Owner-only: permanently remove a member — deletes their auth account, all
 * their captures/memories/etc., and their stored files. Frees a seat against
 * MAX_USERS. The owner and the read-only demo account can't be removed.
 */
export async function removeMember(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const owner = await assertOwner();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { error: "No member selected." };
  if (userId === owner.id) return { error: "You can't remove yourself." };
  if (isDemoUser(userId)) return { error: "The demo account can't be removed." };

  const admin = createAdminClient();
  try {
    const keys = await listUserObjectKeys(userId);
    if (keys.length) {
      await admin.storage.from(CAPTURES_BUCKET).remove(keys).catch(() => {});
    }
    await deleteAllUserData(userId);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  } catch {
    return { error: "Couldn't fully remove that member. Try again." };
  }
  revalidatePath("/settings/access");
  return { ok: true };
}

const prefsSchema = z.object({
  tz: z.string().min(1).max(64),
  emailReminders: z.enum(["on", "off"]),
  weeklyDigest: z.enum(["on", "off"]),
});

export async function savePrefs(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser("/settings");
  try {
    assertCanMutate(user);
  } catch {
    return { error: "This is the read-only demo — sign up to change settings." };
  }
  const parsed = prefsSchema.safeParse({
    tz: formData.get("tz"),
    emailReminders: formData.get("emailReminders") ?? "off",
    weeklyDigest: formData.get("weeklyDigest") ?? "off",
  });
  if (!parsed.success) return { error: "Couldn't save those settings." };
  // Validate the timezone string.
  try {
    new Intl.DateTimeFormat("en", { timeZone: parsed.data.tz });
  } catch {
    return { error: "That timezone isn't recognised." };
  }
  await upsertPrefs(user.id, {
    tz: parsed.data.tz,
    emailReminders: parsed.data.emailReminders === "on",
    weeklyDigest: parsed.data.weeklyDigest === "on",
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------ API keys ------------------------------- */

export async function createApiKey(
  _prev: { token?: string; error?: string },
  formData: FormData,
): Promise<{ token?: string; error?: string }> {
  const user = await requireUser("/settings");
  try {
    assertCanMutate(user);
  } catch {
    return { error: "The read-only demo can't create API keys." };
  }
  const name = String(formData.get("name") ?? "").trim().slice(0, 60) || "API token";
  const { token, hash, prefix } = generateToken();
  await createApiToken(user.id, name, hash, prefix);
  revalidatePath("/settings");
  return { token }; // shown once
}

export async function revokeApiKey(formData: FormData): Promise<void> {
  const user = await requireUser("/settings");
  assertCanMutate(user);
  const id = String(formData.get("id") ?? "");
  if (id) await revokeApiToken(user.id, id);
  revalidatePath("/settings");
}

/* ------------------------------ webhooks ------------------------------ */

const WEBHOOK_EVENTS = [
  "capture.completed",
  "memory.created",
  "action_item.due_soon",
  "digest.weekly",
] as const;

export async function createWebhookAction(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser("/settings");
  try {
    assertCanMutate(user);
  } catch {
    return { error: "The read-only demo can't add webhooks." };
  }
  const url = String(formData.get("url") ?? "").trim();
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
  } catch {
    return { error: "Enter a valid http(s) URL." };
  }
  const events = WEBHOOK_EVENTS.filter((e) => formData.get(e) === "on");
  if (events.length === 0) return { error: "Pick at least one event." };

  const { createWebhook } = await import("@/lib/db/queries");
  const { newWebhookSecret } = await import("@/lib/webhooks");
  await createWebhook(user.id, url, newWebhookSecret(), events);
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteWebhookAction(formData: FormData): Promise<void> {
  const user = await requireUser("/settings");
  assertCanMutate(user);
  const id = String(formData.get("id") ?? "");
  if (id) {
    const { deleteWebhook } = await import("@/lib/db/queries");
    await deleteWebhook(user.id, id);
  }
  revalidatePath("/settings");
}

/* ------------------------------ telegram ----------------------------- */

export async function connectTelegram(): Promise<{ url?: string; error?: string }> {
  const user = await requireUser("/settings");
  try {
    assertCanMutate(user);
  } catch {
    return { error: "The read-only demo can't link Telegram." };
  }
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  if (!bot) return { error: "Telegram isn't configured on this server." };
  const { randomBytes } = await import("node:crypto");
  const code = randomBytes(9).toString("base64url");
  const { setTelegramLinkCode } = await import("@/lib/db/queries");
  await setTelegramLinkCode(user.id, code, new Date(Date.now() + 15 * 60_000));
  return { url: `https://t.me/${bot.replace(/^@/, "")}?start=${code}` };
}

export async function disconnectTelegram(): Promise<void> {
  const user = await requireUser("/settings");
  assertCanMutate(user);
  const { unlinkTelegram } = await import("@/lib/db/queries");
  await unlinkTelegram(user.id);
  revalidatePath("/settings");
}
