import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/http";
import { listMemories } from "@/lib/db/queries";
import { signImageUrls } from "@/lib/storage";
import { MEMORY_TYPES, type MemoryType } from "@/lib/memory-types";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const url = new URL(req.url);

  const types = (url.searchParams.get("types") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is MemoryType => (MEMORY_TYPES as readonly string[]).includes(s));

  const parseDate = (k: string) => {
    const v = url.searchParams.get(k);
    return v && !Number.isNaN(Date.parse(v)) ? new Date(v) : undefined;
  };

  const { items, nextCursor } = await listMemories(user.id, {
    types: types.length ? types : undefined,
    after: parseDate("after"),
    before: parseDate("before"),
    q: url.searchParams.get("q") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: Number(url.searchParams.get("limit")) || 24,
  });

  const urls = await signImageUrls(items.map((i) => i.thumbKey));
  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      summary: i.summary,
      capturedAt: i.capturedAt,
      ocrConfidence: i.ocrConfidence,
      thumbUrl: urls[i.thumbKey] ?? null,
    })),
    nextCursor,
  });
});
