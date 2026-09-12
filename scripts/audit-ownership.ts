/**
 * Cross-tenant ownership audit — run before shipping, especially now that
 * sign-ups are open. The app talks to Postgres over a service-role connection
 * that BYPASSES RLS, so isolation depends entirely on every query carrying an
 * `eq(userId, …)` filter. This seeds a throwaway user B, then calls every
 * user-scoped query in lib/db/queries.ts as user A with B's resource ids and
 * asserts nothing leaks and nothing mutates.
 *
 *   npm run audit:ownership
 *
 * User A is your first real auth user (read-only here). User B is created and
 * deleted by this script (cascades clean up its rows).
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
process.env.DRY_RUN = "1";

import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { ulid } from "ulid";

const DB = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!;
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31m✗ ${name}\x1b[0m ${detail}`);
  }
}

async function main() {
  const sql = postgres(DB, { prepare: false, max: 1 });
  const admin = createClient(SUPA, SERVICE, { auth: { persistSession: false } });

  const [userA] = await sql<{ id: string; email: string }[]>`
    select id, email from auth.users order by created_at asc limit 1`;
  if (!userA) throw new Error("No users — sign in once first.");
  console.log(`user A (victim's data owner): ${userA.email}`);

  // ---- create throwaway user B ----
  const bEmail = `ownership-audit+${Date.now()}@example.invalid`;
  const { data: bUser, error: bErr } = await admin.auth.admin.createUser({
    email: bEmail,
    email_confirm: true,
  });
  if (bErr || !bUser.user) throw new Error(`createUser B failed: ${bErr?.message}`);
  const B = bUser.user.id;
  console.log(`user B (attacker): ${bEmail}\n`);

  // ---- seed B's data ----
  const capB = ulid();
  const memB = ulid();
  const chunkB = ulid();
  const folderB = ulid();
  const sessB = ulid();
  const aiB = ulid();
  const now = new Date();
  const zeros = `[${Array(1024).fill(0).join(",")}]`;

  try {
    await sql`insert into folders (id, user_id, name) values (${folderB}, ${B}, ${"B_secret_folder"})`;
    await sql`insert into captures (id, user_id, status, original_key, display_key, thumb_key, mime, bytes, sha256, source, captured_at)
      values (${capB}, ${B}, 'ready', ${`${B}/x/o.jpg`}, ${`${B}/x/o.jpg`}, ${`${B}/x/o.jpg`}, 'image/jpeg', 1, ${"shaB" + capB}, 'upload', ${now})`;
    await sql`insert into memories (id, capture_id, user_id, type, title, summary, text, folder_id, captured_at)
      values (${memB}, ${capB}, ${B}, 'notice', ${"B private notice"}, ${"secret"}, ${"top secret body of B"}, ${folderB}, ${now})`;
    await sql`insert into chunks (id, memory_id, user_id, ord, kind, content, captured_at, type)
      values (${chunkB}, ${memB}, ${B}, 0, 'summary', ${"B secret chunk content"}, ${now}, 'notice')`;
    await sql`insert into embeddings (chunk_id, user_id, model, dims, embedding)
      values (${chunkB}, ${B}, 'zero', 1024, ${zeros}::vector)`;
    await sql`insert into chat_sessions (id, user_id, title) values (${sessB}, ${B}, ${"B private chat"})`;
    await sql`insert into chat_messages (id, session_id, user_id, role, content) values (${ulid()}, ${sessB}, ${B}, 'user', ${"B secret question"})`;
    await sql`insert into action_items (id, memory_id, user_id, title, status) values (${aiB}, ${memB}, ${B}, ${"B secret task"}, 'open')`;

    const q = await import("../lib/db/queries");
    const A = userA.id;

    console.log("── reads must not return B's data ──");
    check("getMemoryDetail(A, memB) → null", (await q.getMemoryDetail(A, memB)) === null);
    check("getCapture(A, capB) → null", (await q.getCapture(A, capB)) === null);
    check(
      "listMemories(A, folder=B) → empty",
      (await q.listMemories(A, { folderIds: [folderB] })).items.length === 0,
    );
    check(
      "listLinkedMemories(A, memB) → empty",
      (await q.listLinkedMemories(A, memB)).length === 0,
    );
    check(
      "listRecentCaptures(A) excludes capB",
      !(await q.listRecentCaptures(A, 100)).some((r) => r.id === capB),
    );
    check(
      "listMemoriesBetween(A) excludes memB",
      !(
        await q.listMemoriesBetween(
          A,
          new Date(now.getTime() - 864e5),
          new Date(now.getTime() + 864e5),
        )
      ).some((r) => r.id === memB),
    );
    check(
      "listMemoriesNeedingReview(A) excludes memB",
      !(await q.listMemoriesNeedingReview(A)).some((r) => r.id === memB),
    );
    check("assertSessionOwner(A, sessB) → null", (await q.assertSessionOwner(A, sessB)) === null);
    check(
      "getChatMessages(A, sessB) → empty",
      (await q.getChatMessages(A, sessB)).length === 0,
    );
    check(
      "listChatSessions(A) excludes sessB",
      !(await q.listChatSessions(A, 100)).some((s) => s.id === sessB),
    );
    check(
      "listActionItems(A) excludes aiB",
      !(await q.listActionItems(A, {})).some((a) => a.id === aiB),
    );
    check("listFolders(A) excludes folderB", !(await q.listFolders(A)).some((f) => f.id === folderB));
    check(
      "folderSubtreeIds(A, folderB) → empty",
      (await q.folderSubtreeIds(A, folderB)).length === 0,
    );
    check(
      "exportUserData(A) has no B memory",
      !(await q.exportUserData(A)).memories.some((m: { id: string }) => m.id === memB),
    );
    check(
      "listUserObjectKeys(A) has no B key",
      !(await q.listUserObjectKeys(A)).some((k) => k.startsWith(`${B}/`)),
    );

    // vector search — a zero query vector is closest to B's zero embedding.
    const hits = await q.searchChunks(A, Array(1024).fill(0), { limit: 50 });
    check("searchChunks(A) never returns B's chunk", !hits.some((h) => h.chunkId === chunkB));

    console.log("\n── writes as A against B's resources must be rejected ──");
    check("softDeleteMemory(A, memB) → false", (await q.softDeleteMemory(A, memB)) === false);
    check("updateMemoryTags(A, memB, …) → false", (await q.updateMemoryTags(A, memB, ["x"])) === false);
    check(
      "setMemoryFolder(A, [memB], null) → 0 moved",
      (await q.setMemoryFolder(A, [memB], null)) === 0,
    );
    check("renameFolder(A, folderB, …) → not ok", !(await q.renameFolder(A, folderB, "hacked")).ok);
    check("moveFolder(A, folderB, null) → not ok", !(await q.moveFolder(A, folderB, null)).ok);
    check("linkMemories(A, memB, memB) → false", (await q.linkMemories(A, memB, memB)) === false);
    check("unlinkMemory(A, memB, memB) → false", (await q.unlinkMemory(A, memB, memB)) === false);
    check(
      "setActionItemStatus(A, aiB, done) → false",
      (await q.setActionItemStatus(A, aiB, "done")) === false,
    );
    await q.deleteFolder(A, folderB);
    await q.deleteChatSession(A, sessB);

    // ---- re-verify B's rows are untouched ----
    console.log("\n── B's rows survive the write attempts ──");
    const [fRow] = await sql`select name from folders where id = ${folderB}`;
    check("folderB still exists, name unchanged", fRow?.name === "B_secret_folder");
    const [mRow] = await sql`select deleted_at, folder_id from memories where id = ${memB}`;
    check("memB not soft-deleted", mRow?.deleted_at === null);
    check("memB still in folderB", mRow?.folder_id === folderB);
    const [sRow] = await sql`select id from chat_sessions where id = ${sessB}`;
    check("sessB still exists", !!sRow);
    const [aRow] = await sql`select status from action_items where id = ${aiB}`;
    check("aiB status still 'open'", aRow?.status === "open");
  } finally {
    await sql.end();
    await admin.auth.admin.deleteUser(B); // cascades
    console.log(`\ncleaned up user B.`);
  }

  console.log(
    fail === 0
      ? `\n\x1b[32mOWNERSHIP AUDIT PASSED — ${pass} checks.\x1b[0m\n`
      : `\n\x1b[31mOWNERSHIP AUDIT FAILED — ${fail} of ${pass + fail} checks leaked/mutated.\x1b[0m\n`,
  );
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
