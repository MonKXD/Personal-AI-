// First-day launch monitor: AI-call budget + capture health + activity.
// Read-only. Run:  node scripts/monitor-day1.mjs
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="))
  ?.slice("DATABASE_URL=".length)
  .trim();
const BUDGET = Number(
  readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith("DAILY_AI_CALL_BUDGET="))?.split("=")[1]?.trim() || "800",
);
const sql = postgres(url, { prepare: false, max: 1 });

// IST midnight today, as a timestamptz — matches lib/ai/usage.ts bucket.
const bucket = sql`(date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')`;

try {
  const [{ calls }] = await sql`
    select coalesce((select calls from ai_call_log where bucket_start = ${bucket}), 0)::int calls`;

  const caps = await sql`
    select status, count(*)::int n from captures
    where created_at >= ${bucket} group by status order by n desc`;
  const failed = await sql`
    select id, error_code, created_at from captures
    where created_at >= ${bucket} and status = 'failed' order by created_at desc limit 10`;

  const [{ chats }] = await sql`
    select count(*)::int chats from chat_messages
    where created_at >= ${bucket} and role = 'user'`;
  const [{ users }] = await sql`select count(*)::int users from profiles`;
  const [{ active }] = await sql`
    select count(distinct user_id)::int active from captures where created_at >= ${bucket}`;
  const [{ signups }] = await sql`
    select count(*)::int signups from profiles where created_at >= ${bucket}`;

  const pct = BUDGET > 0 ? Math.round((calls / BUDGET) * 100) : 0;
  const capLine = caps.map((c) => `${c.status}:${c.n}`).join("  ") || "none";

  console.log(`── MirrorMind day-1 monitor · ${new Date().toISOString()} ──`);
  console.log(`AI calls today   ${calls} / ${BUDGET}  (${pct}%)   ${pct >= 80 ? "⚠️  APPROACHING" : pct >= 50 ? "· watch" : "· ok"}`);
  console.log(`Captures today   ${capLine}`);
  console.log(`Chat questions   ${chats}`);
  console.log(`Users total      ${users}   (signed up today: ${signups})   active today: ${active}`);
  if (failed.length) {
    console.log(`\nFailed captures (${failed.length}):`);
    for (const f of failed) console.log(`  ${f.created_at.toISOString()}  ${f.error_code ?? "?"}  ${f.id}`);
  } else {
    console.log(`Failed captures  none ✅`);
  }
} finally {
  await sql.end();
}
