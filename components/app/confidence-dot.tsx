import { cn } from "@/lib/utils";
import type { ConfidenceBand } from "@/lib/memory-types";

const MAP: Record<ConfidenceBand, { color: string; label: string }> = {
  high: { color: "bg-success", label: "High confidence" },
  medium: { color: "bg-warning", label: "Some words uncertain" },
  low: { color: "bg-muted-foreground", label: "Low confidence" },
};

export function ConfidenceDot({
  band,
  withLabel = false,
  className,
}: {
  band: ConfidenceBand;
  withLabel?: boolean;
  className?: string;
}) {
  const { color, label } = MAP[band];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn("size-2 rounded-full", color)}
        aria-hidden
      />
      <span className={cn(withLabel ? "text-xs text-muted-foreground" : "sr-only")}>
        {label}
      </span>
    </span>
  );
}
