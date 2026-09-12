"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/**
 * Shows the read-only calendar-subscription URL for the user's deadlines,
 * with copy + "add to Google Calendar" helpers.
 */
export function CalendarFeed({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);
  const webcal = url.replace(/^https?:/, "webcal:");
  const gcal = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Calendar link copied.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  };

  return (
    <div className="space-y-3">
      <p className="font-body text-sm text-muted-foreground">
        Subscribe from Apple Calendar, Google Calendar, or Outlook to see every
        deadline MirrorMind reads. Updates a few times a day. Anyone with this
        link can see your deadlines, so keep it private.
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{webcal}</code>
        <button
          onClick={copy}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/80"
          aria-label="Copy calendar link"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={webcal}
          className="rounded-lg border border-border bg-muted px-3 py-1.5 font-body text-xs text-foreground/80 transition-colors hover:border-violet/40"
        >
          Add to Apple Calendar
        </a>
        <a
          href={gcal}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-border bg-muted px-3 py-1.5 font-body text-xs text-foreground/80 transition-colors hover:border-violet/40"
        >
          Add to Google Calendar
        </a>
      </div>
    </div>
  );
}
