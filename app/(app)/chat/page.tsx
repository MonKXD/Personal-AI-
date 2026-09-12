import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import {
  assertSessionOwner,
  getChatMessages,
  listChatSessions,
  listRecentMemoryBriefs,
} from "@/lib/db/queries";
import { hydrateChatMessages } from "@/lib/chat-hydrate";
import { AppPage } from "@/components/app/page-header";
import { ChatShell } from "@/components/app/chat-shell";
import type { MemoryType } from "@/lib/memory-types";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

/** Turn a few recent memories into starter questions. Deterministic, no AI. */
function buildSuggestions(mems: { type: MemoryType; title: string }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (q: string) => {
    if (q && !seen.has(q) && out.length < 4) {
      seen.add(q);
      out.push(q);
    }
  };
  for (const m of mems) {
    const t = m.title?.trim();
    if (!t) continue;
    if (m.type === "timetable") add(`When is my next class in "${t}"?`);
    else if (m.type === "notice") add(`What are the key dates in "${t}"?`);
    else if (m.type === "voice_note") add(`What did I say in "${t}"?`);
    else if (m.type === "textbook_page" || m.type === "document" || m.type === "slide")
      add(`Summarize "${t}"`);
    else add(`What was on "${t}"?`);
  }
  add("Anything due this week?");
  add("What did I capture today?");
  return out;
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const user = await requireUser("/chat");
  const { s } = await searchParams;

  const [sessions, briefs] = await Promise.all([
    listChatSessions(user.id),
    listRecentMemoryBriefs(user.id),
  ]);
  const suggestions = briefs.length >= 2 ? buildSuggestions(briefs) : undefined;

  let activeId: string | null = null;
  let messages: Awaited<ReturnType<typeof hydrateChatMessages>> = [];
  if (s && (await assertSessionOwner(user.id, s))) {
    activeId = s;
    messages = await hydrateChatMessages(await getChatMessages(user.id, s));
  }

  return (
    <AppPage className="max-w-none py-4">
      <ChatShell
        key={activeId ?? "new"}
        initialSessions={sessions.map((x) => ({
          id: x.id,
          title: x.title,
          updatedAt: x.updatedAt.toISOString(),
        }))}
        activeSessionId={activeId}
        initialMessages={messages}
        suggestions={suggestions}
      />
    </AppPage>
  );
}
