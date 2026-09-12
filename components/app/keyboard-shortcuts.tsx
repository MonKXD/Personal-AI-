"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/app/command-palette";

/**
 * Lightweight global shortcuts. Ignored while typing or when a modifier is
 * held. `g` starts a two-key "go to" chord (g t / g f / g y / g c).
 */
export function KeyboardShortcuts() {
  const router = useRouter();

  React.useEffect(() => {
    let chord = false;
    let chordTimer: ReturnType<typeof setTimeout> | undefined;

    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping()) return;

      if (chord) {
        chord = false;
        clearTimeout(chordTimer);
        const dest: Record<string, string> = {
          t: "/timeline",
          f: "/folders",
          y: "/today",
          c: "/chat",
        };
        if (dest[e.key]) {
          e.preventDefault();
          router.push(dest[e.key]);
        }
        return;
      }

      if (e.key === "g") {
        chord = true;
        chordTimer = setTimeout(() => (chord = false), 900);
        return;
      }
      if (e.key === "c") {
        e.preventDefault();
        router.push("/capture");
      } else if (e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(chordTimer);
    };
  }, [router]);

  return null;
}
