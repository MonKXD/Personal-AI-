"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { correctMemoryText } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export function TextCorrector({ memoryId, text }: { memoryId: string; text: string }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(text);
  const [saving, setSaving] = React.useState(false);

  async function save() {
    const next = draft.trim();
    if (!next || next === text) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await correctMemoryText(memoryId, next);
      toast.success("Text updated — chat will use the correction from now on.");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Couldn't save the correction.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <details className="group overflow-hidden rounded-2xl border border-border bg-muted">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
          Extracted Text
          <span className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.preventDefault();
                setDraft(text);
                setEditing(true);
              }}
              className="flex items-center gap-1 normal-case tracking-normal text-muted-foreground/70 hover:text-foreground/80"
            >
              <Pencil className="size-3" /> Fix text
            </button>
            <span className="text-muted-foreground/70 group-open:hidden">show</span>
            <span className="hidden text-muted-foreground/70 group-open:inline">hide</span>
          </span>
        </summary>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-border p-4 font-body text-[13.5px] leading-[1.7] text-foreground/80">
          {text}
        </pre>
      </details>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-violet/25 bg-muted">
      <div className="flex items-center justify-between p-4 pb-0 font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
        Fix extracted text
      </div>
      <div className="p-4">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          className="w-full resize-y rounded-xl border border-border bg-muted p-3 font-body text-[13.5px] leading-[1.7] text-foreground/80 outline-none focus-visible:border-violet/40"
        />
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
