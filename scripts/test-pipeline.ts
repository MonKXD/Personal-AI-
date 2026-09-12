/**
 * End-to-end pipeline smoke test against your real Supabase.
 *
 *   npm run test:pipeline                       # DRY_RUN fixtures, deterministic
 *   npm run test:pipeline -- --real             # use the configured AI provider
 *   npm run test:pipeline -- --real ./notice.jpg  # …with a real image
 *
 * It picks your first auth user, uploads an image to the captures bucket,
 * inserts a captures row, runs the extraction pipeline, then prints the
 * resulting memory + chunk/embedding counts and a retrieval check. The test
 * memory is left in place so you can open it in the app.
 */
import { readFileSync } from "node:fs";

const REAL = process.argv.includes("--real");
const IMAGE_ARG = process.argv.find((a) => /\.(jpe?g|png|webp)$/i.test(a));
if (!REAL) process.env.DRY_RUN = "1";

import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { createHash } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

// A 2x2 red JPEG (base64).
const TINY_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AA//Z";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !supaUrl || !serviceKey) {
    console.error(
      "Need DATABASE_URL(_UNPOOLED), NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, max: 1 });
  const supabase = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // 1. pick a user
  const [u] = await sql<{ id: string; email: string }[]>`
    select id, email from auth.users order by created_at asc limit 1
  `;
  if (!u) {
    console.error("No users yet — sign in to the app once, then re-run.");
    process.exit(1);
  }
  console.log(`\nUsing user ${u.email} (${u.id})`);

  // Clean up any prior test captures for this user (cascades to memories/…).
  // The sha is from an earlier version of this script that had no device_hint.
  const cleared = await sql`
    delete from captures
    where user_id = ${u.id}
      and (device_hint = 'pipeline-test'
        or sha256 = '9c67a773bd3874fd2677e8b334a433c83a56f1d6bf1a39683b81cfbdb54bbf57')
  `;
  if (cleared.count) console.log(`Cleared ${cleared.count} previous test capture(s)`);

  // 2. choose an image, made unique per run so sha256 differs
  const { ulid } = await import("ulid");
  const captureId: string = ulid();
  const base = IMAGE_ARG
    ? readFileSync(IMAGE_ARG)
    : Buffer.from(TINY_JPEG_B64, "base64");
  const buf = Buffer.concat([base, Buffer.from(`\n<!-- ${captureId} -->`)]);
  const mime = IMAGE_ARG?.endsWith(".png")
    ? "image/png"
    : IMAGE_ARG?.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const key = `${u.id}/${captureId}/image.jpg`;
  console.log(
    `Mode: ${REAL ? "REAL (configured provider)" : "DRY_RUN fixtures"}` +
      (IMAGE_ARG ? ` · image: ${IMAGE_ARG}` : ""),
  );

  const up = await supabase.storage
    .from("captures")
    .upload(key, buf, { contentType: mime, upsert: true });
  if (up.error) {
    console.error("upload failed:", up.error.message);
    process.exit(1);
  }
  console.log(`Uploaded ${key} (${buf.length} bytes)`);

  // 3. insert the capture row
  await sql`
    insert into captures (id, user_id, status, original_key, display_key, thumb_key,
      mime, bytes, sha256, source, device_hint, captured_at)
    values (${captureId}, ${u.id}, 'queued', ${key}, ${key}, ${key},
      ${mime}, ${buf.length}, ${sha256}, 'upload', 'pipeline-test', now())
  `;
  console.log(`Inserted capture ${captureId} (status=queued)`);

  await sql.end();

  // 4. run the pipeline (relative import; forces DRY_RUN set above)
  const { runPipeline } = await import("../lib/pipeline/run");
  console.log("\nRunning pipeline…");
  await runPipeline(captureId);

  // 5. report
  const sql2 = postgres(url, { prepare: false, max: 1 });
  const [cap] = await sql2<{ status: string; error_code: string | null; timings: unknown }[]>`
    select status, error_code, timings from captures where id = ${captureId}
  `;
  const [mem] = await sql2<
    { id: string; type: string; title: string; summary: string }[]
  >`select id, type, title, summary from memories where capture_id = ${captureId}`;
  const counts = mem
    ? await sql2<{ chunks: number; embeddings: number; entities: number; tags: number }[]>`
        select
          (select count(*) from chunks where memory_id = ${mem.id})::int as chunks,
          (select count(*) from embeddings e join chunks c on c.id = e.chunk_id where c.memory_id = ${mem.id})::int as embeddings,
          (select count(*) from entities where memory_id = ${mem.id})::int as entities,
          (select count(*) from memory_tags where memory_id = ${mem.id})::int as tags
      `
    : [{ chunks: 0, embeddings: 0, entities: 0, tags: 0 }];
  await sql2.end();

  console.log("\n─── result ───");
  console.log("capture.status :", cap?.status, cap?.error_code ? `(${cap.error_code})` : "");
  if (mem) {
    console.log("memory.id      :", mem.id);
    console.log("memory.type    :", mem.type);
    console.log("memory.title   :", mem.title);
    console.log("chunks         :", counts[0].chunks);
    console.log("embeddings     :", counts[0].embeddings);
    console.log("entities       :", counts[0].entities);
    console.log("tags           :", counts[0].tags);
    console.log(`\nOpen it:  http://localhost:3000/memory/${mem.id}`);
  }

  // 6. retrieval — prove the pgvector cosine search + rerank path
  let retrievalOk = false;
  if (mem) {
    const { getEmbedder } = await import("../lib/ai");
    const { searchChunks } = await import("../lib/db/queries");
    const [qvec] = await getEmbedder().embed(["what did the notice say"]);
    const hits = await searchChunks(u.id, qvec, { limit: 5 });
    retrievalOk = hits.some((h) => h.memoryId === mem.id);
    console.log("\n─── retrieval ───");
    console.log("hits           :", hits.length);
    console.log(
      "top            :",
      hits[0] ? `${hits[0].title} (sim ${hits[0].sim.toFixed(3)})` : "none",
    );
    console.log("test memory in results:", retrievalOk);
  }

  const ok =
    cap?.status === "ready" && !!mem && counts[0].embeddings > 0 && retrievalOk;
  console.log(ok ? "\n\x1b[32mPipeline + retrieval OK.\x1b[0m\n" : "\n\x1b[31mSomething did not complete.\x1b[0m\n");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
