import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listDeadlines } from "@/lib/db/queries";
import { computeDeadlinePriority } from "@/lib/ai/types";
import { AppPage, PageHeader } from "@/components/app/page-header";
import { DeadlinesView } from "@/components/app/deadlines-view";

export const metadata: Metadata = { title: "Deadlines" };
export const dynamic = "force-dynamic";

export default async function DeadlinesPage() {
  const user = await requireUser("/deadlines");
  const rows = await listDeadlines(user.id);
  const initial = rows.map((d) => ({
    id: d.id,
    title: d.title,
    dueAt: d.dueAt ? d.dueAt.toISOString() : null,
    status: d.status,
    priority: computeDeadlinePriority(d.dueAt),
    source: d.source,
    sourceRefId: d.sourceRefId,
    confidence: d.confidence,
  }));

  return (
    <AppPage>
      <PageHeader
        eyebrow="Every source, one list"
        title="Deadlines"
        description="Manual entries today; WhatsApp and calls feed in automatically once those modules are configured."
      />
      <div className="mt-6">
        <DeadlinesView initial={initial} />
      </div>
    </AppPage>
  );
}
