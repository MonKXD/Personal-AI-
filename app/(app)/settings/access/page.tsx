import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser, isOwner } from "@/lib/auth";
import { listMembers } from "@/lib/db/queries";
import { getEnv } from "@/lib/env";
import { DEMO_USER_ID } from "@/lib/demo";
import { AppPage, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { MemberList, type MemberView } from "@/components/app/member-list";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const user = await requireUser("/settings/access");
  if (!isOwner(user)) notFound();

  const max = getEnv().MAX_USERS;
  const rows = await listMembers();

  // Seats are counted excluding the demo account (it never takes a seat).
  const seatsUsed = rows.filter((r) => r.id !== DEMO_USER_ID).length;
  const full = max > 0 && seatsUsed >= max;

  const members: MemberView[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.displayName || r.email?.split("@")[0] || "Member",
    joined: r.createdAt.toISOString(),
    isOwner: r.id === user.id,
    isDemo: r.id === DEMO_USER_ID,
  }));

  return (
    <AppPage className="max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/settings">
          <ArrowLeft /> Settings
        </Link>
      </Button>

      <PageHeader
        title="Members"
        description="Anyone with the link can sign up until the seats are full. Remove someone to free a seat."
        className="mt-3"
      />

      <div
        className={
          "mt-5 flex items-center justify-between rounded-2xl border p-4 " +
          (full ? "border-warning/30 bg-warning/10" : "border-border bg-muted")
        }
      >
        <div>
          <div className="font-display text-sm font-semibold text-foreground/80">
            {max > 0 ? `${seatsUsed} of ${max} seats used` : `${seatsUsed} members`}
          </div>
          <div className="mt-0.5 font-body text-xs text-muted-foreground">
            {full
              ? "Sign-ups are closed until you remove someone."
              : max > 0
                ? `${max - seatsUsed} more can join with the link.`
                : "Sign-ups are open."}
          </div>
        </div>
      </div>

      <MemberList members={members} />

      <p className="mt-4 font-body text-xs text-muted-foreground/70">
        Removing a member permanently deletes their account, their captures and
        their files, and opens their seat. You and the demo account can&rsquo;t be
        removed. Sign-in itself is open &mdash; no invite list.
      </p>
    </AppPage>
  );
}
