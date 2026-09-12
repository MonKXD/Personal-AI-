import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listCalls } from "@/lib/db/queries";
import { AppPage, PageHeader } from "@/components/app/page-header";
import { CallsView } from "@/components/app/calls-view";

export const metadata: Metadata = { title: "Calls" };
export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const user = await requireUser("/calls");
  const rows = await listCalls(user.id);
  const initial = rows.map((c) => ({
    id: c.id,
    direction: c.direction,
    counterpart: c.counterpart,
    status: c.status,
    purpose: c.purpose,
    summary: c.summary,
    durationSec: c.durationSec,
    createdAt: c.createdAt.toISOString(),
  }));
  return (
    <AppPage>
      <PageHeader
        eyebrow="Twilio + ConversationRelay"
        title="Calling assistant"
        description="Place a real, AI-conducted phone call and get a transcript + summary back."
      />
      <div className="mt-6">
        <CallsView initial={initial} />
      </div>
    </AppPage>
  );
}
