import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listWhatsappMessages } from "@/lib/db/queries";
import { AppPage, PageHeader } from "@/components/app/page-header";
import { WhatsappView } from "@/components/app/whatsapp-view";

export const metadata: Metadata = { title: "WhatsApp" };
export const dynamic = "force-dynamic";

export default async function WhatsappPage() {
  const user = await requireUser("/whatsapp");
  const rows = await listWhatsappMessages(user.id);
  const initial = rows.map((m) => ({
    id: m.id,
    chatId: m.chatId,
    chatName: m.chatName,
    sender: m.sender,
    text: m.text,
    category: m.category,
    reason: m.reason,
    occurredAt: m.occurredAt.toISOString(),
  }));
  return (
    <AppPage>
      <PageHeader
        eyebrow="Passive, read-only triage"
        title="WhatsApp"
        description="A mirror of what an external listener observed and categorized — this app never sends or replies on your behalf."
      />
      <div className="mt-6">
        <WhatsappView initial={initial} />
      </div>
    </AppPage>
  );
}
