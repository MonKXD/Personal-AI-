"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Inbox,
  MoreHorizontal,
  Palette,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createFolder, deleteFolder, updateFolder, type Folder } from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderStyleDialog } from "@/components/app/folder-style-dialog";
import { cn } from "@/lib/utils";

type Node = Folder & { children: Node[] };

function buildTree(folders: Folder[]): Node[] {
  const byId = new Map<string, Node>(folders.map((f) => [f.id, { ...f, children: [] }]));
  const roots: Node[] = [];
  for (const n of byId.values()) {
    if (n.parentId && byId.has(n.parentId)) byId.get(n.parentId)!.children.push(n);
    else roots.push(n);
  }
  const sort = (ns: Node[]) => {
    ns.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    ns.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function FolderTree({
  folders,
  unfiledCount,
  selectedId,
  selectedUnfiled,
}: {
  folders: Folder[];
  unfiledCount: number;
  selectedId: string | null;
  selectedUnfiled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [styling, setStyling] = React.useState<Node | null>(null);
  const tree = React.useMemo(() => buildTree(folders), [folders]);

  const refresh = () => router.refresh();

  async function run(fn: () => Promise<unknown>, err: string) {
    setBusy(true);
    try {
      await fn();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : err);
    } finally {
      setBusy(false);
    }
  }

  async function addFolder(parentId: string | null) {
    const name = window.prompt(parentId ? "New subfolder name" : "New folder name")?.trim();
    if (!name) return;
    await run(() => createFolder(name, parentId), "Couldn't create folder.");
  }

  async function rename(f: Folder) {
    const name = window.prompt("Rename folder", f.name)?.trim();
    if (!name || name === f.name) return;
    await run(() => updateFolder(f.id, { name }), "Couldn't rename.");
  }

  async function remove(f: Folder) {
    if (
      !window.confirm(
        `Delete "${f.name}"? Its memories move to Unfiled and any subfolders move up a level — nothing is deleted.`,
      )
    )
      return;
    await run(() => deleteFolder(f.id), "Couldn't delete.");
    if (f.id === selectedId) router.push("/folders");
  }

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const renderNode = (n: Node, depth: number): React.ReactNode => {
    const isCollapsed = collapsed.has(n.id);
    const active = n.id === selectedId;
    return (
      <React.Fragment key={n.id}>
        <div
          className={cn(
            "group flex items-center gap-1 rounded-lg pr-1 text-sm",
            active ? "bg-violet/14 text-violet-bright" : "text-muted-foreground hover:bg-accent",
          )}
          style={{ paddingLeft: depth * 12 }}
        >
          {n.children.length > 0 ? (
            <button
              onClick={() => toggle(n.id)}
              className="grid size-4 shrink-0 place-items-center text-muted-foreground/70 hover:text-muted-foreground"
              aria-label={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          ) : (
            <span className="size-4 shrink-0" />
          )}
          <Link
            href={`/folders?f=${n.id}`}
            className="flex min-w-0 flex-1 items-center gap-1.5 truncate py-1.5 font-body"
          >
            {n.emoji ? (
              <span className="shrink-0 text-[13px] leading-none">{n.emoji}</span>
            ) : n.color ? (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: n.color }}
              />
            ) : null}
            <span className="truncate">{n.name}</span>
            <span className="ml-1.5 text-[11px] text-muted-foreground/70">{n.count}</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="shrink-0 rounded p-1 text-muted-foreground/70 opacity-60 hover:text-foreground/80 lg:opacity-0 lg:group-hover:opacity-100"
                aria-label="Folder actions"
                disabled={busy}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => addFolder(n.id)}>
                <FolderPlus className="size-3.5" /> New subfolder
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => rename(n)}>
                <Pencil className="size-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setStyling(n)}>
                <Palette className="size-3.5" /> Colour &amp; icon
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => remove(n)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {!isCollapsed && n.children.map((c) => renderNode(c, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div className="rounded-2xl border border-border bg-muted p-2">
        <Link
          href="/folders?unfiled=1"
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
            selectedUnfiled ? "bg-violet/14 text-violet-bright" : "text-muted-foreground hover:bg-accent",
          )}
        >
          <Inbox className="size-4 shrink-0" />
          <span className="flex-1 font-body">Unfiled</span>
          <span className="text-[11px] text-muted-foreground/70">{unfiledCount}</span>
        </Link>

        <div className="my-1 h-px bg-muted" />

        <div className="max-h-[60vh] space-y-0.5 overflow-y-auto">
          {tree.length === 0 ? (
            <p className="px-2 py-3 font-body text-xs text-muted-foreground/70">No folders yet.</p>
          ) : (
            tree.map((n) => renderNode(n, 0))
          )}
        </div>

        <div className="mt-1 border-t border-border pt-1">
          <button
            onClick={() => addFolder(null)}
            disabled={busy}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 font-body text-sm text-muted-foreground hover:bg-accent hover:text-foreground/80"
          >
            <FolderPlus className="size-4" /> New folder
          </button>
        </div>
      </div>

      {styling && (
        <FolderStyleDialog
          key={styling.id}
          folderId={styling.id}
          name={styling.name}
          color={styling.color}
          emoji={styling.emoji}
          open={!!styling}
          onOpenChange={(v) => !v && setStyling(null)}
          onSaved={refresh}
        />
      )}
    </aside>
  );
}
