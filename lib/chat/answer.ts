import "server-only";

import { getEmbedder, getChatModel, aiMode } from "@/lib/ai";
import { parseQuery } from "@/lib/pipeline/query-parser";
import { searchChunks, type RetrievedChunk } from "@/lib/db/queries";

/**
 * One-shot question answering — the retrieval + rerank + answer path from
 * app/api/chat/route.ts, minus the streaming and session persistence. Used by
 * the public API (`POST /api/v1/ask`).
 */

const K = 8;
const MIN_SIM = 0.15;
const TZ = "Asia/Kolkata";
const TZ_OFFSET_MIN = 330;

export type AnswerResult = {
  answer: string;
  noMemory: boolean;
  citations: { memoryId: string; title: string; type: string; snippet: string }[];
  usedFilters: { types: string[]; after: string | null; before: string | null };
};

function rerank(rows: RetrievedChunk[], filterTypes: string[], now: Date) {
  const nowMs = now.getTime();
  const scored = rows.map((r) => {
    const ageDays = (nowMs - r.capturedAt.getTime()) / 86_400_000;
    const recency = Math.max(0, 1 - ageDays / 14);
    const typeMatch = filterTypes.includes(r.type) ? 1 : 0;
    return { r, score: r.sim + 0.05 * recency + 0.08 * typeMatch };
  });
  scored.sort((a, b) => b.score - a.score);
  const perMemory = new Map<string, number>();
  const out: RetrievedChunk[] = [];
  for (const { r } of scored) {
    const n = perMemory.get(r.memoryId) ?? 0;
    if (n >= 2) continue;
    perMemory.set(r.memoryId, n + 1);
    out.push(r);
  }
  return out;
}

export async function answerQuestion(userId: string, question: string): Promise<AnswerResult> {
  const now = new Date();
  const parsed = parseQuery(question, now, TZ_OFFSET_MIN);

  const [qvec] = await getEmbedder().embed([parsed.cleanedQuery], "query");
  const candidates = await searchChunks(userId, qvec, {
    after: parsed.filters.after,
    before: parsed.filters.before,
    limit: K * 3,
  });
  const ranked = rerank(candidates, parsed.filters.types ?? [], now);

  const minSim = aiMode().embeddings === "fixture" ? 0 : MIN_SIM;
  const hasSignal =
    ranked.length > 0 &&
    (ranked[0].sim >= minSim ||
      Boolean(parsed.filters.types?.length) ||
      Boolean(parsed.filters.after));
  const context = hasSignal ? ranked.slice(0, K) : [];

  const model = getChatModel();
  const full = await model.answer({
    question: parsed.cleanedQuery,
    now: now.toISOString(),
    timezone: TZ,
    context: context.map((c) => ({
      memoryId: c.memoryId,
      type: c.type,
      capturedAt: c.capturedAt.toISOString(),
      snippet: c.kind === "summary" ? `Title: ${c.title}\n${c.content}` : c.content,
    })),
  });

  const byMemory = new Map<string, RetrievedChunk>();
  for (const c of context) if (!byMemory.has(c.memoryId)) byMemory.set(c.memoryId, c);

  return {
    answer: full.answer,
    noMemory: full.no_memory,
    citations: full.citations
      .filter((id) => byMemory.has(id))
      .map((id) => {
        const c = byMemory.get(id)!;
        return {
          memoryId: id,
          title: c.title || "Untitled memory",
          type: c.type,
          snippet: c.content.replace(/\s+/g, " ").slice(0, 200),
        };
      }),
    usedFilters: {
      types: parsed.filters.types ?? [],
      after: parsed.filters.after?.toISOString() ?? null,
      before: parsed.filters.before?.toISOString() ?? null,
    },
  };
}
