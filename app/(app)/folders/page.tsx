import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FolderTree as FolderTreeIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  countUnfiledMemories,
  folderSubtreeIds,
  listFolders,
  listMemories,
  type FolderRow,
} from "@/lib/db/queries";
import { signImageUrls } from "@/lib/storage";
import { AppPage } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { MemoryCard } from "@/components/app/memory-card";
import { FolderTree } from "@/components/app/folder-tree";
import { Stagger, StaggerItem } from "@/components/fx/stagger";
import type { MemoryType } from "@/lib/memory-types";

export const metadata: Metadata = { title: "Folders" };
export const dynamic = "force-dynamic";

function ancestry(folders: FolderRow[], id: string): FolderRow[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: FolderRow[] = [];
  let cur = byId.get(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

export default async function FoldersPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; unfiled?: string; sub?: string }>;
}) {
  const user = await requireUser("/folders");
  const sp = await searchParams;

  const [folders, unfiledCount] = await Promise.all([
    listFolders(user.id),
    countUnfiledMemories(user.id),
  ]);

  const isUnfiled = sp.unfiled === "1";
  const selectedId = !isUnfiled && sp.f && folders.some((f) => f.id === sp.f) ? sp.f : null;
  const includeSub = sp.sub === "1";

  let folderIds: string[] | undefined;
  let unfiled = false;
  let childFolders: FolderRow[] = [];
  let crumbs: FolderRow[] = [];

  if (isUnfiled) {
    unfiled = true;
  } else if (selectedId) {
    crumbs = ancestry(folders, selectedId);
    childFolders = folders.filter((f) => f.parentId === selectedId);
    folderIds = includeSub ? await folderSubtreeIds(user.id, selectedId) : [selectedId];
  } else {
    // root view: show top-level folders as cards, no memory list
    childFolders = folders.filter((f) => !f.parentId);
  }

  const showMemories = isUnfiled || !!selectedId;
  const { items } = showMemories
    ? await listMemories(user.id, { folderIds, unfiled, limit: 60 })
    : { items: [] };
  const urls = await signImageUrls(items.map((i) => i.thumbKey));

  const heading = isUnfiled
    ? "Unfiled"
    : selectedId
      ? (crumbs[crumbs.length - 1]?.name ?? "Folder")
      : "All folders";

  return (
    <AppPage>
      <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
        <FolderTree
          folders={folders}
          unfiledCount={unfiledCount}
          selectedId={selectedId}
          selectedUnfiled={isUnfiled}
        />

        <div className="min-w-0">
          {/* breadcrumb */}
          <div className="flex flex-wrap items-center gap-1 font-body text-sm text-muted-foreground">
            <Link href="/folders" className="hover:text-foreground/80">
              Folders
            </Link>
            {crumbs.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1">
                <ChevronRight className="size-3.5 text-muted-foreground/70" />
                {i === crumbs.length - 1 ? (
                  <span className="text-foreground/80">{c.name}</span>
                ) : (
                  <Link href={`/folders?f=${c.id}`} className="hover:text-foreground/80">
                    {c.name}
                  </Link>
                )}
              </span>
            ))}
            {isUnfiled && (
              <span className="flex items-center gap-1">
                <ChevronRight className="size-3.5 text-muted-foreground/70" />
                <span className="text-foreground/80">Unfiled</span>
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between">
            <h1 className="font-display text-[26px] font-bold tracking-tight text-foreground">{heading}</h1>
            {selectedId && (
              <Link
                href={`/folders?f=${selectedId}${includeSub ? "" : "&sub=1"}`}
                className="rounded-full border border-border px-3 py-1.5 font-body text-xs text-muted-foreground hover:text-foreground/80"
              >
                {includeSub ? "Direct items only" : "Include subfolders"}
              </Link>
            )}
          </div>

          {/* subfolder cards */}
          {childFolders.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {childFolders.map((f) => (
                <Link
                  key={f.id}
                  href={`/folders?f=${f.id}`}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3.5 shadow-card transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
                >
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-xl text-[15px]"
                    style={{
                      background: f.color
                        ? `color-mix(in oklab, ${f.color} 20%, transparent)`
                        : "color-mix(in oklab, var(--color-violet) 12%, transparent)",
                      color: f.color ?? "var(--color-violet-bright)",
                    }}
                  >
                    {f.emoji || <FolderTreeIcon className="size-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-sm font-semibold text-foreground">
                      {f.name}
                    </span>
                    <span className="font-body text-[11px] text-muted-foreground/70">
                      {f.count} {f.count === 1 ? "item" : "items"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* memories */}
          {showMemories &&
            (items.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  icon={FolderTreeIcon}
                  title={isUnfiled ? "Nothing unfiled" : "This folder is empty"}
                  description={
                    isUnfiled
                      ? "Everything you've captured is filed."
                      : "Move memories here from the Timeline or a memory's ⋯ menu."
                  }
                />
              </div>
            ) : (
              <Stagger className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((m) => (
                  <StaggerItem key={m.id}>
                    <MemoryCard
                      memory={{
                        id: m.id,
                        type: m.type as MemoryType,
                        title: m.title,
                        summary: m.summary,
                        capturedAt: m.capturedAt,
                        ocrConfidence: m.ocrConfidence,
                        thumbUrl: urls[m.thumbKey] ?? null,
                        mime: m.mime,
                        tags: m.tags,
                      }}
                    />
                  </StaggerItem>
                ))}
              </Stagger>
            ))}

          {!showMemories && childFolders.length === 0 && (
            <div className="mt-6">
              <EmptyState
                icon={FolderTreeIcon}
                title="No folders yet"
                description="Create a folder in the panel on the left — e.g. Personal, College, Work."
              />
            </div>
          )}
        </div>
      </div>
    </AppPage>
  );
}
