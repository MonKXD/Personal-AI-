"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateFolder } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const FOLDER_COLORS = [
  "#4a3f8f",
  "#3f8f82",
  "#a3432f",
  "#b7791f",
  "#2f8f6b",
  "#5a6ec0",
  "#b0468f",
  "#6a6675",
] as const;

export function FolderStyleDialog({
  folderId,
  name,
  color,
  emoji,
  open,
  onOpenChange,
  onSaved,
}: {
  folderId: string;
  name: string;
  color: string | null;
  emoji: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  // Mounted fresh per folder (keyed by the caller), so props seed state directly.
  const [c, setC] = React.useState<string | null>(color);
  const [e, setE] = React.useState(emoji ?? "");
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateFolder(folderId, {
        color: c,
        emoji: e.trim() ? e.trim().slice(0, 8) : null,
      });
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error("Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="truncate">Style &ldquo;{name}&rdquo;</DialogTitle>
        </DialogHeader>

        <label className="font-body text-xs text-muted-foreground">Icon</label>
        <input
          value={e}
          onChange={(ev) => setE(ev.target.value)}
          placeholder="📚"
          maxLength={8}
          className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-center text-lg outline-none focus-visible:border-violet/40"
        />

        <label className="mt-2 font-body text-xs text-muted-foreground">Colour</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setC(null)}
            className={cn(
              "grid size-7 place-items-center rounded-full border border-border text-[10px] text-muted-foreground",
              c === null && "ring-2 ring-foreground/70",
            )}
          >
            —
          </button>
          {FOLDER_COLORS.map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => setC(col)}
              style={{ background: col }}
              className={cn(
                "size-7 rounded-full transition-transform hover:scale-105",
                c === col && "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background",
              )}
              aria-label={col}
            />
          ))}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
