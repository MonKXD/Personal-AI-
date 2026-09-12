"use client";

import * as React from "react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createApiKey, revokeApiKey } from "@/app/(app)/settings/actions";
import { relativeTime } from "@/lib/utils";

export type ApiKeyView = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Plus />} New key
    </Button>
  );
}

export function ApiKeys({ keys }: { keys: ApiKeyView[] }) {
  const [state, action] = useActionState(createApiKey, {});
  const [copied, setCopied] = useState(false);
  const fresh = state.token ?? null;

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-muted-foreground">
        Personal tokens for the REST API (<code className="text-muted-foreground">/api/v1</code>).
        Pass <code className="text-muted-foreground">Authorization: Bearer mm_…</code>. Shown once —
        store it somewhere safe.
      </p>

      <form action={action} className="flex gap-2">
        <input
          name="name"
          placeholder="What's it for? (e.g. Zapier)"
          maxLength={60}
          className="min-w-0 flex-1 rounded-lg border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-violet/40"
        />
        <CreateButton />
      </form>

      {fresh && (
        <div className="rounded-xl border border-violet/30 bg-violet/[0.06] p-3">
          <div className="mb-1.5 font-body text-[11px] font-semibold uppercase tracking-wide text-violet-bright">
            Copy this now — it won&rsquo;t be shown again
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/80">{fresh}</code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(fresh).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground/80"
              aria-label="Copy token"
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        </div>
      )}

      {keys.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 bg-muted p-3">
              <div className="min-w-0">
                <div className="truncate font-body text-sm text-foreground/80">
                  {k.name} <span className="font-mono text-xs text-muted-foreground/70">{k.prefix}…</span>
                </div>
                <div className="font-body text-[11px] text-muted-foreground/70">
                  {k.lastUsedAt ? `last used ${relativeTime(k.lastUsedAt)}` : "never used"} · added{" "}
                  {relativeTime(k.createdAt)}
                </div>
              </div>
              <form action={revokeApiKey}>
                <input type="hidden" name="id" value={k.id} />
                <Button type="submit" variant="ghost" size="icon" aria-label={`Revoke ${k.name}`}>
                  <Trash2 />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
