"use client";

import * as React from "react";
import {
  Camera,
  CameraOff,
  FileText,
  ImagePlus,
  Link2,
  Mic,
  Square,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProcessingCard } from "@/components/app/processing-card";
import { PrivacyNote } from "@/components/app/privacy-note";
import { uploadCapture, captureUrl, listFolders, type Folder } from "@/lib/api-client";
import { renderPdfFirstPage } from "@/lib/pdf-thumb";
import {
  classifyFileKind,
  prepareImage,
  validateFile,
  FILE_INPUT_ACCEPT,
} from "@/lib/image";
import { cn } from "@/lib/utils";

type PreviewKind = "audio" | "document" | undefined;

type Stage =
  | { kind: "idle" }
  | {
      kind: "preview";
      file: File;
      previewUrl: string;
      fileKind?: PreviewKind;
      width?: number;
      height?: number;
    }
  | { kind: "processing"; captureId: string; thumbUrl?: string | null; fileKind?: PreviewKind };

type Mode = "photo" | "voice" | "link";

const CORNERS = [
  "left-4 top-4 border-l-[2.5px] border-t-[2.5px] rounded-tl-md",
  "right-4 top-4 border-r-[2.5px] border-t-[2.5px] rounded-tr-md",
  "left-4 bottom-4 border-l-[2.5px] border-b-[2.5px] rounded-bl-md",
  "right-4 bottom-4 border-r-[2.5px] border-b-[2.5px] rounded-br-md",
] as const;

/** Turn a getUserMedia DOMException into something a person can act on. */
function cameraErrorMessage(err: DOMException | undefined): string {
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission is blocked. Allow camera access for this site in your browser settings, then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device. You can still upload a photo.";
    case "NotReadableError":
    case "AbortError":
      return "The camera is being used by another app (Zoom, FaceTime…). Close it and try again.";
    default:
      return "Couldn't start the camera. You can still upload a photo.";
  }
}

function ViewfinderCorners() {
  return (
    <>
      {CORNERS.map((c) => (
        <span
          key={c}
          className={cn("pointer-events-none absolute size-7 border-violet", c)}
        />
      ))}
    </>
  );
}

const AUDIO_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  return AUDIO_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function CapturePanel({
  remaining,
  limit,
  initialProcessingId,
  audioSupported = true,
}: {
  remaining: number;
  limit: number;
  initialProcessingId?: string;
  audioSupported?: boolean;
}) {
  const [stage, setStage] = React.useState<Stage>(
    initialProcessingId
      ? { kind: "processing", captureId: initialProcessingId, thumbUrl: null }
      : { kind: "idle" },
  );
  const [mode, setMode] = React.useState<Mode>("photo");
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [camState, setCamState] = React.useState<"off" | "starting" | "on" | "denied">("off");
  const [recState, setRecState] = React.useState<"idle" | "recording" | "denied">("idle");
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [folderId, setFolderId] = React.useState<string>("");
  const [pdfThumb, setPdfThumb] = React.useState<Blob | null>(null);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkBusy, setLinkBusy] = React.useState(false);
  const outOfQuota = remaining <= 0;

  async function submitLink() {
    const url = linkUrl.trim();
    if (!url || outOfQuota || linkBusy) return;
    setLinkBusy(true);
    try {
      const res = await captureUrl(/^https?:\/\//i.test(url) ? url : `https://${url}`);
      if (res.deduped) toast("You've already saved this link.");
      setLinkUrl("");
      setStage({ kind: "processing", captureId: res.id, thumbUrl: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that link.");
    } finally {
      setLinkBusy(false);
    }
  }

  React.useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      listFolders()
        .then((r) => {
          if (!alive) return;
          setFolders(r.folders);
          try {
            const last = localStorage.getItem("mm:lastFolder");
            if (last && r.folders.some((f) => f.id === last)) setFolderId(last);
          } catch {
            /* private mode */
          }
        })
        .catch(() => {});
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const objectUrl = React.useRef<string | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const recChunksRef = React.useRef<Blob[]>([]);
  const recStartRef = React.useRef<number>(0);
  const recTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamState("off");
  }, []);

  const stopRecordingTracks = React.useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = null;
  }, []);

  React.useEffect(() => {
    return () => {
      stopCamera();
      stopRecordingTracks();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, [stopCamera, stopRecordingTracks]);

  async function startCamera() {
    setCamState("starting");

    // Secure-context / browser-support guard: navigator.mediaDevices is
    // undefined on plain http:// (e.g. opening the dev server by LAN IP) and
    // on a few old in-app browsers. getUserMedia would throw a bare TypeError.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      console.warn(
        "[capture] getUserMedia unavailable — insecure context (needs https/localhost) or unsupported browser",
      );
      setCamState("denied");
      toast.error(
        "Live camera needs an https connection and a supported browser. You can still upload a photo.",
      );
      return;
    }

    const acquire = (constraints: MediaStreamConstraints) =>
      navigator.mediaDevices.getUserMedia(constraints);

    try {
      let stream: MediaStream;
      try {
        stream = await acquire({
          video: { facingMode: "environment", width: { ideal: 1920 } },
          audio: false,
        });
      } catch (e) {
        // Some devices reject a facingMode/resolution hint outright instead of
        // just ignoring it — retry once with no constraints (any camera).
        if ((e as DOMException)?.name === "OverconstrainedError") {
          stream = await acquire({ video: true, audio: false });
        } else {
          throw e;
        }
      }
      streamRef.current = stream;
      // The <video> element only mounts once camState is "on", so the stream is
      // attached by the effect below — not here (videoRef.current is still null).
      setCamState("on");
    } catch (e) {
      const err = e as DOMException;
      console.warn("[capture] getUserMedia failed:", err?.name, err?.message);
      setCamState("denied");
      toast.error(cameraErrorMessage(err));
    }
  }

  // Bind the acquired stream once the <video> is actually in the DOM.
  React.useEffect(() => {
    if (camState !== "on") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => {
      /* autoplay can reject if the tab is backgrounded — harmless */
    });
  }, [camState]);

  async function handleFiles(files: FileList | File[]) {
    if (outOfQuota) return;
    const file = Array.from(files)[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) return toast.error(err);

    if (classifyFileKind(file) === "document") {
      stopCamera();
      setStage({ kind: "preview", file, previewUrl: "", fileKind: "document" });
      setPdfThumb(null);
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        renderPdfFirstPage(file).then(setPdfThumb).catch(() => {});
      }
      return;
    }

    setBusy(true);
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
    try {
      // Fast path: downscale in the browser. Falls back to the raw file for
      // formats the canvas can't decode (HEIC on Chrome) — the server handles it.
      const img = await prepareImage(file);
      setStage({
        kind: "preview",
        file: new File([img.blob], img.originalName || "capture.jpg", {
          type: "image/jpeg",
        }),
        previewUrl: img.dataUrl,
        width: img.width,
        height: img.height,
      });
    } catch {
      const url = URL.createObjectURL(file);
      objectUrl.current = url;
      setStage({ kind: "preview", file, previewUrl: url });
    } finally {
      stopCamera();
      setBusy(false);
    }
  }

  async function shoot() {
    const video = videoRef.current;
    if (!video || camState !== "on") return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.92),
    );
    if (!blob) return;
    await handleFiles([
      new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" }),
    ]);
  }

  async function startRecording() {
    if (outOfQuota) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickAudioMime();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        const url = URL.createObjectURL(blob);
        objectUrl.current = url;
        const ext = (recorder.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
        setStage({
          kind: "preview",
          file: new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type }),
          previewUrl: url,
          fileKind: "audio",
        });
        setRecState("idle");
      };
      recorder.start();
      recStartRef.current = Date.now();
      setElapsedMs(0);
      recTimerRef.current = setInterval(() => setElapsedMs(Date.now() - recStartRef.current), 250);
      setRecState("recording");
    } catch {
      setRecState("denied");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    stopRecordingTracks();
  }

  const reset = () => {
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
    setPdfThumb(null);
    setStage({ kind: "idle" });
  };

  async function save() {
    if (stage.kind !== "preview") return;
    setBusy(true);
    try {
      const res = await uploadCapture(stage.file, {
        capturedAt: new Date().toISOString(),
        source: "upload",
        width: stage.width,
        height: stage.height,
        folderId: folderId || null,
        thumbBlob: pdfThumb,
      });
      try {
        if (folderId) localStorage.setItem("mm:lastFolder", folderId);
      } catch {
        /* private mode */
      }
      if (res.deduped) toast("You've already captured this.");
      setStage({
        kind: "processing",
        captureId: res.id,
        thumbUrl: stage.fileKind ? null : stage.previewUrl,
        fileKind: stage.fileKind,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (stage.kind === "processing") {
    return (
      <ProcessingCard
        captureId={stage.captureId}
        thumbUrl={stage.thumbUrl}
        fileKind={stage.fileKind}
        onDiscard={reset}
      />
    );
  }

  return (
    <div>
      {outOfQuota && stage.kind === "idle" && (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          You&rsquo;ve used all {limit} captures for today. The limit resets at
          midnight.
        </div>
      )}

      {stage.kind === "idle" && (
        <div className="mb-5 inline-flex gap-1 rounded-full bg-secondary p-1">
          {(["photo", ...(audioSupported ? (["voice"] as const) : []), "link"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                if (recState === "recording") return;
                stopCamera();
                setMode(m);
              }}
              disabled={recState === "recording"}
              className={cn(
                "rounded-full px-4 py-2 font-body text-[13px] font-semibold capitalize transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground/80",
                recState === "recording" && "opacity-40",
              )}
            >
              {m === "photo" ? (
                <Camera className="mr-1.5 inline size-3.5" />
              ) : m === "voice" ? (
                <Mic className="mr-1.5 inline size-3.5" />
              ) : (
                <Link2 className="mr-1.5 inline size-3.5" />
              )}
              {m}
            </button>
          ))}
        </div>
      )}

      {stage.kind === "preview" ? (
        <div className="animate-fade-in">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
            {stage.fileKind === "audio" ? (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-4 p-8">
                <span className="grid size-16 place-items-center rounded-full bg-violet/12 text-violet-bright">
                  <Mic className="size-7" />
                </span>
                <audio controls src={stage.previewUrl} className="w-full max-w-xs" />
              </div>
            ) : stage.fileKind === "document" ? (
              <div className="relative flex aspect-[4/3] flex-col items-center justify-center gap-4 p-8">
                {pdfThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={URL.createObjectURL(pdfThumb)}
                    alt="PDF first page"
                    className="max-h-full max-w-full rounded object-contain shadow-lg"
                  />
                ) : (
                  <>
                    <span className="grid size-16 place-items-center rounded-full bg-violet/12 text-violet-bright">
                      <FileText className="size-7" />
                    </span>
                    <p className="max-w-xs truncate text-center font-body text-sm text-muted-foreground">
                      {stage.file.name}
                    </p>
                  </>
                )}
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stage.previewUrl}
                alt="Captured preview"
                className="max-h-[60vh] w-full object-contain"
              />
            )}
            <button
              onClick={reset}
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-muted text-foreground backdrop-blur transition-colors hover:bg-accent"
              aria-label="Discard"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-2 font-body text-xs text-muted-foreground/70">
            {stage.width && stage.height
              ? `${stage.width}×${stage.height}px · `
              : ""}
            ready to remember
          </div>
          {folders.length > 0 && (
            <label className="mt-3 flex items-center gap-2 font-body text-xs text-muted-foreground">
              Folder
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="rounded-lg border border-border bg-muted px-2 py-1.5 text-sm text-foreground/80 outline-none focus:border-violet/40"
              >
                <option value="">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={save} disabled={busy} size="lg">
              {busy ? (
                <>
                  <RefreshCw className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Sparkles /> Save to memory
                </>
              )}
            </Button>
            <Button onClick={reset} variant="secondary" size="lg" disabled={busy}>
              <RefreshCw /> Retake
            </Button>
          </div>
        </div>
      ) : mode === "link" ? (
        <div>
          <div
            className={cn(
              "relative flex aspect-[4/3] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-border bg-card px-6 text-center",
              outOfQuota && "opacity-50",
            )}
          >
            <ViewfinderCorners />
            <div className="grid size-12 place-items-center rounded-xl bg-[var(--tint-violet)] text-primary">
              <Link2 className="size-6" />
            </div>
            <p className="font-body text-sm leading-relaxed text-muted-foreground">
              Paste a link to an article, a docs page, or a blog post.
              <br className="hidden sm:block" /> MirrorMind reads it and remembers it.
            </p>
            <div className="flex w-full max-w-md gap-2">
              <input
                type="url"
                inputMode="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitLink()}
                placeholder="https://…"
                disabled={outOfQuota || linkBusy}
                className="min-w-0 flex-1 rounded-md border border-input bg-muted px-3 py-2 font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-violet/40"
              />
              <Button onClick={submitLink} disabled={outOfQuota || linkBusy || !linkUrl.trim()}>
                {linkBusy ? <RefreshCw className="animate-spin" /> : <Sparkles />}
                Save
              </Button>
            </div>
          </div>
          <p className="mt-3 text-center font-body text-xs text-muted-foreground/70 sm:text-left">
            Public pages only. Paywalled or login-only pages won&rsquo;t extract.
          </p>
        </div>
      ) : mode === "voice" ? (
        <div>
          <div
            className={cn(
              "relative flex aspect-[4/3] flex-col items-center justify-center gap-5 overflow-hidden rounded-3xl border-2 border-dashed border-success/35 bg-card",
              outOfQuota && "opacity-50",
            )}
          >
            <ViewfinderCorners />
            <button
              onClick={recState === "recording" ? stopRecording : startRecording}
              disabled={outOfQuota}
              aria-label={recState === "recording" ? "Stop recording" : "Start recording"}
              className={cn(
                "relative grid size-20 place-items-center rounded-full transition-shadow active:scale-95",
                recState === "recording"
                  ? "bg-destructive shadow-[0_0_0_5px_rgba(244,63,94,.18),0_10px_36px_rgba(244,63,94,.5)]"
                  : "bg-[image:var(--brand-grad)] shadow-[0_0_0_5px_color-mix(in srgb,var(--primary) 18%,transparent),0_10px_36px_color-mix(in srgb,var(--primary) 55%,transparent)]",
              )}
            >
              {recState === "recording" && (
                <span className="pointer-events-none absolute -inset-2.5 animate-[ring-pulse_1.4s_ease-out_infinite] rounded-full border border-destructive/40" />
              )}
              {recState === "recording" ? (
                <Square className="size-7 fill-white text-foreground" />
              ) : (
                <Mic className="size-8 text-foreground" strokeWidth={1.8} />
              )}
            </button>
            <div className="font-body text-sm text-muted-foreground">
              {recState === "recording" ? formatElapsed(elapsedMs) : "Tap to record a voice memo"}
            </div>
            {recState === "denied" && (
              <p className="font-body text-xs text-warning">Microphone access was blocked.</p>
            )}
          </div>
          <p className="mt-3 text-center font-body text-xs text-muted-foreground/70 sm:text-left">
            AI transcribes and remembers what you say automatically
          </p>
        </div>
      ) : (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!outOfQuota) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed transition-colors",
              dragging
                ? "border-primary/60 bg-primary/5"
                : "border-primary/35 bg-card",
              outOfQuota && "opacity-50",
            )}
          >
            <ViewfinderCorners />

            {camState === "on" ? (
              <>
                <video ref={videoRef} playsInline muted className="size-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-5 bg-gradient-to-t from-black/60 to-transparent p-5">
                  <button
                    onClick={shoot}
                    aria-label="Take photo"
                    className="relative grid size-[74px] place-items-center rounded-full bg-[image:var(--brand-grad)] shadow-[0_0_0_5px_color-mix(in_srgb,var(--primary)_18%,transparent),0_10px_36px_color-mix(in_srgb,var(--primary)_45%,transparent)] transition-shadow active:scale-95"
                  >
                    <span className="pointer-events-none absolute -inset-2.5 animate-[ring-pulse_2.2s_ease-out_infinite] rounded-full border border-violet/40" />
                    <Camera className="size-7 text-foreground" strokeWidth={1.8} />
                  </button>
                  <button
                    onClick={stopCamera}
                    aria-label="Stop camera"
                    className="grid size-11 place-items-center rounded-full bg-muted text-foreground backdrop-blur transition-colors hover:bg-accent"
                  >
                    <CameraOff className="size-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 px-6 text-center">
                <div className="animate-float-slow grid size-14 place-items-center rounded-2xl bg-[var(--tint-violet)] text-primary">
                  <ImagePlus className="size-6" />
                </div>
                <p className="max-w-xs font-body text-sm font-semibold leading-relaxed text-foreground">
                  Point your camera at a notice, a page, a whiteboard.
                </p>
                <p className="font-body text-[13px] text-muted-foreground">
                  Drop a file here, or use a button below.
                </p>
                {camState === "denied" && (
                  <p className="font-body text-xs text-warning">
                    Camera access was blocked. You can still upload an image.
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="mt-3 text-center font-body text-xs text-muted-foreground/70 sm:text-left">
            AI reads and remembers images, PDFs, and Word/PowerPoint files automatically
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {camState !== "on" && (
              <Button
                onClick={startCamera}
                disabled={camState === "starting" || outOfQuota}
                size="lg"
              >
                {camState === "starting" ? (
                  <>
                    <RefreshCw className="animate-spin" /> Starting…
                  </>
                ) : (
                  <>
                    <Camera /> Capture Now
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
              size="lg"
              disabled={busy || outOfQuota}
            >
              <Upload /> Upload File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={FILE_INPUT_ACCEPT}
              className="sr-only"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
        </div>
      )}

      <PrivacyNote variant="inline" className="mt-5" />
    </div>
  );
}
