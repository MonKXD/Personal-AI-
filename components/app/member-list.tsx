"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeMember } from "@/app/(app)/settings/actions";
import { absoluteTime } from "@/lib/utils";

export type MemberView = {
  id: string;
  email: string | null;
  name: string;
  joined: string; // ISO
  isOwner: boolean;
  isDemo: boolean;
};

function RemoveButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="icon"
      aria-label={`Remove ${name}`}
      disabled={pending}
      onClick={(e) => {
        if (
          !window.confirm(
            `Remove ${name}? This permanently deletes their account and everything they've captured, and frees a seat. This can't be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}

export function MemberList({ members }: { members: MemberView[] }) {
  const [state, action] = useActionState(removeMember, {});

  useEffect(() => {
    if (state.ok) toast.success("Member removed. A seat is free.");
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border">
      {members.map((m) => (
        <li
          key={m.id}
          className="flex items-center justify-between gap-3 bg-muted p-3.5"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-body text-sm font-medium text-foreground/80">
                {m.email ?? m.name}
              </span>
              {m.isOwner && (
                <span className="rounded-full bg-violet/15 px-1.5 py-0.5 font-body text-[10px] font-semibold text-violet-bright">
                  you
                </span>
              )}
              {m.isDemo && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 font-body text-[10px] font-semibold text-muted-foreground">
                  demo
                </span>
              )}
            </div>
            <div className="font-body text-xs text-muted-foreground/70">
              joined {absoluteTime(m.joined)}
            </div>
          </div>
          {!m.isOwner && !m.isDemo && (
            <form action={action}>
              <input type="hidden" name="userId" value={m.id} />
              <RemoveButton name={m.email ?? m.name} />
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
