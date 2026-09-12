import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/http";
import { searchAll } from "@/lib/db/queries";
import { signImageUrls } from "@/lib/storage";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const { memories, sessions } = await searchAll(user.id, q);
  const urls = await signImageUrls(memories.map((m) => m.thumbKey));

  return NextResponse.json({
    memories: memories.map((m) => ({
      id: m.id,
      type: m.type,
      title: m.title,
      summary: m.summary,
      thumbUrl: urls[m.thumbKey] ?? null,
      mime: m.mime,
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
});
