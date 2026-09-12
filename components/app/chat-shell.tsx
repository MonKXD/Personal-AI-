"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Loader2,
  MessageSquarePlus,
  PanelLeft,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  askChat,
  deleteChatSession,
  type ChatCitation,
  type ChatFilters,
} from "@/lib/api-client";
import { MEMORY_TYPE_META } from "@/lib/memory-types";
import { cn, isImageThumbUrl } from "@/lib/utils";
import type { HydratedChatMessage } from "@/lib/chat-hydrate";

const FALLBACK_SUGGESTIONS = [
  "What did I capture today?",
  "Any deadlines this week?",
  "Summarize the whiteboard from this morning",
  "When is my next class?",
];

type Msg =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      citations: ChatCitation[];
      usedFilters: ChatFilters;
      noMemory?: boolean;
      streaming?: boolean;
    };

type SessionSummary = { id: string; title: string; updatedAt: string };

function toMsg(m: HydratedChatMessage): Msg {
  if (m.role === "assistant") {
    return {
      role: "assistant",
      content: m.content,
      citations: m.citations,
      usedFilters: m.usedFilters as ChatFilters,
    };
  }
  return { role: "user", content: m.content };
}

export function ChatShell({
  initialSessions,
  activeSessionId,
  initialMessages,
  suggestions,
}: {
  initialSessions: SessionSummary[];
  activeSessionId: string | null;
  initialMessages: HydratedChatMessage[];
  suggestions?: string[];
}) {
  const chips = suggestions?.length ? suggestions : FALLBACK_SUGGESTIONS;
  const router = useRouter();
  const [sessions, setSessions] = React.useState(initialSessions);
  const [sessionId, setSessionId] = React.useState<string | null>(activeSessionId);
  const [messages, setMessages] = React.useState<Msg[]>(initialMessages.map(toMsg));
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setValue("");
    setBusy(true);
    setMessages((m) => [
      ...m,
      { role: "user", content: q },
      { role: "assistant", content: "", citations: [], usedFilters: {}, streaming: true },
    ]);
    try {
      const res = await askChat(q, sessionId, (chunk) => {
        setMessages((m) => {
          const last = m[m.length - 1];
          if (!last || last.role !== "assistant") return m;
          return [...m.slice(0, -1), { ...last, content: last.content + chunk }];
        });
      });
      setMessages((m) => [
        ...m.slice(0, -1),
        {
          role: "assistant",
          content: res.answer,
          citations: res.citations,
          usedFilters: res.usedFilters,
          noMemory: res.noMemory,
        },
      ]);
      if (res.sessionId !== sessionId) {
        setSessionId(res.sessionId);
        window.history.replaceState(null, "", `/chat?s=${res.sessionId}`);
        // refresh the sidebar list (fire and forget)
        router.refresh();
      }
      setSessions((prev) => {
        const title = prev.find((s) => s.id === res.sessionId)?.title ?? q.slice(0, 60);
        const rest = prev.filter((s) => s.id !== res.sessionId);
        return [{ id: res.sessionId, title, updatedAt: new Date().toISOString() }, ...rest];
      });
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      toast.error(e instanceof Error ? e.message : "Couldn't get an answer.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSession(id: string) {
    if (!confirm("Delete this chat?")) return;
    try {
      await deleteChatSession(id);
      setSessions((s) => s.filter((x) => x.id !== id));
      if (id === sessionId) router.push("/chat");
    } catch {
      toast.error("Couldn't delete.");
    }
  }

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:h-[calc(100dvh-3.5rem)]">
      {/* Session list */}
      <aside
        className={cn(
          "w-60 shrink-0 flex-col border-r border-border p-4",
          drawerOpen ? "flex" : "hidden lg:flex",
        )}
      >
        <Button asChild size="sm" className="w-full justify-start gap-2">
          <Link href="/chat" onClick={() => setDrawerOpen(false)}>
            <MessageSquarePlus className="size-4" /> New chat
          </Link>
        </Button>
        <div className="mt-3 flex-1 space-y-0.5 overflow-y-auto">
          {sessions.length === 0 && (
            <p className="px-2 py-4 font-body text-xs text-muted-foreground/70">No chats yet.</p>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={cn(
                "group flex items-center gap-1 rounded-lg pr-1 text-sm",
                s.id === sessionId ? "bg-violet/12 text-violet-bright" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Link
                href={`/chat?s=${s.id}`}
                onClick={() => setDrawerOpen(false)}
                className="min-w-0 flex-1 truncate px-2 py-1.5 font-body"
              >
                {s.title}
              </Link>
              <button
                onClick={() => removeSession(s.id)}
                aria-label="Delete chat"
                className="shrink-0 rounded p-1.5 text-muted-foreground/70 opacity-70 transition-opacity hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Conversation */}
      <div className="flex min-w-0 flex-1 flex-col p-4 lg:p-6">
        <div className="mb-2 lg:hidden">
          <Button variant="ghost" size="sm" onClick={() => setDrawerOpen((o) => !o)}>
            <PanelLeft className="size-4" /> Chats
          </Button>
        </div>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-[image:var(--brand-grad)] text-white shadow-[0_10px_36px_color-mix(in_srgb,var(--primary)_40%,transparent)]">
                <Sparkles className="size-6" />
              </div>
              <h2 className="mt-4 font-display text-lg font-bold text-foreground">Ask your memory</h2>
              <p className="mt-1.5 font-body text-sm text-muted-foreground">
                Questions about anything you&rsquo;ve captured. Answers cite the exact
                memories they came from.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {chips.map((sug) => (
                  <button
                    key={sug}
                    onClick={() => send(sug)}
                    className="rounded-full border border-input bg-background px-4 py-2 font-body text-[13px] text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-5 py-4">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div
                    key={i}
                    className="ml-auto w-fit max-w-[85%] rounded-[14px] rounded-br-[4px] bg-primary px-4 py-2.5 font-body text-sm text-primary-foreground"
                  >
                    {m.content}
                  </div>
                ) : m.role === "assistant" && m.streaming && !m.content ? (
                  <div key={i} className="flex items-center gap-2 font-body text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-violet-bright" /> Searching your memories…
                  </div>
                ) : (
                  <AssistantMessage key={i} m={m} />
                ),
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(value);
          }}
          className="mx-auto w-full max-w-2xl"
        >
          <div className="flex items-end gap-2 rounded-full border border-input bg-muted p-2 pl-4 focus-within:border-violet/40 focus-within:ring-2 focus-within:ring-violet/20">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(value);
                }
              }}
              rows={1}
              placeholder="Ask about anything you've captured…"
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            <Button
              type="submit"
              size="icon"
              className="size-9 shrink-0 rounded-full"
              disabled={!value.trim() || busy}
              aria-label="Send"
            >
              {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
            </Button>
          </div>
          <p className="mt-2 text-center font-body text-xs text-muted-foreground/70">
            Personal AI answers only from what you&rsquo;ve captured.
          </p>
        </form>
      </div>
    </div>
  );
}

function AssistantMessage({
  m,
}: {
  m: Extract<Msg, { role: "assistant" }>;
}) {
  return (
    <div className="max-w-[95%] space-y-3">
      <div className="flex items-center gap-1.5 font-body text-xs font-semibold text-violet-bright">
        <Sparkles className="size-3.5" /> Personal AI
      </div>
      <p
        className={cn(
          "whitespace-pre-wrap font-body text-sm leading-relaxed",
          m.noMemory ? "text-muted-foreground/70" : "text-foreground/80",
        )}
      >
        {m.content}
      </p>

      {m.citations.length > 0 && <Citations citations={m.citations} />}

      {m.noMemory && (
        <Button asChild size="sm" variant="secondary">
          <Link href="/capture">Capture it now</Link>
        </Button>
      )}

      {(m.usedFilters.label?.length ?? 0) > 0 && (
        <p className="font-body text-[0.7rem] text-muted-foreground/70">
          Filters used: {m.usedFilters.label!.join(" · ")}
        </p>
      )}
    </div>
  );
}

function Citations({ citations }: { citations: ChatCitation[] }) {
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {citations.map((c) => {
          const Icon = MEMORY_TYPE_META[c.type].icon;
          const active = open === c.memoryId;
          return (
            <button
              key={c.memoryId}
              onClick={() => setOpen(active ? null : c.memoryId)}
              aria-expanded={active}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-2 py-1 font-body text-xs transition-colors",
                active
                  ? "border-violet/40 bg-violet/10 text-foreground"
                  : "border-border bg-muted text-muted-foreground hover:border-violet/40 hover:text-foreground",
              )}
            >
              {isImageThumbUrl(c.thumbUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.thumbUrl} alt="" className="size-6 rounded object-cover" />
              ) : (
                <span className="grid size-6 place-items-center rounded bg-violet/12 text-violet-bright">
                  <Icon className="size-3.5" />
                </span>
              )}
              <span className="max-w-[10rem] truncate">{c.title}</span>
            </button>
          );
        })}
      </div>

      {open &&
        (() => {
          const c = citations.find((x) => x.memoryId === open)!;
          return (
            <div className="rounded-lg border border-border bg-muted p-3">
              <p className="font-body text-xs italic leading-relaxed text-muted-foreground">
                &ldquo;{c.snippet}&rdquo;
              </p>
              <Link
                href={`/memory/${c.memoryId}`}
                className="mt-2 inline-block font-body text-[0.7rem] font-semibold text-violet-bright hover:underline"
              >
                Open memory →
              </Link>
            </div>
          );
        })()}
    </div>
  );
}
