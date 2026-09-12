import Link from "next/link";
import { ConfidenceDot } from "@/components/app/confidence-dot";
import { relativeTime, cn, isImageThumbUrl } from "@/lib/utils";
import { MEMORY_TYPE_META, type MemoryType, type ConfidenceBand } from "@/lib/memory-types";

export type MemoryCardData = {
  id: string;
  type: MemoryType;
  title: string;
  summary: string;
  capturedAt: string | Date;
  ocrConfidence: ConfidenceBand;
  thumbUrl: string | null;
  mime: string;
  tags?: string[];
};

export function MemoryCard({ memory }: { memory: MemoryCardData }) {
  const { icon: Icon } = MEMORY_TYPE_META[memory.type];
  const typeVar = `var(--type-${memory.type})`;

  return (
    <Link
      href={`/memory/${memory.id}`}
      className="group relative flex items-start gap-3.5 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card transition-[border-color,transform,box-shadow] duration-300 ease-[var(--ease-spring)] hover:-translate-y-1 hover:shadow-[var(--shadow-pop)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 active:scale-[0.995] active:duration-100 motion-reduce:transform-none motion-reduce:transition-none"
    >
      {/* type accent bar */}
      <span
        className="absolute inset-y-0 left-0 w-[3px] rounded-r"
        style={{ background: typeVar }}
        aria-hidden
      />

      {/* thumbnail / icon tile */}
      <div
        className="relative size-11 shrink-0 overflow-hidden rounded-xl"
        style={{ background: `color-mix(in oklab, ${typeVar} 16%, transparent)` }}
      >
        {isImageThumbUrl(memory.thumbUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={memory.thumbUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 ease-[var(--ease-spring)] group-hover:scale-110"
          />
        ) : (
          <div className="grid size-full place-items-center" style={{ color: typeVar }}>
            <Icon className="size-5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-display text-[15px] font-semibold tracking-tight text-foreground">
            {memory.title || "Untitled memory"}
          </h3>
          <ConfidenceDot band={memory.ocrConfidence} />
        </div>
        <p className="mt-1 line-clamp-2 font-body text-[13px] leading-relaxed text-muted-foreground">
          {memory.summary}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1">
            {(memory.tags ?? []).slice(0, 2).map((t) => (
              <span
                key={t}
                className="truncate rounded-md px-1.5 py-0.5 font-body text-[11px] font-medium"
                style={{
                  color: typeVar,
                  background: `color-mix(in oklab, ${typeVar} 12%, transparent)`,
                }}
              >
                #{t}
              </span>
            ))}
          </div>
          <span className="shrink-0 font-body text-[12px] text-muted-foreground/70">
            {relativeTime(memory.capturedAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Small inline swatch, used where a full card is too heavy (e.g. citation chips). */
export function TypeSwatch({ type, className }: { type: MemoryType; className?: string }) {
  const { icon: Icon } = MEMORY_TYPE_META[type];
  return (
    <span
      className={cn("grid size-6 shrink-0 place-items-center rounded-md", className)}
      style={{
        color: `var(--type-${type})`,
        background: `color-mix(in oklab, var(--type-${type}) 16%, transparent)`,
      }}
    >
      <Icon className="size-3.5" />
    </span>
  );
}
