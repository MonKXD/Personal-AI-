"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    icon: "👁",
    title: "See it once,\nremember forever",
    body: "Point your camera at notices, textbooks, whiteboards — MirrorMind captures and stores everything instantly.",
  },
  {
    icon: "🔍",
    title: "Search your\nvisual memory",
    body: '"What was on the robotics notice?" Ask in plain English and get the exact answer in seconds.',
  },
  {
    icon: "🧠",
    title: "Your memory,\namplified",
    body: "MirrorMind learns what matters to you and surfaces the right memory at the right time.",
  },
  {
    icon: "📸",
    title: "Let's capture\nyour first thing",
    body: "Have a timetable, notice, or textbook page nearby? Snap it now — you'll be asking it questions in under a minute.",
  },
] as const;

export function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [slide, setSlide] = React.useState(0);
  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  const finish = () => {
    onDone();
    router.push("/capture");
  };

  return (
    <div className="bg-cosmic fixed inset-0 z-50 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-1/5 h-[60%]"
        style={{ background: "radial-gradient(ellipse at 50% 0%, color-mix(in srgb,var(--primary) 20%,transparent), transparent 58%)" }}
      />

      <div className="absolute right-6 top-[54px] z-10">
        <button
          onClick={onDone}
          className="rounded-full border border-border bg-muted px-[18px] py-2 font-body text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent"
        >
          Skip
        </button>
      </div>

      <div
        key={slide}
        className="animate-fade-in-up absolute inset-0 flex flex-col items-center justify-center px-9 text-center [animation-duration:0.38s]"
      >
        <div className="mb-[34px] text-[82px] leading-none">{current.icon}</div>
        <div className="mb-[22px] whitespace-pre-line font-display text-[34px] font-bold leading-[1.17] tracking-[-0.03em] text-foreground">
          {current.title}
        </div>
        <div className="max-w-[295px] font-body text-base leading-[1.68] text-muted-foreground">
          {current.body}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-[26px] px-7 pb-[46px]">
        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 shrink-0 rounded-full transition-all duration-300",
                i === slide ? "w-6 bg-violet" : "w-2 bg-muted",
              )}
            />
          ))}
        </div>
        <button
          onClick={() => (isLast ? finish() : setSlide((s) => s + 1))}
          className="w-full max-w-sm rounded-2xl bg-[image:var(--brand-grad)] py-[19px] text-center font-display text-[17px] font-semibold tracking-[-0.01em] text-foreground shadow-[0_8px_32px_color-mix(in srgb,var(--primary) 45%,transparent)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_14px_42px_color-mix(in srgb,var(--primary) 65%,transparent)]"
        >
          {isLast ? "Take my first capture →" : "Continue"}
        </button>
      </div>
    </div>
  );
}
