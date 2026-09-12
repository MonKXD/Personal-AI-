"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createWebhookAction, deleteWebhookAction } from "@/app/(app)/settings/actions";
import { relativeTime } from "@/lib/utils";

const EVENTS = [
  ["capture.completed", "A capture finishes processing"],
  ["memory.created", "A new memory is created"],
  ["action_item.due_soon", "A deadline is ~24h away"],
  ["digest.weekly", "The weekly recap is generated"],
] as const;

export type WebhookView = {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  lastStatus: number | null;
  lastDeliveryAt: string | null;
};

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Plus />} Add webhook
    </Button>
  );
}

export function Webhooks({ hooks }: { hooks: WebhookView[] }) {
  const [state, action] = useActionState(createWebhookAction, {});

  useEffect(() => {
    if (state.ok) toast.success("Webhook added.");
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-muted-foreground">
        POST to your URL when things happen. Each request carries an{" "}
        <code className="text-muted-foreground">X-Personal AI-Signature</code> header —
        <code className="text-muted-foreground"> sha256=HMAC(secret, body)</code>. Auto-disabled
        after 15 straight failures.
      </p>

      <form action={action} className="space-y-2.5 rounded-xl border border-border bg-muted p-3">
        <input
          name="url"
          type="url"
          placeholder="https://your-app.com/hooks/personal-ai"
          className="w-full rounded-lg border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-violet/40"
        />
        <div className="grid gap-1.5 sm:grid-cols-2">
          {EVENTS.map(([ev, label]) => (
            <label key={ev} className="flex items-start gap-2 font-body text-xs text-muted-foreground">
              <input
                type="checkbox"
                name={ev}
                defaultChecked
                className="mt-0.5 size-3.5 rounded border-border accent-[var(--color-violet)]"
              />
              <span>
                <code className="text-foreground/80">{ev}</code>
                <span className="block text-muted-foreground/70">{label}</span>
              </span>
            </label>
          ))}
        </div>
        <AddButton />
      </form>

      {hooks.length > 0 && (
        <ul className="space-y-2">
          {hooks.map((h) => (
            <li key={h.id} className="rounded-xl border border-border bg-muted p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-foreground/80">{h.url}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {h.events.map((e) => (
                      <span key={e} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {e}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 font-body text-[11px] text-muted-foreground/70">
                    {!h.active && <span className="text-warning">disabled · </span>}
                    {h.lastDeliveryAt
                      ? `last ${h.lastStatus ?? "?"} · ${relativeTime(h.lastDeliveryAt)}`
                      : "no deliveries yet"}
                  </div>
                  <details className="mt-1.5">
                    <summary className="cursor-pointer font-body text-[11px] text-violet-bright">
                      signing secret
                    </summary>
                    <code className="mt-1 block break-all font-mono text-[10px] text-muted-foreground">{h.secret}</code>
                  </details>
                </div>
                <form action={deleteWebhookAction}>
                  <input type="hidden" name="id" value={h.id} />
                  <Button type="submit" variant="ghost" size="icon" aria-label="Delete webhook">
                    <Trash2 />
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
