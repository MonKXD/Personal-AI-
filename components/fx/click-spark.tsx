"use client";

import * as React from "react";

/**
 * A quick expanding ring on every primary click. Subtle, ~500ms, auto-cleaned.
 * CSS hides it for reduced-motion / touch.
 */
export function ClickSpark() {
  React.useEffect(() => {
    if (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const dot = document.createElement("span");
      dot.className = "click-spark";
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      document.body.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
      // safety net
      setTimeout(() => dot.remove(), 800);
    };

    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  return null;
}
