"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { connectTelegram, disconnectTelegram } from "@/app/(app)/settings/actions";

export function TelegramConnect({ linked }: { linked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function connect() {
    setBusy(true);
    try {
      const r = await connectTelegram();
      if (r.error || !r.url) {
        toast.error(r.error ?? "Couldn't start the link.");
        return;
      }
      window.open(r.url, "_blank", "noopener");
      toast("Opening Telegram — tap Start there, then come back.");
      // give the /start round-trip a moment, then refresh the linked state
      setTimeout(() => router.refresh(), 4000);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await disconnectTelegram();
      toast("Telegram disconnected.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 font-body text-sm">
      <div>
        <span className="text-muted-foreground">Telegram</span>
        <span className="block text-xs text-muted-foreground/70">
          {linked
            ? "Connected — DM the bot a photo, link, or note to save it."
            : "Save things by messaging the bot."}
        </span>
      </div>
      {linked ? (
        <Button variant="secondary" size="sm" onClick={disconnect} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null} Disconnect
        </Button>
      ) : (
        <Button size="sm" onClick={connect} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Send />} Connect
        </Button>
      )}
    </div>
  );
}
