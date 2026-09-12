"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { dismissFolderSuggestion, moveMemoriesToFolder } from "@/lib/api-client";

/** Shown on an unfiled memory when the pipeline guessed a folder. Never
 * applied automatically — the user accepts or dismisses. */
export function FolderSuggestionChip({
  memoryId,
  folderId,
  path,
}: {
  memoryId: string;
  folderId: string;
  path: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"move" | "dismiss" | null>(null);

  async function act(kind: "move" | "dismiss") {
    setBusy(kind);
    try {
      if (kind === "move") await moveMemoriesToFolder([memoryId], folderId);
      else await dismissFolderSuggestion(memoryId);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet/25 bg-violet/[0.07] px-3 py-2 font-body text-xs">
      <Sparkles className="size-3.5 shrink-0 text-violet-bright" />
      <span className="text-muted-foreground">
        Suggested folder: <span className="font-medium text-foreground/80">{path}</span>
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={() => act("move")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 rounded-full bg-violet/16 px-2.5 py-1 font-semibold text-violet-bright disabled:opacity-50"
        >
          {busy === "move" ? <Loader2 className="size-3 animate-spin" /> : null}
          Move here
        </button>
        <button
          onClick={() => act("dismiss")}
          disabled={busy !== null}
          aria-label="Dismiss suggestion"
          className="grid size-6 place-items-center rounded-full text-muted-foreground/70 hover:text-foreground/80 disabled:opacity-50"
        >
          {busy === "dismiss" ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
