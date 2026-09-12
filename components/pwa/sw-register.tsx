"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    // The service worker (public/sw.js) does cache-first for /_next/static/*.
    // In production those URLs are content-hashed, so that's safe and buys
    // offline support. Under `next dev` (Turbopack) chunk URLs are reused
    // across rebuilds, so a cached SW serves stale JS after every edit —
    // "X is not a function", hydration mismatches, an old file picker, etc.
    // So: register only in production; in dev, actively tear down anything a
    // prior production build or dev session left behind.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => {
          if ("caches" in window) {
            return caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
          }
        })
        .catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* best-effort — the app works fine without it */
    });
  }, []);
  return null;
}
