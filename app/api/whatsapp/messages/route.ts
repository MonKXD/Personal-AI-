import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/http";
import { listWhatsappMessages } from "@/lib/db/queries";
import { WHATSAPP_CATEGORIES } from "@/lib/ai/types";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const category = new URL(req.url).searchParams.get("category");
  const messages = await listWhatsappMessages(user.id, {
    category: (WHATSAPP_CATEGORIES as readonly string[]).includes(category ?? "")
      ? (category as (typeof WHATSAPP_CATEGORIES)[number])
      : undefined,
  });
  return NextResponse.json({ messages });
});
