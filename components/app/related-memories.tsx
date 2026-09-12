"use client";

import * as React from "react";
import Link from "next/link";
import { Link2, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  search,
  linkMemory,
  unlinkMemory,
  type LinkedMemory,
} from "@/lib/api-client";
import { MEMORY_TYPE_META } from "@/lib/memory-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, isImageThumbUrl } from "@/lib/utils";

export function RelatedMemories({
  memoryId,
  initial,
}: {
  memoryId: string;
  initial: LinkedMemory[];
}) {
  const [items, setItems] = React.useState(initial);
  const [open, setOpen] = React.useState(false);

  async function remove(targetId: string) {
    const prev = items;
    setItems((s) => s.filter((m) => m.id !== targetId));
    try {
      await unlinkMemory(memoryId, targetId);
    } catch {
      setItems(prev);
      toast.error("Couldn't remove link.");
    }
  }

  async function add(target: {
    id: string;
    type: LinkedMemory["type"];
    title: string;
    thumbUrl: string | null;
    mime: string;
  }) {
    setOpen(false);
    if (items.some((m) => m.id === target.id)) return;
    setItems((s) => [
      { id: target.id, type: target.type, title: target.title, thumbUrl: target.thumbUrl, mime: target.mime },
      ...s,
    ]);
    try {
      await linkMemory(memoryId, target.id);
    } catch {
      setItems((s) => s.filter((m) => m.id !== target.id));
      toast.error("Couldn't link memory.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
          Related
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 font-body text-xs text-muted-foreground/70 hover:text-foreground/80"
        >
          <Plus className="size-3" /> Link a memory
        </button>
      </div>

      {items.length === 0 ? (
        <p className="mt-1.5 font-body text-sm text-muted-foreground/70">No linked memories yet.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((m) => {
            const Icon = MEMORY_TYPE_META[m.type].icon;
            return (
              <div
                key={m.id}
                className="group relative flex items-center gap-2 rounded-xl border border-border bg-muted py-1.5 pl-1.5 pr-7"
              >
                <Link href={`/memory/${m.id}`} className="flex items-center gap-2">
                  {isImageThumbUrl(m.thumbUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbUrl} alt="" className="size-8 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                  )}
                  <span className="max-w-[10rem] truncate font-body text-sm text-foreground/80">{m.title || "Untitled"}</span>
                </Link>
                <button
                  onClick={() => remove(m.id)}
                  aria-label="Unlink"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground/70 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <LinkPickerDialog
        open={open}
        onOpenChange={setOpen}
        excludeIds={[memoryId, ...items.map((m) => m.id)]}
        onPick={add}
      />
    </div>
  );
}

function LinkPickerDialog({
  open,
  onOpenChange,
  excludeIds,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: string[];
  onPick: (m: {
    id: string;
    type: LinkedMemory["type"];
    title: string;
    thumbUrl: string | null;
    mime: string;
  }) => void;
}) {
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<
    {
      id: string;
      type: LinkedMemory["type"];
      title: string;
      summary: string;
      thumbUrl: string | null;
      mime: string;
    }[]
  >([]);

  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setQ("");
        setRows([]);
      }, 0);
    }
  }, [open]);

  React.useEffect(() => {
    const term = q.trim();
    let cancelled = false;
    let searchTimer: ReturnType<typeof setTimeout> | undefined;

    const kickoff = setTimeout(() => {
      if (cancelled) return;
      if (!term) {
        setRows([]);
        return;
      }
      setLoading(true);
      searchTimer = setTimeout(async () => {
        if (cancelled) return;
        try {
          const res = await search(term);
          if (!cancelled) setRows(res.memories.filter((m) => !excludeIds.includes(m.id)));
        } catch {
          if (!cancelled) setRows([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-violet-bright" /> Link a memory
          </DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title..."
        />
        <div className="max-h-64 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground/70" />
            </div>
          )}
          {!loading && q.trim() && rows.length === 0 && (
            <p className="py-6 text-center font-body text-sm text-muted-foreground/70">No matches.</p>
          )}
          <div className="space-y-1">
            {rows.map((r) => {
              const Icon = MEMORY_TYPE_META[r.type].icon;
              return (
                <button
                  key={r.id}
                  onClick={() => onPick(r)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent",
                  )}
                >
                  {isImageThumbUrl(r.thumbUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbUrl} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-body text-sm text-foreground/80">
                    {r.title || "Untitled"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
