import type { Metadata } from "next";
import Link from "next/link";
import { Camera, LayoutGrid, Pin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listMemories, listPinnedMemories } from "@/lib/db/queries";
import { signImageUrls } from "@/lib/storage";
import { AppPage, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { TimelineFilters } from "@/components/app/timeline-filters";
import { SelectableMemoryGrid } from "@/components/app/selectable-memory-grid";
import { Button } from "@/components/ui/button";
import { MEMORY_TYPES, type MemoryType } from "@/lib/memory-types";

export const metadata: Metadata = { title: "Timeline" };
export const dynamic = "force-dynamic";

function rangeToDates(range?: string): { after?: Date } {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return { after: d };
  }
  if (range === "week") {
    const d = new Date(now);
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return { after: d };
  }
  return {};
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; types?: string; q?: string }>;
}) {
  const user = await requireUser("/timeline");
  const sp = await searchParams;

  const types = (sp.types ?? "")
    .split(",")
    .filter((t): t is MemoryType => (MEMORY_TYPES as readonly string[]).includes(t));

  const hasFilters = Boolean(sp.range || sp.types || sp.q);

  const [{ items }, pinned] = await Promise.all([
    listMemories(user.id, {
      ...rangeToDates(sp.range),
      types: types.length ? types : undefined,
      q: sp.q,
      limit: 48,
      excludePinned: !hasFilters, // pinned show in their own shelf when unfiltered
    }),
    hasFilters ? Promise.resolve([]) : listPinnedMemories(user.id),
  ]);

  const urls = await signImageUrls(
    [...items, ...pinned].map((i) => i.thumbKey),
  );

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <AppPage>
      <PageHeader
        eyebrow={dateLabel}
        title="Your memory"
        accent={`${items.length} ${items.length === 1 ? "thing" : "things"} captured${hasFilters ? " (filtered)" : ""}`}
        actions={
          <Button asChild size="lg">
            <Link href="/capture">
              <Camera /> Capture
            </Link>
          </Button>
        }
      />

      <div className="mt-6 space-y-3">
        <TimelineFilters />
      </div>

      {pinned.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-1.5 font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
            <Pin className="size-3.5" /> Pinned
          </div>
          <SelectableMemoryGrid
            memories={pinned.map((m) => ({
              id: m.id,
              type: m.type,
              title: m.title,
              summary: m.summary,
              capturedAt: m.capturedAt,
              ocrConfidence: m.ocrConfidence,
              thumbUrl: urls[m.thumbKey] ?? null,
              mime: m.mime,
              tags: m.tags,
            }))}
          />
        </div>
      )}

      {items.length === 0 && pinned.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={LayoutGrid}
            title={hasFilters ? "No memories match" : "Your timeline is empty"}
            description={
              hasFilters
                ? "Try clearing a filter."
                : "Capture a notice, a timetable, or a page and it'll appear here with its type, key details, and the original image."
            }
            action={
              !hasFilters && (
                <Button asChild>
                  <Link href="/capture">
                    <Camera /> Capture your first memory
                  </Link>
                </Button>
              )
            }
          />
        </div>
      ) : items.length === 0 ? null : (
        <div className="mt-8">
          {pinned.length > 0 && (
            <div className="mb-3 font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
              All
            </div>
          )}
          <SelectableMemoryGrid
            memories={items.map((m) => ({
              id: m.id,
              type: m.type,
              title: m.title,
              summary: m.summary,
              capturedAt: m.capturedAt,
              ocrConfidence: m.ocrConfidence,
              thumbUrl: urls[m.thumbKey] ?? null,
              mime: m.mime,
              tags: m.tags,
            }))}
          />
        </div>
      )}
    </AppPage>
  );
}
