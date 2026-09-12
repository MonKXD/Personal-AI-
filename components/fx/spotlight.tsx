"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A container whose surface lights up under the pointer. Wrap a card/section.
 * Falls back to a static look for touch / reduced-motion.
 */
export function Spotlight({
  children,
  className,
  size = 420,
  strength = 14,
}: {
  children: React.ReactNode;
  className?: string;
  size?: number;
  strength?: number;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
    el.style.setProperty("--spot", "1");
  }
  function onLeave() {
    ref.current?.style.setProperty("--spot", "0");
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn("relative isolate", className)}
      style={
        {
          "--spot": "0",
          "--spot-size": `${size}px`,
          "--spot-strength": String(strength),
        } as React.CSSProperties
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-[calc(var(--spot)*1)] transition-opacity duration-300 motion-reduce:hidden"
        style={{
          background:
            "radial-gradient(var(--spot-size) circle at var(--mx) var(--my), color-mix(in oklab, var(--color-primary) calc(var(--spot-strength) * 1%), transparent), transparent 60%)",
        }}
      />
      {children}
    </div>
  );
}
