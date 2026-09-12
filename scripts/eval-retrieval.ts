/**
 * Retrieval eval harness. Measures whether MirrorMind actually finds the right
 * memory for a question — the thing chat quality rests on.
 *
 *   npm run eval                 # retrieval only (recall@k, MRR) — real embeddings
 *   npm run eval -- --chat       # also run the chat model: citation F1, no-memory accuracy
 *   npm run eval -- --json       # machine-readable summary on stdout
 *   npm run eval -- --k 8        # top-k window (default 5 for scoring, retrieval fetches 3x)
 *
 * Corpus: the seeded demo account (`npm run seed:demo`). Set EVAL_USER_ID to
 * point at a different fixture user; falls back to DEMO_USER_ID.
 *
 * Needs GOOGLE_API_KEY + DATABASE_URL(_UNPOOLED) + NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY in the environment. Exits non-zero if any metric
 * drops below the thresholds below — safe to run in CI.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { readFileSync } from "node:fs";
import postgres from "postgres";

const WANT_CHAT = process.argv.includes("--chat");
const AS_JSON = process.argv.includes("--json");
const K = numArg("--k", 5);

// Fail the run if any of these regress.
const THRESHOLDS = {
  "recall@1": 0.65,
  "recall@3": 0.8,
  "recall@5": 0.85,
  mrr: 0.72,
  // only enforced with --chat
  citationF1: 0.7,
  noMemoryAccuracy: 0.9,
};

const TZ_OFFSET_MIN = 330;

type Case = { q: string; expect: string[]; noMemory?: boolean };

function numArg(flag: string, dflt: number): number {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
}

function log(...a: unknown[]) {
  if (!AS_JSON) console.log(...a);
}

/** the chat route's rerank, kept in sync by hand (app/api/chat/route.ts) */
function rerank<T extends { sim: number; capturedAt: Date; type: string; memoryId: string }>(
  rows: T[],
  filterTypes: string[],
  now: Date,
): T[] {
  const nowMs = now.getTime();
  const scored = rows.map((r) => {
    const ageDays = (nowMs - r.capturedAt.getTime()) / 86_400_000;
    const recency = Math.max(0, 1 - ageDays / 14);
    const typeMatch = filterTypes.includes(r.type) ? 1 : 0;
    return { r, score: r.sim + 0.05 * recency + 0.08 * typeMatch };
  });
  scored.sort((a, b) => b.score - a.score);
  const perMemory = new Map<string, number>();
  const out: T[] = [];
  for (const { r } of scored) {
    const n = perMemory.get(r.memoryId) ?? 0;
    if (n >= 2) continue;
    perMemory.set(r.memoryId, n + 1);
    out.push(r);
  }
  return out;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  const userId = (process.env.EVAL_USER_ID ?? process.env.DEMO_USER_ID ?? "").trim();
  if (!dbUrl || !process.env.GOOGLE_API_KEY) {
    console.error("eval: need DATABASE_URL(_UNPOOLED) and GOOGLE_API_KEY.");
    process.exit(2);
  }
  if (!userId) {
    console.error("eval: set EVAL_USER_ID or DEMO_USER_ID to the fixture account.");
    process.exit(2);
  }

  const { cases } = JSON.parse(
    readFileSync(new URL("./eval/cases.json", import.meta.url), "utf8"),
  ) as { cases: Case[] };

  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  const memRows = await sql<{ id: string; title: string }[]>`
    select id, title from memories where user_id = ${userId} and deleted_at is null`;
  await sql.end();
  if (memRows.length === 0) {
    console.error(`eval: no memories for ${userId} — run \`npm run seed:demo\` first.`);
    process.exit(2);
  }

  const resolve = (needles: string[]): string[] => {
    const ids = needles.map((n) => {
      const hit = memRows.find((m) => m.title.toLowerCase().includes(n.toLowerCase()));
      if (!hit) throw new Error(`eval case references unknown memory "${n}"`);
      return hit.id;
    });
    return [...new Set(ids)];
  };

  const { getEmbedder, getChatModel } = await import("../lib/ai");
  const { searchChunks } = await import("../lib/db/queries");
  const { parseQuery } = await import("../lib/pipeline/query-parser");
  const embedder = getEmbedder();
  const chat = WANT_CHAT ? getChatModel() : null;

  let hits1 = 0,
    hits3 = 0,
    hitsK = 0,
    rrSum = 0,
    retrievalScored = 0;
  let citTP = 0,
    citFP = 0,
    citFN = 0,
    noMemTotal = 0,
    noMemRight = 0,
    chatSkipped = 0;

  const rows: string[] = [];

  for (const c of cases) {
    const now = new Date();
    const parsed = parseQuery(c.q, now, TZ_OFFSET_MIN);
    const [qvec] = await embedder.embed([parsed.cleanedQuery], "query");
    const candidates = await searchChunks(userId, qvec, {
      after: parsed.filters.after,
      before: parsed.filters.before,
      limit: K * 3,
    });
    const ranked = rerank(candidates, parsed.filters.types ?? [], now);

    const orderedMemIds: string[] = [];
    for (const r of ranked) if (!orderedMemIds.includes(r.memoryId)) orderedMemIds.push(r.memoryId);

    let line: string;
    if (c.noMemory || c.expect.length === 0) {
      // retrieval isn't scored for a decline case; top sim is informational
      const topSim = ranked[0]?.sim ?? 0;
      line = `  ·  (decline)  topSim=${topSim.toFixed(2)}  "${c.q}"`;
    } else {
      const want = resolve(c.expect);
      // rank = best position among any expected memory (1-indexed)
      const positions = want
        .map((id) => orderedMemIds.indexOf(id))
        .filter((i) => i >= 0)
        .map((i) => i + 1);
      const rank = positions.length ? Math.min(...positions) : Infinity;
      retrievalScored++;
      if (rank === 1) hits1++;
      if (rank <= 3) hits3++;
      if (rank <= K) hitsK++;
      rrSum += rank === Infinity ? 0 : 1 / rank;
      const mark = rank <= 3 ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
      line = `  ${mark}  rank=${rank === Infinity ? "—" : rank}  "${c.q}"`;
    }

    if (chat) {
      const input = {
        question: parsed.cleanedQuery,
        now: now.toISOString(),
        timezone: "Asia/Kolkata",
        context: ranked.slice(0, K).map((r) => ({
          memoryId: r.memoryId,
          type: r.type,
          capturedAt: r.capturedAt.toISOString(),
          snippet: r.kind === "summary" ? `Title: ${r.title}\n${r.content}` : r.content,
        })),
      };
      let ans;
      try {
        ans = await chat.answer(input);
      } catch (e) {
        chatSkipped++;
        line += /429|quota|rate limit/i.test(String(e))
          ? "  \x1b[33m[chat skipped: quota]\x1b[0m"
          : "  \x1b[33m[chat skipped: error]\x1b[0m";
        rows.push(line);
        continue;
      }
      if (c.noMemory) {
        noMemTotal++;
        if (ans.no_memory) noMemRight++;
        line += ans.no_memory ? "  \x1b[32m[declined]\x1b[0m" : "  \x1b[31m[answered anyway]\x1b[0m";
      } else if (c.expect.length) {
        const want = new Set(resolve(c.expect));
        const got = new Set(ans.citations.filter((id) => memRows.some((m) => m.id === id)));
        for (const id of got) {
          if (want.has(id)) citTP++;
          else citFP++;
        }
        for (const id of want) if (!got.has(id)) citFN++;
      }
    }

    rows.push(line);
  }

  const m: Record<string, number> = {
    "recall@1": safe(hits1, retrievalScored),
    "recall@3": safe(hits3, retrievalScored),
    "recall@5": safe(hitsK, retrievalScored),
    mrr: safe(rrSum, retrievalScored),
  };
  // Chat metrics are only trustworthy if most chat calls actually completed —
  // a free-tier 429 wall shouldn't read as a quality regression.
  const chatInconclusive = chat && chatSkipped > cases.length / 3;
  if (chat && !chatInconclusive) {
    const precision = safe(citTP, citTP + citFP);
    const recall = safe(citTP, citTP + citFN);
    m.citationF1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    m.noMemoryAccuracy = safe(noMemRight, noMemTotal);
  }
  if (chatInconclusive) {
    log(`\n  \x1b[33mchat metrics skipped — ${chatSkipped}/${cases.length} calls failed (quota?). Retrieval metrics still apply.\x1b[0m`);
  }

  const failures = Object.entries(m).filter(
    ([k, v]) => k in THRESHOLDS && v < THRESHOLDS[k as keyof typeof THRESHOLDS],
  );

  if (AS_JSON) {
    console.log(JSON.stringify({ userId, k: K, chat: WANT_CHAT, chatSkipped, cases: cases.length, metrics: m, pass: failures.length === 0 }, null, 2));
  } else {
    log("");
    for (const r of rows) log(r);
    log("\n  ── metrics ──");
    for (const [k, v] of Object.entries(m)) {
      const thr = THRESHOLDS[k as keyof typeof THRESHOLDS];
      const bad = thr !== undefined && v < thr;
      log(`  ${bad ? "\x1b[31m" : "\x1b[32m"}${k.padEnd(18)} ${v.toFixed(3)}\x1b[0m${thr !== undefined ? `   (min ${thr})` : ""}`);
    }
    log(
      failures.length === 0
        ? "\n\x1b[32mEVAL PASSED\x1b[0m\n"
        : `\n\x1b[31mEVAL FAILED — ${failures.map(([k]) => k).join(", ")}\x1b[0m\n`,
    );
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

function safe(n: number, d: number): number {
  return d === 0 ? 0 : n / d;
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
