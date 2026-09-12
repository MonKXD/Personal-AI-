/**
 * Find (and optionally delete) storage objects in the `captures` bucket that no
 * live capture points at any more — e.g. files left behind by memory deletes
 * from before storage cleanup existed.
 *
 *   npm run sweep:orphans            # dry run — just report
 *   npm run sweep:orphans -- --apply # actually delete them
 *
 * Needs DATABASE_URL(_UNPOOLED), NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const BUCKET = "captures";

async function main() {
  const dbUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !supaUrl || !key) {
    console.error("Need DATABASE_URL(_UNPOOLED), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  const supabase = createClient(supaUrl, key, { auth: { persistSession: false } });

  // Keys still in use: any capture whose memory row is absent (still
  // processing) or not soft-deleted.
  const rows = await sql<{ o: string; d: string; t: string }[]>`
    select c.original_key o, c.display_key d, c.thumb_key t
    from captures c
    left join memories m on m.capture_id = c.id
    where m.id is null or m.deleted_at is null
  `;
  const live = new Set(rows.flatMap((r) => [r.o, r.d, r.t]));
  console.log(`${live.size} keys referenced by live captures`);

  // Walk the bucket: userId/ -> captureId/ -> files
  const listAll = async (prefix: string): Promise<string[]> => {
    const out: string[] = [];
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: 100, offset });
      if (error) throw error;
      if (!data.length) break;
      for (const e of data) {
        const path = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.id === null) out.push(...(await listAll(path))); // folder
        else out.push(path);
      }
      if (data.length < 100) break;
      offset += 100;
    }
    return out;
  };

  const all = await listAll("");
  const orphans = all.filter((k) => !live.has(k));
  console.log(`${all.length} objects in the bucket · ${orphans.length} orphaned`);

  if (orphans.length === 0) {
    await sql.end();
    return;
  }
  for (const k of orphans.slice(0, 20)) console.log(`  ${k}`);
  if (orphans.length > 20) console.log(`  … and ${orphans.length - 20} more`);

  if (!APPLY) {
    console.log("\nDry run — re-run with --apply to delete these.");
    await sql.end();
    return;
  }

  let removed = 0;
  for (let i = 0; i < orphans.length; i += 100) {
    const batch = orphans.slice(i, i + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) console.error("remove failed:", error.message);
    else removed += batch.length;
  }
  console.log(`\nRemoved ${removed} orphaned objects.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
