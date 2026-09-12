"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, FolderPlus, Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createFolder,
  listFolders,
  moveMemoriesToFolder,
  type Folder,
} from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Node = Folder & { children: Node[]; depth: number };

function flatten(folders: Folder[]): Node[] {
  const byId = new Map<string, Node>(
    folders.map((f) => [f.id, { ...f, children: [], depth: 0 }]),
  );
  const roots: Node[] = [];
  for (const n of byId.values()) {
    if (n.parentId && byId.has(n.parentId)) byId.get(n.parentId)!.children.push(n);
    else roots.push(n);
  }
  const out: Node[] = [];
  const walk = (ns: Node[], depth: number) => {
    ns.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    for (const n of ns) {
      n.depth = depth;
      out.push(n);
      walk(n.children, depth + 1);
    }
  };
  walk(roots, 0);
  return out;
}

/** Single-select: move `memoryIds` into one folder (or Unfiled). */
export function FolderPickerDialog({
  memoryIds,
  currentFolderId,
  open,
  onOpenChange,
  onMoved,
}: {
  memoryIds: string[];
  currentFolderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved?: (folderId: string | null) => void;
}) {
  const router = useRouter();
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(() => {
      setLoading(true);
      listFolders()
        .then((r) => alive && setFolders(r.folders))
        .catch(() => alive && toast.error("Couldn't load folders."))
        .finally(() => alive && setLoading(false));
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open]);

  const rows = React.useMemo(() => flatten(folders), [folders]);

  async function pick(folderId: string | null) {
    setSaving(true);
    try {
      await moveMemoriesToFolder(memoryIds, folderId);
      onMoved?.(folderId);
      onOpenChange(false);
      router.refresh();
      toast(folderId ? "Moved to folder" : "Moved to Unfiled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't move.");
    } finally {
      setSaving(false);
    }
  }

  async function addAndPick() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const f = await createFolder(name);
      setNewName("");
      await pick(f.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create folder.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3">
        <DialogHeader>
          <DialogTitle>
            Move {memoryIds.length > 1 ? `${memoryIds.length} memories` : "to folder"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addAndPick()}
            placeholder="New folder…"
          />
          <Button
            size="icon"
            onClick={addAndPick}
            disabled={!newName.trim() || creating}
            aria-label="Create and move here"
          >
            {creating ? <Loader2 className="animate-spin" /> : <FolderPlus />}
          </Button>
        </div>

        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          <button
            onClick={() => pick(null)}
            disabled={saving}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-body text-sm transition-colors hover:bg-accent",
              currentFolderId === null ? "text-violet-bright" : "text-foreground/80",
            )}
          >
            <Inbox className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">Unfiled</span>
            {currentFolderId === null && <Check className="size-4" />}
          </button>

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground/70" />
            </div>
          )}
          {!loading && rows.length === 0 && (
            <p className="py-3 text-center font-body text-xs text-muted-foreground/70">
              No folders yet — create one above.
            </p>
          )}
          {rows.map((f) => (
            <button
              key={f.id}
              onClick={() => pick(f.id)}
              disabled={saving}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg py-2 pr-2 text-left font-body text-sm transition-colors hover:bg-accent",
                f.id === currentFolderId ? "text-violet-bright" : "text-foreground/80",
              )}
              style={{ paddingLeft: 8 + f.depth * 14 }}
            >
              <span className="flex-1 truncate">{f.name}</span>
              {f.id === currentFolderId && <Check className="size-4 shrink-0" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
