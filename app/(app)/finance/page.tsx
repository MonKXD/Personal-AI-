import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSpendingSummary, listFinanceTransactions } from "@/lib/db/queries";
import { AppPage, PageHeader } from "@/components/app/page-header";
import { FinanceView } from "@/components/app/finance-view";

export const metadata: Metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const user = await requireUser("/finance");
  const month = new Date().toISOString().slice(0, 7);
  const [rows, categories] = await Promise.all([
    listFinanceTransactions(user.id),
    getSpendingSummary(user.id, month),
  ]);
  const transactions = rows.map((t) => ({
    id: t.id,
    occurredOn: t.occurredOn,
    amount: t.amount,
    direction: t.direction,
    category: t.category,
    merchant: t.merchant,
    note: t.note,
    source: t.source,
    createdAt: t.createdAt.toISOString(),
  }));
  const summary = {
    month,
    total: categories.reduce((sum, c) => sum + Number(c.total), 0),
    categories,
  };

  return (
    <AppPage>
      <PageHeader
        eyebrow="Manual entry + statement upload"
        title="Finance"
        description="Log an expense directly, or upload a bank/UPI statement (CSV or PDF) to categorize a batch at once."
      />
      <div className="mt-6">
        <FinanceView initialTransactions={transactions} initialSummary={summary} />
      </div>
    </AppPage>
  );
}
