import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser, isOwner } from "@/lib/auth";
import { listFeedback } from "@/lib/db/queries";
import { AppPage, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { absoluteTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Feedback" };
export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const user = await requireUser("/settings/feedback");
  if (!isOwner(user)) notFound();

  const rows = await listFeedback(200);

  return (
    <AppPage className="max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/settings">
          <ArrowLeft /> Settings
        </Link>
      </Button>

      <PageHeader
        title="Feedback"
        description="Problem reports from the app. Newest first."
        className="mt-3"
      />

      {rows.length === 0 ? (
        <p className="mt-6 font-body text-sm text-muted-foreground/70">Nothing yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((f) => (
            <li key={f.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <p className="whitespace-pre-wrap font-body text-sm text-foreground/80">{f.message}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-body text-[11px] text-muted-foreground/70">
                <span>{f.email ?? "unknown"}</span>
                {f.page && <span className="font-mono">{f.page}</span>}
                <span>{absoluteTime(f.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppPage>
  );
}
