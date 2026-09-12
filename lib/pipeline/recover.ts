import "server-only";

import {
  findStuckCaptures,
  findStuckCapturesForUser,
  setCaptureStatus,
} from "@/lib/db/queries";
import { runPipeline } from "./run";

/** A capture stuck this long in a non-terminal state is presumed dead. */
const STUCK_MS = 4 * 60 * 1000;

/**
 * Re-runs captures whose pipeline invocation died (a deploy mid-request, a
 * timeout). Safe to call often — runPipeline is idempotent (delete-then-insert).
 */
export async function recoverStuckForUser(userId: string): Promise<number> {
  const stuck = await findStuckCapturesForUser(userId, STUCK_MS);
  for (const c of stuck) {
    await setCaptureStatus(c.id, "queued");
    void runPipeline(c.id).catch(() => {});
  }
  return stuck.length;
}

/** Cron entrypoint — recover across all users. */
export async function recoverStuckGlobal(max = 25): Promise<{ recovered: string[] }> {
  const stuck = await findStuckCaptures(STUCK_MS, max);
  const recovered: string[] = [];
  for (const c of stuck) {
    await setCaptureStatus(c.id, "queued");
    // sequential so a burst doesn't hammer the AI quota
    await runPipeline(c.id).catch(() => {});
    recovered.push(c.id);
  }
  return { recovered };
}
