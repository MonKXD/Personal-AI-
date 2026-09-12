"use client";

import * as React from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The captured image, click to open full-screen. In the overlay: click the
 * image to toggle 2.5× zoom, drag to pan when zoomed, Esc / click-outside /
 * the ✕ to close. Native pinch-zoom also works inside the overlay on touch.
 */
export function ImageLightbox({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = React.useState(false);
  const [zoomed, setZoomed] = React.useState(false);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const drag = React.useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    setZoomed(false);
    setPan({ x: 0, y: 0 });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block w-full cursor-zoom-in"
        aria-label="Open image full screen"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-[76vh] w-full object-contain transition-opacity group-hover:opacity-95"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={close}
        >
          <div className="absolute right-3 top-3 flex gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-white/10 text-white/80">
              {zoomed ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
              className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div
            className="max-h-[92vh] max-w-[94vw] overflow-hidden"
            style={{ touchAction: "pinch-zoom" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              draggable={false}
              onClick={() => {
                setZoomed((z) => !z);
                setPan({ x: 0, y: 0 });
              }}
              onPointerDown={(e) => {
                if (!zoomed) return;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                setPan({
                  x: drag.current.px + (e.clientX - drag.current.x),
                  y: drag.current.py + (e.clientY - drag.current.y),
                });
              }}
              onPointerUp={() => (drag.current = null)}
              className={cn(
                "max-h-[92vh] max-w-[94vw] object-contain transition-transform duration-200 select-none",
                zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
              )}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomed ? 2.5 : 1})`,
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
