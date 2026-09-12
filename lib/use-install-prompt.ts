"use client";

import * as React from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Captures the browser's install prompt so a button elsewhere can trigger it.
 * Most browsers only fire this once engagement heuristics are met — the
 * caller should hide its UI entirely until `canInstall` is true. */
export function useInstallPrompt() {
  const deferred = React.useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = React.useState(false);

  React.useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    }
    function onInstalled() {
      deferred.current = null;
      setCanInstall(false);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = React.useCallback(async () => {
    const evt = deferred.current;
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    deferred.current = null;
    setCanInstall(false);
  }, []);

  return { canInstall, promptInstall };
}
