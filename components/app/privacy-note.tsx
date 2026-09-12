import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The honest one-liner about the free AI tier. `inline` is a compact helper
 * line (capture screen); `card` is the fuller version (Settings).
 */
export function PrivacyNote({
  variant = "inline",
  className,
}: {
  variant?: "inline" | "card";
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <p className={cn("flex items-start gap-1.5 font-body text-xs text-muted-foreground/70", className)}>
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
        <span>
          Runs on Google&rsquo;s free AI tier during the beta — captures may be used to
          improve their models. Keep anything truly confidential off it for now.
        </span>
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-muted p-4 font-body text-sm text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-foreground/80">
        <ShieldAlert className="size-4 text-muted-foreground" />
        <span className="font-medium">About the AI</span>
      </div>
      <p className="mt-2">
        While MirrorMind is in its free beta it runs on Google&rsquo;s free Gemini
        tier, which means the text of your captures and questions may be used by
        Google to improve their models. Every query is still scoped to your own
        memories, and photographed text is treated as data, never as instructions —
        but don&rsquo;t capture anything genuinely sensitive yet. The paid tier it
        moves to next does not train on your data.
      </p>
      <Link
        href="/privacy"
        className="mt-2 inline-block text-xs text-violet-bright hover:underline"
      >
        Full privacy note →
      </Link>
    </div>
  );
}
