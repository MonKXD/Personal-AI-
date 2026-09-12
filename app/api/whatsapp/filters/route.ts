import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiUser } from "@/lib/http";
import { getWhatsappFilterRules, setWhatsappFilterRule } from "@/lib/db/queries";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireApiUser();
  const rules = await getWhatsappFilterRules(user.id);
  return NextResponse.json({ rules });
});

const setSchema = z.object({
  chatId: z.string().min(1),
  action: z.enum(["mute", "always_flag"]),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  const { chatId, action } = setSchema.parse(await req.json());
  await setWhatsappFilterRule(user.id, chatId, action);
  return NextResponse.json({ ok: true });
});
