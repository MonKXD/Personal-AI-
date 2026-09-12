"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Fades + rises children in sequence on mount. Use for grids/lists.
 * Wrap the container in <Stagger> and each child in <StaggerItem>.
 *
 * Note: these are separate named exports (not `Stagger.Item`) because a
 * compound component's static property is lost across the RSC boundary.
 *
 * `ref` is forwarded to the container so callers can layer on a
 * mutation animation (e.g. auto-animate) for items added/removed after
 * mount — the mount stagger and the mutation animation don't overlap.
 */
export function Stagger({
  children,
  className,
  step = 0.045,
  ref,
}: {
  children: React.ReactNode;
  className?: string;
  step?: number;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: reduce ? 0 : step } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: reduce ? 0 : 14 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
