"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/** Fade/rise a block into view on first scroll intersection. Respects reduced motion. */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: React.ElementType;
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();
  // `intersected` starts false, matching what the server rendered, for
  // every visitor. `shown` derives `reduce` in directly rather than syncing
  // it into state via an effect — reduced-motion users are shown the
  // instant that preference is known post-mount, with no extra render.
  // (This used to read matchMedia synchronously in a lazy useState
  // initializer, which — like `useReducedMotion` itself — returns the real
  // client-side value on the very first client render, before hydration
  // finishes comparing against the server HTML. That's a textbook
  // hydration mismatch: see lib/use-reduced-motion.ts.)
  const [intersected, setIntersected] = React.useState(false);
  const shown = reduce || intersected;

  React.useEffect(() => {
    if (reduce) return; // already shown — nothing to observe
    const el = ref.current;
    if (!el || intersected) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersected(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce, intersected]);

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
