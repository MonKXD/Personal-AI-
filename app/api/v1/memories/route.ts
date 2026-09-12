import { v1, v1json, OPTIONS } from "@/lib/api-v1";
import { listMemories } from "@/lib/db/queries";
import { MEMORY_TYPES, type MemoryType } from "@/lib/memory-types";

export const runtime = "nodejs";
export { OPTIONS };

/**
 * GET /api/v1/memories — list, newest first.
 *   ?q=      full-text over title/summary/body
 *   ?type=   comma-separated memory types
 *   ?since=  ISO date; only memories captured at/after
 *   ?limit=  1–100 (default 25)   ?cursor=  from a previous next_cursor
 */
export const GET = v1(async (actor, req) => {
  const u = new URL(req.url);
  const types = (u.searchParams.get("type") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is MemoryType => (MEMORY_TYPES as readonly string[]).includes(s));
  const sinceRaw = u.searchParams.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : undefined;

  const { items, nextCursor } = await listMemories(actor.userId, {
    q: u.searchParams.get("q") ?? undefined,
    types: types.length ? types : undefined,
    after: since && !isNaN(since.getTime()) ? since : undefined,
    limit: Math.min(Math.max(Number(u.searchParams.get("limit")) || 25, 1), 100),
    cursor: u.searchParams.get("cursor") ?? undefined,
  });

  return v1json({
    items: items.map((m) => ({
      id: m.id,
      type: m.type,
      title: m.title,
      summary: m.summary,
      tags: m.tags,
      captured_at: m.capturedAt,
    })),
    next_cursor: nextCursor,
  });
});
