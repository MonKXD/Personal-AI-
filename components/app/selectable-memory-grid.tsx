"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CheckSquare, FolderInput, X } from "lucide-react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { MemoryCard, type MemoryCardData } from "@/components/app/memory-card";
import { FolderPickerDialog } from "@/components/app/folder-picker";
import { Stagger, StaggerItem } from "@/components/fx/stagger";
import { cn } from "@/lib/utils";

export function SelectableMemoryGrid({ memories }: { memories: MemoryCardData[] }) {
  const router = useRouter();
  // Animate cards in/out as filters narrow the list or a "Move" removes
  // them. auto-animate no-ops on first mount (Stagger owns that) and
  // honours prefers-reduced-motion on its own.
  const [gridRef] = useAutoAnimate<HTMLDivElement>();
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const exit = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allSelected = selected.size === memories.length && memories.length > 0;

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-display text-base font-semibold tracking-tight text-foreground/80">
          {selectMode ? `${selected.size} selected` : "Recent"}
        </div>
        {selectMode ? (
          <div className="flex items-center gap-2 font-body text-xs">
            <button
              onClick={() => setSelected(allSelected ? new Set() : new Set(memories.map((m) => m.id)))}
              className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground/80"
            >
              {allSelected ? "Clear" : "Select all"}
            </button>
            <button
              onClick={() => setPickerOpen(true)}
              disabled={selected.size === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet/16 px-3 py-1 font-semibold text-violet-bright disabled:opacity-40"
            >
              <FolderInput className="size-3.5" /> Move
            </button>
            <button
              onClick={exit}
              className="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground/80"
              aria-label="Done"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSelectMode(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 font-body text-xs text-muted-foreground hover:text-foreground/80"
          >
            <CheckSquare className="size-3.5" /> Select
          </button>
        )}
      </div>

      <Stagger
        ref={gridRef}
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4"
      >
        {memories.map((m) => {
          const isSel = selected.has(m.id);
          return (
            <StaggerItem key={m.id}>
              <div className="relative">
                <div className={cn(selectMode && "pointer-events-none")}>
                  <MemoryCard memory={m} />
                </div>
                {selectMode && (
                  <button
                    onClick={() => toggle(m.id)}
                    aria-pressed={isSel}
                    aria-label={isSel ? "Deselect" : "Select"}
                    className={cn(
                      "absolute inset-0 rounded-2xl border-2 transition-colors",
                      isSel ? "border-violet bg-violet/12" : "border-transparent hover:border-border",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute right-2 top-2 grid size-5 place-items-center rounded-md border",
                        isSel
                          ? "border-violet bg-violet text-foreground"
                          : "border-border bg-muted",
                      )}
                    >
                      {isSel && <Check className="size-3.5" />}
                    </span>
                  </button>
                )}
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>

      <FolderPickerDialog
        memoryIds={[...selected]}
        currentFolderId={null}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onMoved={() => {
          exit();
          router.refresh();
        }}
      />
    </>
  );
}
