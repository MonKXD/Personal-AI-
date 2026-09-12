import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, CAPTURES_BUCKET } from "@/lib/supabase/admin";
import { deleteAllUserData, listUserObjectKeys } from "@/lib/db/queries";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ confirm: z.literal("DELETE") });

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new HttpError(400, "bad_request", "Confirmation missing.");
  }

  const admin = createAdminClient();

  // 1. storage
  const keys = await listUserObjectKeys(user.id);
  if (keys.length) {
    await admin.storage.from(CAPTURES_BUCKET).remove(keys);
  }

  // 2. app data (memories cascade; plus captures / tags / chats / prefs)
  await deleteAllUserData(user.id);

  // 3. auth user + profile
  await admin.auth.admin.deleteUser(user.id).catch(() => {});

  // 4. clear the session cookie
  await (await createClient()).auth.signOut().catch(() => {});

  return NextResponse.json({ ok: true });
});
