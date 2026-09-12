"use client";

import * as React from "react";
import { Upload, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  addFinanceTransaction,
  getSpendingSummary,
  listFinanceTransactions,
  uploadStatement,
  type FinanceTransaction,
  type SpendingSummary,
} from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/app/empty-state";

const FINANCE_CATEGORIES = [
  "Food",
  "Travel",
  "Subscriptions",
  "Education",
  "Shopping",
  "Rent/Housing",
  "Health",
  "Entertainment",
  "Transfers",
  "Income",
  "Other",
];

const selectClass =
  "flex h-10 rounded-md border border-input bg-muted px-3 text-sm text-foreground focus-visible:outline-none focus-visible:border-violet/40 focus-visible:ring-2 focus-visible:ring-ring/50";

export function FinanceView({
  initialTransactions,
  initialSummary,
}: {
  initialTransactions: FinanceTransaction[];
  initialSummary: SpendingSummary;
}) {
  const [transactions, setTransactions] = React.useState<FinanceTransaction[]>(initialTransactions);
  const [summary, setSummary] = React.useState<SpendingSummary>(initialSummary);

  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = React.useState("");
  const [direction, setDirection] = React.useState<"income" | "expense">("expense");
  const [category, setCategory] = React.useState(FINANCE_CATEGORIES[0]);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [accountLabel, setAccountLabel] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function refresh() {
    const month = new Date().toISOString().slice(0, 7);
    try {
      const [tx, sum] = await Promise.all([listFinanceTransactions(), getSpendingSummary(month)]);
      setTransactions(tx);
      setSummary(sum);
    } catch {
      toast.error("Couldn't refresh finance data.");
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!date || !Number.isFinite(n) || n <= 0) return;
    setSaving(true);
    try {
      await addFinanceTransaction({ date, amount: n, direction, category, note: note || undefined });
      setAmount("");
      setNote("");
      await refresh();
    } catch {
      toast.error("Couldn't add transaction.");
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !accountLabel.trim()) return;
    setUploading(true);
    try {
      const result = await uploadStatement(file, accountLabel.trim());
      toast.success(`Imported ${result.rowsInserted} of ${result.rowsParsed} rows.`);
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't process that statement.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={onAdd} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="font-display text-sm font-semibold text-foreground/80">Add a transaction</div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <select
              className={selectClass}
              value={direction}
              onChange={(e) => setDirection(e.target.value as "income" | "expense")}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              {FINANCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" disabled={saving} className="w-full">
            <Wallet /> Add transaction
          </Button>
        </form>

        <form onSubmit={onUpload} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="font-display text-sm font-semibold text-foreground/80">Upload a statement</div>
          <p className="font-body text-xs text-muted-foreground/70">
            CSV or PDF export from your bank/UPI app. Rows are auto-categorized and deduped against
            re-uploads.
          </p>
          <Input
            placeholder="Which account? (e.g. HDFC Savings)"
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
          />
          <input
            ref={fileRef}
            type="file"
            accept=".csv,application/pdf"
            className="block w-full font-body text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <Button type="submit" disabled={uploading || !accountLabel.trim()} className="w-full">
            <Upload /> {uploading ? "Processing…" : "Upload"}
          </Button>
        </form>
      </div>

      {summary && summary.categories.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="font-display text-sm font-semibold text-foreground/80">
            This month · ₹{summary.total.toFixed(2)}
          </div>
          <ul className="mt-3 space-y-1.5">
            {summary.categories.map((c) => (
              <li key={c.category} className="flex items-center justify-between font-body text-sm">
                <span className="text-foreground/80">{c.category}</span>
                <span className="text-muted-foreground/70">
                  ₹{Number(c.total).toFixed(2)} · {c.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {transactions.length === 0 ? (
        <EmptyState icon={Wallet} title="No transactions yet" description="Add one above, or upload a statement." />
      ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full font-body text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground/70">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Merchant / note</th>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground/80">{t.occurredOn}</td>
                    <td className="px-4 py-2.5">{t.category}</td>
                    <td className="px-4 py-2.5 text-muted-foreground/80">{t.merchant ?? t.note ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground/70">
                      {t.source === "manual" ? "Manual" : "Statement"}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${
                        t.direction === "income" ? "text-success" : "text-foreground/80"
                      }`}
                    >
                      {t.direction === "income" ? "+" : "-"}₹{Number(t.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      )}
    </div>
  );
}
