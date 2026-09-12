"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { listWhatsappMessages, setWhatsappFilterRule, type WhatsappMessageItem } from "@/lib/api-client";
import { absoluteTime, cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/empty-state";

const TABS = [
  { key: undefined, label: "All" },
  { key: "important", label: "Important" },
  { key: "deadline", label: "Deadlines" },
  { key: "routine", label: "Routine" },
  { key: "promotional", label: "Promotional" },
  { key: "filtered", label: "Filtered" },
] as const;

const CATEGORY_STYLE: Record<WhatsappMessageItem["category"], string> = {
  important: "bg-warning/15 text-warning",
  deadline: "bg-destructive/15 text-destructive",
  routine: "bg-muted text-muted-foreground",
  promotional: "bg-muted text-muted-foreground/70",
  filtered: "bg-muted text-muted-foreground/50",
};

export function WhatsappView({ initial }: { initial: WhatsappMessageItem[] }) {
  const [category, setCategory] = React.useState<string | undefined>(undefined);
  const [messages, setMessages] = React.useState<WhatsappMessageItem[]>(initial);

  async function selectTab(cat?: string) {
    setCategory(cat);
    try {
      setMessages(await listWhatsappMessages(cat));
    } catch {
      toast.error("Couldn't load messages.");
    }
  }

  async function mute(chatId: string) {
    try {
      await setWhatsappFilterRule(chatId, "mute");
      toast.success("Chat muted.");
    } catch {
      toast.error("Couldn't update filter.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => selectTab(t.key)}
            className={cn(
              "rounded-full px-3 py-1.5 font-body text-xs font-medium transition-colors",
              category === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No messages yet"
          description="Connect the passive WhatsApp listener (docs/modules/whatsapp-triage.md) to start seeing categorized messages here."
        />
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-body text-sm font-medium text-foreground/80">
                    {m.chatName ?? m.chatId}
                  </span>
                  {m.sender && <span className="ml-1.5 font-body text-xs text-muted-foreground/60">{m.sender}</span>}
                </div>
                <span
                  title={m.reason ?? undefined}
                  className={cn("shrink-0 rounded-full px-2 py-0.5 font-body text-[11px] font-semibold", CATEGORY_STYLE[m.category])}
                >
                  {m.category}
                </span>
              </div>
              <p className="mt-1.5 font-body text-sm text-foreground/80">{m.text}</p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-body text-xs text-muted-foreground/50">{absoluteTime(m.occurredAt)}</span>
                <button
                  onClick={() => mute(m.chatId)}
                  className="font-body text-xs text-muted-foreground/70 underline-offset-2 hover:underline"
                >
                  Mute this chat
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
