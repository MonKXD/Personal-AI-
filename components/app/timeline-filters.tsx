"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { MEMORY_TYPE_META, type MemoryType } from "@/lib/memory-types";
import { cn } from "@/lib/utils";

const RANGES = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
] as const;

const FILTER_TYPES: MemoryType[] = [
  "notice",
  "timetable",
  "textbook_page",
  "whiteboard",
  "circuit",
  "handwritten_note",
  "slide",
  "voice_note",
];

export function TimelineFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const range = params.get("range") ?? "all";
  const activeTypes = new Set((params.get("types") ?? "").split(",").filter(Boolean));

  const [q, setQ] = React.useState(params.get("q") ?? "");

  const commit = React.useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  function setRange(key: string) {
    const next = new URLSearchParams(params);
    if (key === "all") next.delete("range");
    else next.set("range", key);
    commit(next);
  }

  function toggleType(t: MemoryType) {
    const next = new URLSearchParams(params);
    const set = new Set(activeTypes);
    if (set.has(t)) set.delete(t);
    else set.add(t);
    if (set.size) next.set("types", [...set].join(","));
    else next.delete("types");
    commit(next);
  }

  React.useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      if ((params.get("q") ?? "") !== (q.trim() || "")) commit(next);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="space-y-3.5">
      <label className="flex w-full items-center gap-3 rounded-md border border-input bg-card px-4 py-3 transition-colors focus-within:border-violet/40">
        <Search className="size-4 shrink-0 text-muted-foreground/70" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your memory…"
          className="flex-1 bg-transparent font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
        />
      </label>

      <div className="inline-flex gap-1 rounded-full bg-secondary p-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              "rounded-full px-4 py-1.5 font-body text-xs font-semibold transition-colors",
              range === r.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground/80",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTER_TYPES.map((t) => {
          const { label, icon: Icon } = MEMORY_TYPE_META[t];
          const on = activeTypes.has(t);
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-body text-xs font-semibold transition-colors",
                on
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-input text-foreground/70 hover:text-foreground",
              )}
            >
              <Icon className="size-3" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
