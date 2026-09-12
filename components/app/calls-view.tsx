"use client";

import * as React from "react";
import { Phone, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { listCalls, placeCall, type CallItem } from "@/lib/api-client";
import { absoluteTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/app/empty-state";

const STATUS_LABEL: Record<CallItem["status"], string> = {
  in_progress: "In progress",
  completed: "Completed",
  missed: "Missed",
  voicemail: "Voicemail",
  failed: "Failed",
};

export function CallsView({ initial }: { initial: CallItem[] }) {
  const [calls, setCalls] = React.useState<CallItem[]>(initial);
  const [to, setTo] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [placing, setPlacing] = React.useState(false);

  async function onPlace(e: React.FormEvent) {
    e.preventDefault();
    if (!to.trim() || !instructions.trim()) return;
    setPlacing(true);
    try {
      await placeCall({ to: to.trim(), purpose: purpose.trim() || undefined, instructions: instructions.trim() });
      setTo("");
      setPurpose("");
      setInstructions("");
      toast.success("Call placed.");
      setCalls(await listCalls());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't place that call.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onPlace} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="font-display text-sm font-semibold text-foreground/80">Place a call</div>
        <p className="font-body text-xs text-muted-foreground/70">
          Needs Twilio + a ConversationRelay WebSocket handler configured (see
          docs/modules/calling-assistant.md) — until then this returns a clear setup error rather
          than pretending to call anyone.
        </p>
        <Input placeholder="Phone number (E.164, e.g. +91XXXXXXXXXX)" value={to} onChange={(e) => setTo(e.target.value)} />
        <Input placeholder="Purpose (short label)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        <textarea
          placeholder="What should the assistant say/ask/accomplish on this call?"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-muted px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-violet/40 focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <Button type="submit" disabled={placing} className="w-full">
          <PhoneCall /> {placing ? "Placing…" : "Place call"}
        </Button>
      </form>

      {calls.length === 0 ? (
        <EmptyState icon={Phone} title="No calls yet" description="Placed and received calls will show up here." />
      ) : (
        <ul className="space-y-2">
          {calls.map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between font-body text-sm">
                <span className="font-medium text-foreground/80">
                  {c.direction === "outbound" ? "→" : "←"} {c.counterpart}
                </span>
                <span className="text-xs text-muted-foreground/70">{STATUS_LABEL[c.status]}</span>
              </div>
              {c.purpose && <div className="mt-1 font-body text-xs text-muted-foreground/70">{c.purpose}</div>}
              {c.summary && <p className="mt-1.5 font-body text-sm text-foreground/80">{c.summary}</p>}
              <div className="mt-1.5 font-body text-xs text-muted-foreground/50">{absoluteTime(c.createdAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
