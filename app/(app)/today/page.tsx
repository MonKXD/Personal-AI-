import type { Metadata } from "next";
import Link from "next/link";
import { Camera, ScanText, Sun } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  countCapturesSince,
  listActionItems,
  listMemoriesBetween,
  listMemoriesNeedingReview,
} from "@/lib/db/queries";
import { buildDigest } from "@/lib/pipeline/digest";
import { AppPage, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { ActionItemList, type ActionItem } from "@/components/app/action-item-list";
import { MEMORY_TYPE_META, type MemoryType } from "@/lib/memory-types";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireUser("/today");

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [todays, actions, review, weekCount] = await Promise.all([
    listMemoriesBetween(user.id, start, end),
    listActionItems(user.id, { status: "open" }),
    listMemoriesNeedingReview(user.id),
    countCapturesSince(user.id, weekAgo),
  ]);

  const digest = buildDigest(
    todays.map((m) => ({ id: m.id, type: m.type as MemoryType, title: m.title })),
  );

  const nowMs = now.getTime();
  const actionItems: ActionItem[] = actions.map((a) => ({
    id: a.id,
    title: a.title,
    dueAt: a.dueAt ? a.dueAt.toISOString() : null,
    status: a.status,
    memoryId: a.memoryId,
    memoryTitle: a.memoryTitle,
    overdue: !!a.dueAt && a.dueAt.getTime() < nowMs,
  }));

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <AppPage>
      <PageHeader eyebrow={dateLabel} title="Today" />

      {weekCount > 0 && (
        <p className="mt-4 font-body text-sm text-muted-foreground">
          <span className="font-semibold text-foreground/80">{weekCount}</span>{" "}
          {weekCount === 1 ? "thing" : "things"} captured in the last 7 days.
        </p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Digest */}
        {todays.length === 0 ? (
          <EmptyState
            icon={Sun}
            title="No digest yet"
            description="Capture a few things today and MirrorMind will recap them here."
            action={
              <Button asChild>
                <Link href="/capture">
                  <Camera /> Capture something
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="font-body text-sm text-foreground/80">{digest.sentence}</p>
            <div className="mt-4 space-y-4">
              {digest.groups.map((g) => {
                const Icon = MEMORY_TYPE_META[g.type].icon;
                return (
                  <div key={g.type}>
                    <div className="flex items-center gap-1.5 font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
                      <Icon className="size-3.5" /> {g.label}
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {g.items.map((it) => (
                        <li key={it.id}>
                          <Link
                            href={`/memory/${it.id}`}
                            className="font-body text-sm text-foreground/80 hover:text-violet-bright"
                          >
                            {it.title || "Untitled memory"}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action items */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="font-display text-sm font-semibold text-foreground/80">Action items</div>
          <p className="mb-3 mt-0.5 font-body text-xs text-muted-foreground/70">
            Open deadlines from every capture, soonest first.
          </p>
          <ActionItemList items={actionItems} />
        </div>
      </div>

      {/* Needs review */}
      {review.length > 0 && (
        <div className="mt-5 rounded-xl border border-warning/25 bg-warning/[0.06] p-5">
          <div className="flex items-center gap-2 font-display text-sm font-semibold text-foreground/80">
            <ScanText className="size-4 text-warning" />
            Needs review
            <span className="rounded-full bg-warning/15 px-1.5 py-0.5 font-body text-[11px] font-semibold text-warning">
              {review.length}
            </span>
          </div>
          <p className="mb-3 mt-0.5 font-body text-xs text-muted-foreground/70">
            MirrorMind wasn&rsquo;t confident it read these. Open one to fix the text — it re-embeds so chat stays accurate.
          </p>
          <ul className="space-y-1">
            {review.map((m) => {
              const Icon = MEMORY_TYPE_META[m.type as MemoryType].icon;
              return (
                <li key={m.id}>
                  <Link
                    href={`/memory/${m.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-body text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-violet-bright"
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground/70" />
                    <span className="truncate">{m.title || "Untitled memory"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </AppPage>
  );
}
