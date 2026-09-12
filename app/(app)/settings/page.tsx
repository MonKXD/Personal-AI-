import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser, userDisplayName, isOwner } from "@/lib/auth";
import {
  getPrefs,
  getOrCreateCalendarToken,
  listApiTokens,
  listWebhooks,
  getTelegramLink,
} from "@/lib/db/queries";
import { isDemoUser } from "@/lib/demo";
import { publicEnv } from "@/lib/env";
import { AppPage, PageHeader } from "@/components/app/page-header";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { PushToggle } from "@/components/app/push-toggle";
import { pushEnabled } from "@/lib/push";
import { telegramEnabled } from "@/lib/telegram";
import { TelegramConnect } from "@/components/app/telegram-connect";
import { SettingsForm } from "@/components/app/settings-form";
import { AccountActions } from "@/components/app/account-actions";
import { InstallButton } from "@/components/app/install-button";
import { PrivacyNote } from "@/components/app/privacy-note";
import { CalendarFeed } from "@/components/app/calendar-feed";
import { ApiKeys, type ApiKeyView } from "@/components/app/api-keys";
import { Webhooks, type WebhookView } from "@/components/app/webhooks";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const prefs = await getPrefs(user.id);
  const calUrl = isDemoUser(user.id)
    ? null
    : `${publicEnv.siteUrl.replace(/\/$/, "")}/api/calendar/${await getOrCreateCalendarToken(user.id)}`;
  const apiKeys: ApiKeyView[] = isDemoUser(user.id)
    ? []
    : (await listApiTokens(user.id)).map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      }));
  const webhookList: WebhookView[] = isDemoUser(user.id)
    ? []
    : (await listWebhooks(user.id)).map((h) => ({
        id: h.id,
        url: h.url,
        secret: h.secret,
        events: h.events,
        active: h.active,
        lastStatus: h.lastStatus,
        lastDeliveryAt: h.lastDeliveryAt?.toISOString() ?? null,
      }));
  const showTelegram = telegramEnabled() && !isDemoUser(user.id);
  const telegramLinked = showTelegram
    ? ((await getTelegramLink(user.id))?.linked ?? false)
    : false;

  return (
    <AppPage className="max-w-2xl">
      <PageHeader title="Settings" />

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
            Account
          </h2>
          <div className="mt-3 rounded-xl border border-border bg-card p-4 shadow-card">
            <Row label="Name" value={userDisplayName(user)} />
            <Separator className="my-3 bg-border" />
            <Row label="Email" value={user.email ?? "—"} />
          </div>
        </section>

        <section>
          <h2 className="font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
            Preferences
          </h2>
          <div className="mt-3 space-y-4 rounded-xl border border-border bg-card p-4 shadow-card">
            <ThemeToggle />
            {pushEnabled() && (
              <>
                <Separator className="bg-border" />
                <PushToggle />
              </>
            )}
            <Separator className="bg-border" />
            <SettingsForm initial={prefs} />
          </div>
        </section>

        {isOwner(user) && (
          <section>
            <h2 className="font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
              Admin
            </h2>
            <div className="mt-3 space-y-2">
              <Link
                href="/settings/access"
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card font-body text-sm transition-colors hover:border-violet/30"
              >
                <div>
                  <div className="font-medium text-foreground/80">Members</div>
                  <div className="text-xs text-muted-foreground/70">
                    See who&rsquo;s in · remove someone to free a seat
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/70" />
              </Link>
              <Link
                href="/settings/feedback"
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card font-body text-sm transition-colors hover:border-violet/30"
              >
                <div>
                  <div className="font-medium text-foreground/80">Feedback</div>
                  <div className="text-xs text-muted-foreground/70">Problem reports from the app</div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/70" />
              </Link>
            </div>
          </section>
        )}

        {calUrl && (
          <section>
            <h2 className="font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
              Calendar
            </h2>
            <div className="mt-3 rounded-xl border border-border bg-card p-4 shadow-card">
              <CalendarFeed url={calUrl} />
            </div>
          </section>
        )}

        {!isDemoUser(user.id) && (
          <section>
            <h2 className="font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
              API
            </h2>
            <div className="mt-3 rounded-xl border border-border bg-card p-4 shadow-card">
              <ApiKeys keys={apiKeys} />
            </div>
          </section>
        )}

        {!isDemoUser(user.id) && (
          <section>
            <h2 className="font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
              Webhooks
            </h2>
            <div className="mt-3 rounded-xl border border-border bg-card p-4 shadow-card">
              <Webhooks hooks={webhookList} />
            </div>
          </section>
        )}

        {showTelegram && (
          <section>
            <h2 className="font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
              Telegram
            </h2>
            <div className="mt-3 rounded-xl border border-border bg-card p-4 shadow-card">
              <TelegramConnect linked={telegramLinked} />
            </div>
          </section>
        )}

        <section>
          <h2 className="font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
            Privacy
          </h2>
          <div className="mt-3">
            <PrivacyNote variant="card" />
          </div>
        </section>

        <section>
          <h2 className="font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
            App
          </h2>
          <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="font-body text-sm text-muted-foreground">
              Install Personal AI for faster access and a share-to-capture
              shortcut from your phone&rsquo;s share sheet.
            </p>
            <InstallButton />
          </div>
        </section>

        <section>
          <h2 className="font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
            Your data
          </h2>
          <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="font-body text-sm text-muted-foreground">
              Download everything you&rsquo;ve captured, or permanently delete your
              account and all memories.
            </p>
            <AccountActions />
          </div>
        </section>
      </div>
    </AppPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between font-body text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground/80">{value}</span>
    </div>
  );
}
