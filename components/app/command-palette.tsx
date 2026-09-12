"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, MessageSquare, Loader2 } from "lucide-react";
import { search, type SearchResult } from "@/lib/api-client";
import { MEMORY_TYPE_META } from "@/lib/memory-types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn, isImageThumbUrl } from "@/lib/utils";

export const OPEN_COMMAND_PALETTE_EVENT = "mm:open-command-palette";

type Row =
  | {
      kind: "memory";
      id: string;
      type: keyof typeof MEMORY_TYPE_META;
      title: string;
      summary: string;
      thumbUrl: string | null;
      mime: string;
    }
  | { kind: "session"; id: string; title: string };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [result, setResult] = React.useState<SearchResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [activeRaw, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setTimeout(() => {
        setValue("");
        setResult(null);
        setActive(0);
      }, 0);
    }
  }, [open]);

  React.useEffect(() => {
    const q = value.trim();
    let cancelled = false;
    let searchTimer: ReturnType<typeof setTimeout> | undefined;

    const kickoff = setTimeout(() => {
      if (cancelled) return;
      if (!q) {
        setResult(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      searchTimer = setTimeout(async () => {
        if (cancelled) return;
        try {
          const res = await search(q);
          if (!cancelled) setResult(res);
        } catch {
          if (!cancelled) setResult(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }, 220);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(kickoff);
      clearTimeout(searchTimer);
    };
  }, [value]);

  const rows: Row[] = React.useMemo(() => {
    if (!result) return [];
    return [
      ...result.memories.map((m): Row => ({ kind: "memory", ...m })),
      ...result.sessions.map((s): Row => ({ kind: "session", id: s.id, title: s.title })),
    ];
  }, [result]);

  // Clamp instead of resetting via effect — keeps the highlighted row valid
  // whenever the result set shrinks (e.g. a fresh search returns fewer rows).
  const active = rows.length ? Math.min(activeRaw, rows.length - 1) : 0;

  function go(row: Row) {
    setOpen(false);
    router.push(row.kind === "memory" ? `/memory/${row.id}` : `/chat?s=${row.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showClose={false} className="top-[18%] translate-y-0 gap-0 p-0 sm:max-w-lg">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
          <Search className="size-4 shrink-0 text-muted-foreground/70" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive(Math.min(active + 1, rows.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive(Math.max(active - 1, 0));
              } else if (e.key === "Enter" && rows[active]) {
                e.preventDefault();
                go(rows[active]);
              }
            }}
            placeholder="Search your memory and chats..."
            className="flex-1 bg-transparent font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground/70" />}
          <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-body text-[10px] text-muted-foreground/70">
            esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {!value.trim() && (
            <p className="px-2.5 py-6 text-center font-body text-sm text-muted-foreground/70">
              Search memories and past chats by name.
            </p>
          )}
          {value.trim() && !loading && rows.length === 0 && (
            <p className="px-2.5 py-6 text-center font-body text-sm text-muted-foreground/70">
              No matches for &ldquo;{value.trim()}&rdquo;.
            </p>
          )}
          {rows.map((row, i) => {
            const Icon = row.kind === "memory" ? MEMORY_TYPE_META[row.type].icon : MessageSquare;
            return (
              <button
                key={`${row.kind}-${row.id}`}
                onClick={() => go(row)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                  i === active ? "bg-violet/12" : "hover:bg-accent",
                )}
              >
                {row.kind === "memory" && isImageThumbUrl(row.thumbUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.thumbUrl} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body text-sm text-foreground/80">{row.title || "Untitled"}</span>
                  {row.kind === "memory" && row.summary && (
                    <span className="block truncate font-body text-xs text-muted-foreground/70">{row.summary}</span>
                  )}
                </span>
                <span className="shrink-0 font-body text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  {row.kind === "memory" ? "memory" : "chat"}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
