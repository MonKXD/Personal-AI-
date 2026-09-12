"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Route-level entrance. `template.tsx` re-mounts on every navigation, so each
 * page rises 8px + fades in on a soft spring. Reduced-motion users get an
 * instant, static render.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
