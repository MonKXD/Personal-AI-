"use client";

import * as React from "react";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const slug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function TagEditor({
  memoryId,
  initialTags,
}: {
  memoryId: string;
  initialTags: string[];
}) {
  const [tags, setTags] = React.useState(initialTags);
  const [draft, setDraft] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function commit(next: string[]) {
    const prev = tags;
    setTags(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/memories/${memoryId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTags(prev);
      toast.error("Couldn't save tags.");
    } finally {
      setSaving(false);
    }
  }

  function add() {
    const t = slug(draft);
    setDraft("");
    if (!t || tags.includes(t)) return;
    void commit([...tags, t]);
  }

  function remove(t: string) {
    void commit(tags.filter((x) => x !== t));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tags
        </div>
        {!editing && (
          <button
            onClick={() => {
              setEditing(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Edit
          </button>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className={cn(
              "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground",
              editing && "pr-1",
            )}
          >
            {t}
            {editing && (
              <button
                onClick={() => remove(t)}
                aria-label={`Remove ${t}`}
                className="rounded p-0.5 hover:bg-background hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}

        {editing && (
          <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-0.5">
            <Plus className="size-3 text-muted-foreground" />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  add();
                }
                if (e.key === "Backspace" && !draft && tags.length) {
                  remove(tags[tags.length - 1]);
                }
              }}
              onBlur={() => {
                add();
                setEditing(false);
              }}
              placeholder="add tag"
              className="w-24 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </span>
        )}

        {tags.length === 0 && !editing && (
          <span className="text-xs text-muted-foreground">No tags</span>
        )}
        {saving && <span className="text-[0.7rem] text-muted-foreground">saving…</span>}
      </div>
    </div>
  );
}
