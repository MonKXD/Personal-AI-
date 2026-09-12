import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { getEmbedder, getChatModel, aiMode } from "@/lib/ai";
import type { ChatAnswer, ChatInput, ChatModel } from "@/lib/ai/types";
import { parseQuery } from "@/lib/pipeline/query-parser";
import {
  appendChatMessages,
  assertSessionOwner,
  countChatMessagesSince,
  createChatSession,
  getChatMessages,
  maybeTitleSession,
  searchChunks,
  type RetrievedChunk,
} from "@/lib/db/queries";
import { signImageUrls } from "@/lib/storage";
import { getEnv } from "@/lib/env";
import { reportError } from "@/lib/observe";

export const runtime = "nodejs";
export const maxDuration = 45;

const TZ = "Asia/Kolkata";
const TZ_OFFSET_MIN = 330;
const K = 8;
const MIN_SIM = 0.15;
const HISTORY_TURNS = 6;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(1000),
  sessionId: z.string().max(40).nullish(),
});

/** A short or anaphoric follow-up ("and the next one?", "what about Friday")
 * is meaningless to embed on its own — fold in the previous question. */
const ANAPHORIC = /^(and|also|then|what about|how about|those|that one|the next|next one|what else|why)\b/i;
function embedText(question: string, prevUserMsg: string | undefined): string {
  if (!prevUserMsg) return question;
  if (question.length < 24 || ANAPHORIC.test(question)) {
    return `${prevUserMsg}\n${question}`;
  }
  return question;
}

async function* oneShot(m: ChatModel, input: ChatInput): AsyncGenerator<string, ChatAnswer, void> {
  const a = await m.answer(input);
  if (a.answer) yield a.answer;
  return a;
}

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { text, sessionId: rawSessionId } = bodySchema.parse(await req.json());

  // Cheap rolling-window rate limit (abuse guard for open sign-ups).
  const hourAgo = new Date(Date.now() - 3_600_000);
  const askedThisHour = await countChatMessagesSince(user.id, hourAgo);
  if (askedThisHour >= getEnv().CHAT_HOURLY_LIMIT) {
    throw new HttpError(
      429,
      "rate_limited",
      "You've hit this hour's question limit. Try again a bit later.",
    );
  }

  // Shared free-tier guard — turn away new questions once the whole app has
  // spent today's Gemini call budget, rather than failing mid-stream.
  const { aiBudgetExceeded, AI_BUDGET_MESSAGE } = await import("@/lib/ai/usage");
  if (await aiBudgetExceeded()) {
    throw new HttpError(429, "ai_budget_reached", AI_BUDGET_MESSAGE);
  }

  // Resolve / create the chat session.
  let sessionId = rawSessionId ?? null;
  if (sessionId) {
    const owned = await assertSessionOwner(user.id, sessionId);
    if (!owned) sessionId = null;
  }
  const isNewSession = !sessionId;
  if (!sessionId) sessionId = await createChatSession(user.id);

  // Short-term conversation memory for follow-ups.
  const priorMsgs = isNewSession ? [] : await getChatMessages(user.id, sessionId).catch(() => []);
  const history = priorMsgs
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const prevUserMsg = [...history].reverse().find((m) => m.role === "user")?.content;

  const now = new Date();
  const parsed = parseQuery(text, now, TZ_OFFSET_MIN);

  const embedder = getEmbedder();
  const [qvec] = await embedder.embed([embedText(parsed.cleanedQuery, prevUserMsg)], "query");

  // Temporal filters are hard (unambiguous). Type is advisory only: a keyword
  // like "page", "document", or "notes" biases ranking via rerank() rather
  // than hard-excluding every other type from retrieval.
  const candidates = await searchChunks(user.id, qvec, {
    after: parsed.filters.after,
    before: parsed.filters.before,
    limit: K * 3,
  });

  const ranked = rerank(candidates, parsed.filters.types ?? [], now);
  // Fixture embeddings are random, so similarity is meaningless in DRY_RUN —
  // treat any retrieved chunk as signal there.
  const minSim = aiMode().embeddings === "fixture" ? 0 : MIN_SIM;
  const hasSignal =
    ranked.length > 0 &&
    (ranked[0].sim >= minSim ||
      Boolean(parsed.filters.types?.length) ||
      Boolean(parsed.filters.after));
  const context = hasSignal ? ranked.slice(0, K) : [];

  const model = getChatModel();
  const input: ChatInput = {
    question: parsed.cleanedQuery,
    now: now.toISOString(),
    timezone: TZ,
    history,
    context: context.map((c) => ({
      memoryId: c.memoryId,
      type: c.type,
      capturedAt: c.capturedAt.toISOString(),
      snippet: c.kind === "summary" ? `Title: ${c.title}\n${c.content}` : c.content,
    })),
  };

  const usedFilters = {
    types: parsed.filters.types ?? [],
    after: parsed.filters.after?.toISOString() ?? null,
    before: parsed.filters.before?.toISOString() ?? null,
    label: parsed.label,
  };

  const byMemory = new Map<string, RetrievedChunk>();
  for (const c of context) if (!byMemory.has(c.memoryId)) byMemory.set(c.memoryId, c);

  const enc = new TextEncoder();
  const finalSessionId = sessionId;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        } catch {
          /* client went away */
        }
      };

      let full: ChatAnswer;
      try {
        const gen = model.streamAnswer ? model.streamAnswer(input) : oneShot(model, input);
        while (true) {
          const step = await gen.next();
          if (step.done) {
            full = step.value;
            break;
          }
          send({ t: "delta", v: step.value });
        }
      } catch (e) {
        reportError(e, { where: "POST /api/chat (stream)", userId: user.id });
        send({
          t: "error",
          message: e instanceof Error ? e.message : "The chat model is unavailable.",
        });
        controller.close();
        return;
      }

      // Hydrate citations from the context we actually sent.
      const citedIds = full.citations.filter((id) => byMemory.has(id));
      const urls = await signImageUrls(citedIds.map((id) => byMemory.get(id)!.thumbKey)).catch(
        () => ({}) as Record<string, string>,
      );
      const citeBase = citedIds.map((id) => {
        const c = byMemory.get(id)!;
        return {
          memoryId: id,
          title: c.title || "Untitled memory",
          type: c.type,
          mime: c.mime,
          snippet: c.content.replace(/\s+/g, " ").slice(0, 160),
          thumbKey: c.thumbKey,
        };
      });
      const citations = citeBase.map(({ thumbKey, ...rest }) => ({
        ...rest,
        thumbUrl: urls[thumbKey] ?? null,
      }));

      // Persist the turn (store thumbKey, not an expiring signed URL).
      try {
        await appendChatMessages(user.id, finalSessionId, [
          { role: "user", content: text },
          {
            role: "assistant",
            content: full.answer,
            citations: citeBase,
            usedFilters,
            retrievalDebug: context.map((c) => ({
              chunkId: c.chunkId,
              memoryId: c.memoryId,
              sim: c.sim,
            })),
          },
        ]);
        await maybeTitleSession(user.id, finalSessionId, text);
      } catch {
        /* the answer already streamed; a persistence blip shouldn't 500 it */
      }

      send({
        t: "done",
        sessionId: finalSessionId,
        answer: full.answer,
        noMemory: full.no_memory,
        usedFilters,
        citations,
      });
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
});

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
  const out: (RetrievedChunk & { score: number })[] = [];
  for (const { r, score } of scored) {
    const n = perMemory.get(r.memoryId) ?? 0;
    if (n >= 2) continue;
    perMemory.set(r.memoryId, n + 1);
    out.push({ ...r, score });
  }
  return out;
}
