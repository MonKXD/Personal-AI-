import type { Metadata } from "next";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { countCapturesSince, listRecentCaptures } from "@/lib/db/queries";
import { signImageUrls } from "@/lib/storage";
import { recoverStuckForUser } from "@/lib/pipeline/recover";
import { aiMode } from "@/lib/ai";
import { getEnv } from "@/lib/env";
import { startOfUtcDayForTz } from "@/lib/time";
import { AppPage, PageHeader } from "@/components/app/page-header";
import { CapturePanel } from "@/components/app/capture-panel";
import { RecentStrip, type RecentItem } from "@/components/app/recent-strip";
import type { MemoryType } from "@/lib/memory-types";

export const metadata: Metadata = { title: "Capture" };
export const dynamic = "force-dynamic";

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ processing?: string }>;
}) {
  const user = await requireUser("/capture");
  const env = getEnv();
  const { processing } = await searchParams;

  const dayStart = startOfUtcDayForTz(new Date(), env.APP_TZ);
  const [rows, usedToday] = await Promise.all([
    listRecentCaptures(user.id, 12),
    countCapturesSince(user.id, dayStart),
  ]);
  const urls = await signImageUrls(rows.map((r) => r.thumbKey));

  // Re-run any captures whose pipeline died (deploy / timeout). Non-blocking.
  after(() => recoverStuckForUser(user.id));

  const items: RecentItem[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    capturedAt: r.capturedAt,
    memoryId: r.memoryId,
    type: (r.type as MemoryType | null) ?? null,
    title: r.title,
    thumbUrl: urls[r.thumbKey] ?? null,
    mime: r.mime,
  }));

  const remaining = Math.max(0, env.DAILY_CAPTURE_LIMIT - usedToday);
  // getAudioTranscriber() (lib/ai/index.ts) only has a real implementation
  // for these two providers — hide Voice mode rather than let someone spend
  // a capture slot on a recording that's guaranteed to fail in the pipeline.
  const audioSupported = aiMode().provider === "gemini" || aiMode().provider === "fixture";

  return (
    <AppPage>
      <PageHeader
        title="Capture"
        description="Point your camera, record a note, or drop a link — MirrorMind reads it and remembers."
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <CapturePanel
          remaining={remaining}
          limit={env.DAILY_CAPTURE_LIMIT}
          initialProcessingId={processing}
          audioSupported={audioSupported}
        />

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 font-body text-sm shadow-card">
            <div className="font-display font-semibold text-foreground">What works best</div>
            <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-muted-foreground">
              <li>Fill the frame with the notice or page</li>
              <li>Flat surface, even light, dark ink</li>
              <li>One thing per capture</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="font-display text-sm font-semibold text-foreground">Recent</div>
              <span className="font-body text-xs text-muted-foreground">
                {remaining}/{env.DAILY_CAPTURE_LIMIT} left today
              </span>
            </div>
            <div className="mt-3">
              <RecentStrip items={items} />
            </div>
          </div>
          <p className="font-body text-xs leading-relaxed text-muted-foreground">
            Runs on Google&rsquo;s free AI tier during the beta — captures may be used to
            improve their models. Keep anything truly confidential off it for now.
          </p>
        </aside>
      </div>
    </AppPage>
  );
}
