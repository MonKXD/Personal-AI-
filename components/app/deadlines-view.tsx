"use client";

import * as React from "react";
import { Check, Clock3, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  addDeadline,
  listDeadlines,
  setDeadlineStatus,
  type DeadlineItem,
} from "@/lib/api-client";
import { absoluteTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/app/empty-state";

const PRIORITY_STYLE: Record<DeadlineItem["priority"], string> = {
  urgent: "text-destructive",
  high: "text-warning",
  normal: "text-muted-foreground/70",
  none: "text-muted-foreground/70",
};

const SOURCE_LABEL: Record<DeadlineItem["source"], string> = {
  manual: "Manual",
  whatsapp: "WhatsApp",
  call: "Call",
};

export function DeadlinesView({ initial }: { initial: DeadlineItem[] }) {
  const [items, setItems] = React.useState<DeadlineItem[]>(initial);
  const [showDone, setShowDone] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  async function refresh() {
    try {
      setItems(await listDeadlines());
    } catch {
      toast.error("Couldn't refresh deadlines.");
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    setAdding(true);
    try {
      await addDeadline(title.trim(), new Date(dueDate).toISOString());
      setTitle("");
      setDueDate("");
      await refresh();
    } catch {
      toast.error("Couldn't add deadline.");
    } finally {
      setAdding(false);
    }
  }

  async function toggle(id: string, next: "pending" | "done") {
    setItems((s) => s.map((it) => (it.id === id ? { ...it, status: next } : it)));
    try {
      await setDeadlineStatus(id, next);
    } catch {
      setItems((s) =>
        s.map((it) => (it.id === id ? { ...it, status: next === "done" ? "pending" : "done" } : it)),
      );
      toast.error("Couldn't update.");
    }
  }

  const visible = items.filter((d) => showDone || d.status !== "done");

  return (
    <div className="space-y-5">
      <form
        onSubmit={onAdd}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center"
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a deadline (e.g. Submit assignment)"
          className="sm:flex-1"
        />
        <Input
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="sm:w-56"
        />
        <Button type="submit" disabled={adding || !title.trim() || !dueDate}>
          <Plus /> Add
        </Button>
      </form>

      <div className="flex items-center justify-between">
        <div className="font-body text-xs text-muted-foreground/70">{`${visible.length} shown`}</div>
        <button
          onClick={() => setShowDone((v) => !v)}
          className="font-body text-xs text-muted-foreground/70 underline-offset-2 hover:underline"
        >
          {showDone ? "Hide done" : "Show done"}
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="No deadlines yet"
          description="Add one above, or connect WhatsApp/calling so deadlines are found for you automatically."
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((d) => {
            const done = d.status === "done";
            return (
              <li
                key={d.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <button
                  onClick={() => toggle(d.id, done ? "pending" : "done")}
                  aria-label={done ? "Mark not done" : "Mark done"}
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                    done ? "border-success bg-success text-foreground" : "border-border hover:border-violet",
                  )}
                >
                  {done && <Check className="size-3.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={cn("font-body text-sm text-foreground/80", done && "text-muted-foreground/70 line-through")}>
                    {d.title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-body text-xs">
                    {d.dueAt && (
                      <span className={!done ? PRIORITY_STYLE[d.priority] : "text-muted-foreground/70"}>
                        Due {absoluteTime(d.dueAt)}
                      </span>
                    )}
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-muted-foreground/70">{SOURCE_LABEL[d.source]}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
