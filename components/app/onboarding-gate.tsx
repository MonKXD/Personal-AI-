"use client";

import * as React from "react";
import { SplashScreen } from "@/components/app/splash-screen";
import { OnboardingFlow } from "@/components/app/onboarding-flow";

const STORAGE_KEY = "mm-onboarded";
const SPLASH_MS = 1400;

type Stage = "checking" | "splash" | "onboarding" | "done";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = React.useState<Stage>("checking");

  React.useEffect(() => {
    let cancelled = false;
    let splashTimer: ReturnType<typeof setTimeout> | undefined;

    const check = setTimeout(() => {
      if (cancelled) return;
      let seen = true;
      try {
        seen = window.localStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        /* localStorage unavailable — skip onboarding rather than block the app */
      }
      if (seen) {
        setStage("done");
        return;
      }
      setStage("splash");
      splashTimer = setTimeout(() => {
        if (!cancelled) setStage("onboarding");
      }, SPLASH_MS);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(check);
      clearTimeout(splashTimer);
    };
  }, []);

  const finish = React.useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* best-effort persistence only */
    }
    setStage("done");
  }, []);

  return (
    <>
      {children}
      {stage === "checking" && <div className="bg-background fixed inset-0 z-50" />}
      {stage === "splash" && <SplashScreen />}
      {stage === "onboarding" && <OnboardingFlow onDone={finish} />}
    </>
  );
}
