"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertTriangle, FileText, Mic, RefreshCw, Sparkles } from "lucide-react";
import { getCaptureStatus, retryCapture } from "@/lib/api-client";
import { PIPELINE_STEPS, type CaptureStatus } from "@/lib/memory-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ORDER: Record<CaptureStatus, number> = {
  queued: 0,
  extracting: 1,
  embedding: 2,
  ready: 3,
  failed: -1,
};

const ERROR_COPY: Record<string, string> = {
  model_busy:
    "The AI model is busy right now (free-tier capacity). Wait a minute, then retry.",
  vision_unavailable: "The reader couldn't process this. Try again in a moment.",
  embeddings_unavailable: "Couldn't build the memory index. Try again.",
  file_unavailable: "The uploaded file couldn't be read back.",
  document_unreadable: "Couldn't read that document. It may be corrupted or password-protected.",
  pipeline_error: "Something went wrong while remembering this.",
};

export function ProcessingCard({
  captureId,
  thumbUrl,
  fileKind,
  onDiscard,
}: {
  captureId: string;
  thumbUrl?: string | null;
  fileKind?: "audio" | "document";
  onDiscard: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<CaptureStatus>("queued");
  const [errorCode, setErrorCode] = React.useState<string | null>(null);
  const [errorDetail, setErrorDetail] = React.useState<string | null>(null);
  const [retrying, setRetrying] = React.useState(false);
  const startedAt = React.useRef<number | null>(null);
  const [stalled, setStalled] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    if (startedAt.current === null) startedAt.current = Date.now();

    const poll = async () => {
      try {
        const s = await getCaptureStatus(captureId);
        if (!alive) return;
        setStatus(s.status);
        setErrorCode(s.errorCode);
        setErrorDetail(s.errorDetail);
        if (s.status === "ready" && s.memoryId) {
          router.push(`/memory/${s.memoryId}`);
          router.refresh();
          return;
        }
        if (s.status === "failed") return;
        if (Date.now() - (startedAt.current ?? Date.now()) > 90_000) {
          setStalled(true);
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      timer = setTimeout(poll, 1500);
    };

    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [captureId, router]);

  async function doRetry() {
    setRetrying(true);
    try {
      await retryCapture(captureId);
      startedAt.current = Date.now();
      setStalled(false);
      setStatus("queued");
      setErrorCode(null);
      setErrorDetail(null);
    } catch {
      /* surfaced below */
    } finally {
      setRetrying(false);
    }
  }

  const failed = status === "failed" || stalled;
  const active = ORDER[status] ?? 0;

  return (
    <div className="rounded-3xl border border-border bg-muted p-4 sm:p-6">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-muted">
        {fileKind === "audio" || fileKind === "document" ? (
          <div
            className={cn(
              "grid size-full place-items-center transition-opacity duration-500",
              failed ? "opacity-40" : "opacity-90",
            )}
          >
            <span className="grid size-16 place-items-center rounded-full bg-violet/12 text-violet-bright">
              {fileKind === "audio" ? <Mic className="size-7" /> : <FileText className="size-7" />}
            </span>
          </div>
        ) : (
          thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt=""
              className={cn(
                "size-full object-cover transition-[filter,opacity] duration-500",
                failed ? "opacity-40 grayscale" : "opacity-90",
              )}
            />
          )
        )}
        {!failed && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="animate-scan-line absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-violet-bright to-transparent shadow-[0_0_14px_color-mix(in srgb,var(--primary) 90%,transparent),0_0_28px_color-mix(in srgb,var(--primary) 45%,transparent)]" />
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center">
              <span className="inline-flex items-center gap-2 rounded-xl border border-violet/40 bg-background/82 px-5 py-2.5 font-display text-sm font-semibold text-foreground backdrop-blur-md">
                <Sparkles className="size-3.5 text-violet-bright" />
                {fileKind === "audio" && status === "extracting"
                  ? "Listening"
                  : fileKind === "document" && status === "extracting"
                    ? "Reading"
                    : (PIPELINE_STEPS[Math.max(active, 0)]?.label ?? "Remembering")}…
              </span>
            </div>
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 grid place-items-center">
            <AlertTriangle className="size-8 text-warning/70" />
          </div>
        )}
      </div>

      {failed ? (
        <div className="mt-4">
          <div className="flex items-center gap-2 font-display font-semibold text-warning">
            {stalled ? "This is taking too long" : "Couldn't read this clearly"}
          </div>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            {ERROR_COPY[errorCode ?? ""] ?? ERROR_COPY.pipeline_error}
          </p>
          {errorDetail && (
            <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 font-mono text-[0.7rem] text-muted-foreground">
              {errorDetail}
            </pre>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={doRetry} disabled={retrying}>
              {retrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={onDiscard}>
              Discard
            </Button>
          </div>
        </div>
      ) : (
        <ol className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          {PIPELINE_STEPS.map((step, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <li key={step.key} className="flex items-center gap-2 font-body text-[13px]">
                <span
                  className={cn(
                    "grid size-4.5 place-items-center rounded-full border",
                    done && "border-success bg-success text-success-foreground",
                    current && "border-violet text-violet-bright",
                    !done && !current && "border-border text-muted-foreground/70",
                  )}
                >
                  {done ? (
                    <Check className="size-2.5" />
                  ) : current ? (
                    <Loader2 className="size-2.5 animate-spin" />
                  ) : (
                    <span className="size-1 rounded-full bg-current" />
                  )}
                </span>
                <span className={cn(done || current ? "text-foreground/80" : "text-muted-foreground/70")}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
