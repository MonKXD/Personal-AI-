import "server-only";

import { getEnv } from "@/lib/env";
import { startOfUtcDayForTz } from "@/lib/time";

/**
 * Shared free-tier budget guard. Google's free Gemini tier allows only on the
 * order of ~1,000 requests/day per project; one capture spends 1 extraction +
 * a handful of embedding calls (+ maybe a folder suggestion), one question
 * spends 1 embed + 1 answer. With ~10 users that's comfortable, but a busy day
 * could still brush the ceiling — so we count every successful call and, past
 * DAILY_AI_CALL_BUDGET, turn away *new* work with a friendly message instead of
 * letting it fail mid-request with a 429/503.
 *
 * The DB write is lazy-imported so this module (pulled in by lib/ai/gemini.ts)
 * doesn't drag the Drizzle client into every AI import site.
 */

function todayBucket(): Date {
  return startOfUtcDayForTz(new Date(), getEnv().APP_TZ);
}

/** Fire-and-forget. Records N successful Gemini HTTP calls against today's
 * bucket. Never throws — this is telemetry, not control flow. */
export function recordAiCalls(n = 1): void {
  if (n <= 0) return;
  void (async () => {
    try {
      const { bumpAiCalls } = await import("@/lib/db/queries");
      await bumpAiCalls(todayBucket(), n);
    } catch {
      /* ignore — a missed count is harmless */
    }
  })();
}

/** True when today's shared Gemini budget is spent. Fails open: any error
 * (DB blip, table missing) returns false so the app is never locked out by
 * the guard itself. 0 disables the guard entirely. */
export async function aiBudgetExceeded(): Promise<boolean> {
  const budget = getEnv().DAILY_AI_CALL_BUDGET;
  if (budget <= 0) return false;
  try {
    const { getAiCallsInBucket } = await import("@/lib/db/queries");
    const used = await getAiCallsInBucket(todayBucket());
    return used >= budget;
  } catch {
    return false;
  }
}

export const AI_BUDGET_MESSAGE =
  "MirrorMind's shared daily AI budget is used up (free-tier limit). It resets at midnight IST — please try again tomorrow.";
