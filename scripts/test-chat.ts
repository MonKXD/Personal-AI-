/**
 * Smoke-test chat persistence + action-item queries against real Supabase.
 *   npm run test:chat
 */
process.env.DRY_RUN = "1";
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!;
  const sql = postgres(url, { prepare: false, max: 1 });
  const [u] = await sql<{ id: string; email: string }[]>`
    select id, email from auth.users order by created_at asc limit 1`;
  if (!u) {
    console.error("No users — sign in first.");
    process.exit(1);
  }
  await sql.end();
  console.log(`user ${u.email}\n`);

  const {
    createChatSession,
    appendChatMessages,
    getChatMessages,
    listChatSessions,
    maybeTitleSession,
    deleteChatSession,
    listActionItems,
  } = await import("../lib/db/queries");

  // 1. session lifecycle
  const sid = await createChatSession(u.id);
  console.log("created session", sid);
  await appendChatMessages(u.id, sid, [
    { role: "user", content: "when is my next physics class?" },
    {
      role: "assistant",
      content: "Wednesday 2 PM in Lab-3.",
      citations: [{ memoryId: "m1", title: "Timetable", type: "timetable", snippet: "…", thumbKey: "k" }],
      usedFilters: { types: ["timetable"], label: ["timetable"] },
    },
  ]);
  await maybeTitleSession(u.id, sid, "when is my next physics class?");

  const msgs = await getChatMessages(u.id, sid);
  console.log(`messages: ${msgs.length} (roles: ${msgs.map((m) => m.role).join(", ")})`);
  const sessions = await listChatSessions(u.id);
  const mine = sessions.find((s) => s.id === sid);
  console.log(`session title: "${mine?.title}"`);

  const persistOk =
    msgs.length === 2 &&
    msgs[0].role === "user" &&
    msgs[1].role === "assistant" &&
    Array.isArray(msgs[1].citations) &&
    (msgs[1].citations as unknown[]).length === 1 &&
    mine?.title === "when is my next physics class?";

  await deleteChatSession(u.id, sid);
  const after = await getChatMessages(u.id, sid);
  const deleteOk = after.length === 0;
  console.log(`after delete: ${after.length} messages (cascade ${deleteOk ? "ok" : "FAILED"})`);

  // 2. action items
  const open = await listActionItems(u.id, { status: "open" });
  console.log(`\nopen action items: ${open.length}`);
  for (const a of open.slice(0, 5)) {
    console.log(`  - ${a.title}${a.dueAt ? `  (due ${a.dueAt.toISOString().slice(0, 16)})` : ""}  ← ${a.memoryTitle}`);
  }

  const ok = persistOk && deleteOk;
  console.log(ok ? "\n\x1b[32mChat persistence OK.\x1b[0m\n" : "\n\x1b[31mFAILED.\x1b[0m\n");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
