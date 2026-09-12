/**
 * Diagnose why browser-uploaded captures aren't being processed.
 *   npm run diagnose            # report only
 *   npm run diagnose -- --fix   # also delete failed (non-test) captures + their files
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const FIX = process.argv.includes("--fix");

const redact = (s?: string) => (s ? s.replace(/:[^:@/]+@/, ":****@") : "(MISSING)");

async function main() {
  const pooled = process.env.DATABASE_URL;
  const direct = process.env.DATABASE_URL_UNPOOLED;

  console.log("── env ──");
  console.log("DATABASE_URL           :", redact(pooled));
  console.log("DATABASE_URL_UNPOOLED  :", redact(direct));
  console.log("SUPABASE_SERVICE_ROLE  :", process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "(MISSING)");
  console.log("GOOGLE_API_KEY         :", process.env.GOOGLE_API_KEY ? "set" : "(MISSING)");
  console.log("AI_PROVIDER            :", process.env.AI_PROVIDER || "(auto)");

  // 1. can the app's own connection (pooled DATABASE_URL) even connect + write?
  console.log("\n── app connection (DATABASE_URL, the one the API routes use) ──");
  if (!pooled) {
    console.log("  ✗ DATABASE_URL is not set — the pipeline's getDb() throws immediately.");
  } else {
    try {
      const app = postgres(pooled, { prepare: false, max: 1, idle_timeout: 5 });
      const [{ v }] = await app<{ v: number }[]>`select 1 as v`;
      console.log("  ✓ connect + select:", v === 1);
      // transaction test — insertMemoryGraph uses db.transaction()
      await app.begin(async (tx) => {
        await tx`select 1`;
      });
      console.log("  ✓ transaction (BEGIN/COMMIT) works on this connection");
      await app.end();
    } catch (e) {
      console.log("  ✗ FAILED:", (e as Error).message);
    }
  }

  // 2. recent captures + their status
  const sql = postgres(direct ?? pooled ?? "", { prepare: false, max: 1 });
  const rows = await sql<
    {
      id: string;
      status: string;
      error_code: string | null;
      err: string | null;
      device_hint: string | null;
      source: string;
      created_at: Date;
      updated_at: Date;
      mem: number;
    }[]
  >`
    select c.id, c.status, c.error_code, left(coalesce(c.error_detail,''),160) as err,
           c.device_hint, c.source, c.created_at, c.updated_at,
           (select count(*) from memories m where m.capture_id = c.id)::int as mem
    from captures c order by c.created_at desc limit 20`;

  console.log("\n── recent captures ──");
  if (rows.length === 0) console.log("  (none — uploads aren't creating capture rows at all)");
  for (const r of rows) {
    console.log(
      `  ${r.created_at.toISOString().slice(0, 19)}  ${r.status.padEnd(10)} mem=${r.mem} src=${r.source} ${r.device_hint ?? ""} ${r.error_code ?? ""} ${r.err ?? ""}`,
    );
  }

  const stuck = rows.filter((r) => r.status !== "ready" && r.status !== "failed" && r.device_hint !== "pipeline-test");
  const failed = rows.filter((r) => r.status === "failed" && r.device_hint !== "pipeline-test");
  console.log(`\n  stuck (queued/extracting/embedding): ${stuck.length}`);
  console.log(`  failed: ${failed.length}`);

  if (FIX && (failed.length || stuck.length)) {
    const doomed = [...failed, ...stuck];
    console.log(`\n── --fix: removing ${doomed.length} capture(s) + their storage ──`);
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supaUrl, svc, { auth: { persistSession: false } });
    for (const r of doomed) {
      const [{ user_id }] = await sql<{ user_id: string }[]>`
        select user_id from captures where id = ${r.id}`;
      const prefix = `${user_id}/${r.id}`;
      const { data: files } = await supabase.storage.from("captures").list(prefix);
      if (files?.length) {
        await supabase.storage
          .from("captures")
          .remove(files.map((f) => `${prefix}/${f.name}`));
      }
      await sql`delete from captures where id = ${r.id}`;
      console.log(`  removed ${r.id}`);
    }
    console.log("  done.");
  } else if (FIX) {
    console.log("\n── --fix: nothing to remove ──");
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
