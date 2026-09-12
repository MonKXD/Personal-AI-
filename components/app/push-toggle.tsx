"use client";

import * as React from "react";
import { toast } from "sonner";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlB64ToUint8Array(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const s = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushToggle() {
  const [state, setState] = React.useState<"loading" | "off" | "on" | "denied" | "unsupported">(
    "loading",
  );
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        !VAPID ||
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error();
      setState("on");
      toast.success("Push notifications on for this device.");
    } catch {
      toast.error("Couldn't enable push here.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
      toast("Push notifications off.");
    } catch {
      toast.error("Couldn't turn push off.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported") return null;

  return (
    <div className="flex items-center justify-between gap-4 font-body text-sm">
      <span className="text-muted-foreground">
        Push notifications (this device)
        {state === "denied" && (
          <span className="block text-xs text-warning">
            Blocked in your browser — allow notifications for this site, then reload.
          </span>
        )}
      </span>
      <button
        onClick={state === "on" ? disable : enable}
        disabled={busy || state === "loading" || state === "denied"}
        aria-pressed={state === "on"}
        className={
          "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
          (state === "on" ? "bg-primary" : "bg-muted")
        }
      >
        <span
          className={
            "absolute top-0.5 size-5 rounded-full bg-white transition-transform " +
            (state === "on" ? "translate-x-[22px]" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}
