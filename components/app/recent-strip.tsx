import Link from "next/link";
import { Loader2 } from "lucide-react";
import { MEMORY_TYPE_META, type CaptureStatus, type MemoryType } from "@/lib/memory-types";
import { relativeTime, isImageThumbUrl } from "@/lib/utils";

export type RecentItem = {
  id: string;
  status: CaptureStatus;
  capturedAt: string | Date;
  memoryId: string | null;
  type: MemoryType | null;
  title: string | null;
  thumbUrl: string | null;
  mime: string;
};

export function RecentStrip({ items }: { items: RecentItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Your last captures will show here.
      </p>
    );
  }

  return (
    <ul className="flex gap-3 overflow-x-auto pb-1">
      {items.map((it) => {
        const Icon = it.type ? MEMORY_TYPE_META[it.type].icon : null;
        const pending = it.status !== "ready" && it.status !== "failed";
        const inner = (
          <>
            <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary">
              {isImageThumbUrl(it.thumbUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.thumbUrl} alt="" className="size-full object-cover" />
              ) : null}
              {pending && (
                <div className="absolute inset-0 grid place-items-center bg-background/60">
                  <Loader2 className="size-4 animate-spin text-primary" />
                </div>
              )}
              {it.status === "failed" && (
                <div className="absolute inset-0 grid place-items-center bg-warning/15 text-[0.65rem] font-medium text-warning">
                  failed
                </div>
              )}
              {Icon && (
                <div className="absolute left-1 top-1 grid size-5 place-items-center rounded bg-background/85 text-primary backdrop-blur">
                  <Icon className="size-3" />
                </div>
              )}
            </div>
            <div className="mt-1 line-clamp-1 text-[0.7rem] text-muted-foreground">
              {it.title || relativeTime(it.capturedAt)}
            </div>
          </>
        );
        return (
          <li key={it.id} className="w-24 shrink-0">
            {it.memoryId ? (
              <Link
                href={`/memory/${it.memoryId}`}
                className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {inner}
              </Link>
            ) : (
              <div className="opacity-90">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
