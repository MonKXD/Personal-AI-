"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function send() {
    const message = text.trim();
    if (message.length < 3 || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          page: typeof location !== "undefined" ? location.pathname : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Thanks — sent to the owner.");
      setText("");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>
            Something broken, confusing, or missing? This goes straight to the owner
            with the page you&rsquo;re on.
          </DialogDescription>
        </DialogHeader>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          rows={5}
          placeholder="What happened?"
          className="w-full resize-y rounded-lg border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-violet/40"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={send} disabled={busy || text.trim().length < 3}>
            {busy && <Loader2 className="animate-spin" />} Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
