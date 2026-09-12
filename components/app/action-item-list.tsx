"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { setActionItemStatus } from "@/lib/api-client";
import { absoluteTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type ActionItem = {
  id: string;
  title: string;
  dueAt: string | null;
  status: "open" | "done" | "dismissed";
  memoryId: string;
  memoryTitle: string;
  overdue: boolean;
};

export function ActionItemList({ items }: { items: ActionItem[] }) {
  const [state, setState] = React.useState(items);

  if (state.length === 0) {
    return (
      <p className="font-body text-sm text-muted-foreground/70">
        Deadlines and dates found in your captures will appear here as a checklist.
      </p>
    );
  }

  async function toggle(id: string, next: "open" | "done") {
    setState((s) => s.map((it) => (it.id === id ? { ...it, status: next } : it)));
    try {
      await setActionItemStatus(id, next);
    } catch {
      setState((s) =>
        s.map((it) => (it.id === id ? { ...it, status: next === "done" ? "open" : "done" } : it)),
      );
      toast.error("Couldn't update.");
    }
  }

  return (
    <ul className="space-y-2">
      {state.map((it) => {
        const done = it.status === "done";
        return (
          <li key={it.id} className="flex items-start gap-3">
            <button
              onClick={() => toggle(it.id, done ? "open" : "done")}
              aria-label={done ? "Mark not done" : "Mark done"}
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                done
                  ? "border-success bg-success text-foreground"
                  : "border-border hover:border-violet",
              )}
            >
              {done && <Check className="size-3.5" />}
            </button>
            <div className="min-w-0">
              <div className={cn("font-body text-sm text-foreground/80", done && "text-muted-foreground/70 line-through")}>
                {it.title}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-body text-xs text-muted-foreground/70">
                {it.dueAt && (
                  <span className={cn(!done && it.overdue && "text-destructive")}>
                    Due {absoluteTime(it.dueAt)}
                  </span>
                )}
                <Link href={`/memory/${it.memoryId}`} className="hover:text-muted-foreground">
                  {it.memoryTitle || "source"}
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
