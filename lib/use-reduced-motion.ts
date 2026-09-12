"use client";

import * as React from "react";

/**
 * SSR-safe `prefers-reduced-motion` read. `motion`'s own `useReducedMotion`
 * resolves the media query during the *first* client render — before
 * hydration finishes comparing against the server HTML — which throws a
 * hydration-mismatch warning for anyone who actually has reduced motion
 * turned on, whenever the result is used to branch on markup or animation
 * props (as it is in the marketing walkthrough, `Stagger`, and the app
 * route template). This always returns `false` until after mount, matching
 * whatever the server rendered, then updates from a real `matchMedia` read
 * — the same pattern already used for viewport-based branching elsewhere
 * in this codebase (see `FeatureWalkthrough`'s `isMobile`).
 */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return reduce;
}
