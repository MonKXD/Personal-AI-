"use client";

import * as React from "react";
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import {
  Camera,
  ScanText,
  LayoutGrid,
  FolderTree,
  MessagesSquare,
  Clock3,
  Wallet,
  BellRing,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  caption: string;
  render: () => React.ReactNode;
};

/* ---------------------------------------------------------------- frames -- */

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card shadow-pop">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
        </span>
        <span className="ml-1 font-body text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Row({
  color,
  title,
  meta,
  tag,
}: {
  color: string;
  title: string;
  meta: string;
  tag?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-2.5">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
        style={{ background: color }}
      >
        ▦
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-foreground">{title}</div>
        <div className="mt-0.5 font-body text-[10px] text-muted-foreground">{meta}</div>
      </div>
      {tag && (
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-body text-[10px] font-semibold text-accent-foreground">
          {tag}
        </span>
      )}
    </div>
  );
}

const V = {
  grape: "#4a3f8f",
  teal: "#3f8f82",
  notice: "#a3432f",
  amber: "#c78a2e",
} as const;

const STEPS: Step[] = [
  {
    key: "capture",
    icon: Camera,
    title: "Capture it",
    caption:
      "Snap a photo, upload a PDF or slide deck, or record a voice note. Two taps — no typing, no filing.",
    render: () => (
      <Frame label="Capture">
        <div className="grid place-items-center gap-3 py-6">
          <div className="grid size-16 place-items-center rounded-2xl bg-[image:var(--brand-grad)] text-white shadow-[0_10px_36px_color-mix(in_srgb,var(--primary)_40%,transparent)]">
            <Camera className="size-7" />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Photo · PDF · Word · PowerPoint · Voice
          </p>
        </div>
      </Frame>
    ),
  },
  {
    key: "read",
    icon: ScanText,
    title: "It reads everything",
    caption:
      "Personal AI transcribes every word, detects what it's looking at, and pulls out dates, rooms, deadlines and key terms.",
    render: () => (
      <Frame label="Understanding">
        <div className="space-y-2.5">
          <div className="h-2 w-3/4 rounded bg-muted-foreground/20" />
          <div className="h-2 w-full rounded bg-muted-foreground/15" />
          <div className="h-2 w-5/6 rounded bg-muted-foreground/15" />
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            {["Mon 15:00", "Room Lab-5", "RC circuits", "Ch. 27"].map((e) => (
              <span
                key={e}
                className="rounded-md bg-accent px-2 py-0.5 font-body text-[10px] font-semibold text-accent-foreground"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      </Frame>
    ),
  },
  {
    key: "timeline",
    icon: LayoutGrid,
    title: "Everything, on one timeline",
    caption:
      "Each capture becomes a clean card — newest first, searchable by any word in it, the original always one tap away.",
    render: () => (
      <Frame label="Timeline">
        <div className="space-y-2">
          <Row color={V.grape} title="Time Table (revised)" meta="timetable · 2 days ago" tag="College" />
          <Row color={V.teal} title="Physics — RC Circuits (Ch. 27)" meta="textbook page · 4 days ago" tag="Physics" />
          <Row color={V.notice} title="Microcontrollers Paper" meta="notice · code 40822" tag="Exams" />
        </div>
      </Frame>
    ),
  },
  {
    key: "folders",
    icon: FolderTree,
    title: "Filed the way you think",
    caption:
      "Drop memories into nestable folders — or let the AI suggest one. Colour and tag them so it looks like your memory.",
    render: () => (
      <Frame label="Folders">
        <div className="space-y-1.5 font-body text-[12px]">
          {[
            ["📁 College", 0, "#4a3f8f"],
            ["📐 Physics", 1, "#3f8f82"],
            ["🧪 Lab reports", 2, "#3f8f82"],
            ["📣 Exams", 1, "#a3432f"],
            ["🗂 Unfiled", 0, "var(--muted-foreground)"],
          ].map(([label, depth, color]) => (
            <div
              key={label as string}
              className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-1.5"
              style={{ marginLeft: (depth as number) * 16 }}
            >
              <span className="size-2 rounded-sm" style={{ background: color as string }} />
              <span className="text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </Frame>
    ),
  },
  {
    key: "ask",
    icon: MessagesSquare,
    title: "Ask in plain language",
    caption:
      "“When's my Physics lab?” Answers are time- and type-aware, cite the captures they used, and flag what changed.",
    render: () => (
      <Frame label="Chat">
        <div className="space-y-3">
          <div className="ml-auto w-fit max-w-[85%] rounded-[14px] rounded-br-[4px] bg-primary px-3.5 py-2.5 text-[12.5px] text-primary-foreground">
            When and where is my Physics lab?
          </div>
          <p className="text-[13px] leading-relaxed text-foreground">
            Mondays <b>15:00–17:00 in Room Lab-5</b>.{" "}
            <span className="rounded bg-highlight px-1 font-semibold text-highlight-foreground">
              Changed
            </span>{" "}
            — your 20 Aug timetable moved it from 14:00–16:00 in Lab-3.
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 font-body text-[10px] font-semibold text-accent-foreground">
            ▦ time table (revised)
          </span>
        </div>
      </Frame>
    ),
  },
  {
    key: "deadlines",
    icon: Clock3,
    title: "One deadline list, from everywhere",
    caption:
      "Add one yourself, or let WhatsApp and calls feed it automatically once connected — sorted soonest-first, color-coded by how urgent it is.",
    render: () => (
      <Frame label="Deadlines">
        <div className="space-y-2">
          <Row color={V.notice} title="Submit assignment" meta="Due today · urgent" tag="Manual" />
          <Row color={V.amber} title="Pay rent" meta="Due in 3 days" tag="WhatsApp" />
          <Row color={V.teal} title="Dentist appointment" meta="Due next week" tag="Call" />
        </div>
      </Frame>
    ),
  },
  {
    key: "finance",
    icon: Wallet,
    title: "Know where your money goes",
    caption:
      "Log an expense in two taps, or upload a bank statement — Personal AI categorizes every row and tracks it by month.",
    render: () => (
      <Frame label="Finance">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="font-body text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              This month
            </span>
            <span className="font-display text-lg font-bold text-foreground">₹12,450</span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Food", amount: "3,200", pct: 68, color: V.notice },
              { label: "Travel", amount: "2,100", pct: 45, color: V.amber },
              { label: "Subscriptions", amount: "899", pct: 20, color: V.teal },
            ].map((c) => (
              <div key={c.label}>
                <div className="mb-1 flex items-center justify-between font-body text-[11px]">
                  <span className="font-medium text-foreground">{c.label}</span>
                  <span className="text-muted-foreground">₹{c.amount}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${c.pct}%`, background: c.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Frame>
    ),
  },
  {
    key: "remind",
    icon: BellRing,
    title: "It nudges you in time",
    caption:
      "Due-soon deadlines become reminders. A weekly recap of everything you captured, spent, and have coming up lands every Sunday.",
    render: () => (
      <Frame label="Today">
        <div className="space-y-2">
          <div className="flex items-start gap-2.5 rounded-xl border border-highlight/40 bg-highlight/10 p-3">
            <BellRing className="mt-0.5 size-4 shrink-0 text-highlight" />
            <div>
              <div className="text-[13px] font-semibold text-foreground">Due in 2 days</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Microcontrollers paper — form deadline Wed 5 PM
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">7 captured</span> this week ·
            weekly recap ready
          </div>
        </div>
      </Frame>
    ),
  },
];

/* ------------------------------------------------------------- component -- */

export function FeatureWalkthrough() {
  const reduce = useReducedMotion();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  if (reduce) return <StaticList />;
  if (isMobile) return <MobileLoop />;
  return <ScrollScrub />;
}

/* --- desktop: scroll scrubs the active frame ------------------------------ */

function ScrollScrub() {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(0);
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const i = Math.min(STEPS.length - 1, Math.max(0, Math.floor(p * STEPS.length)));
    setActive(i);
  });

  return (
    <div ref={wrapRef} style={{ height: `${STEPS.length * 90}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen items-center">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* step list */}
          <ol className="space-y-1.5">
            {STEPS.map((s, i) => {
              const on = i === active;
              return (
                <li key={s.key}>
                  <div
                    className={cn(
                      "flex gap-4 rounded-xl border p-4 transition-colors duration-300",
                      on ? "border-border bg-card" : "border-transparent",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-300",
                        on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <s.icon className="size-4" />
                    </span>
                    <div>
                      <div
                        className={cn(
                          "font-display text-[15px] font-semibold transition-colors",
                          on ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {s.title}
                      </div>
                      <AnimatePresence initial={false}>
                        {on && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden text-[13px] leading-relaxed text-muted-foreground"
                          >
                            <span className="block pt-1.5">{s.caption}</span>
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* frame */}
          <div className="relative min-h-[300px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={STEPS[active].key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                {STEPS[active].render()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- mobile: silent autoplay loop, tap to pause ------------------------- */

function MobileLoop() {
  const [i, setI] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % STEPS.length), 3500);
    return () => window.clearInterval(t);
  }, [paused]);

  const s = STEPS[i];
  return (
    <div className="mx-auto max-w-md px-1">
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        className="block w-full text-left"
        aria-label={paused ? "Resume walkthrough" : "Pause walkthrough"}
      >
        <div className="relative min-h-[240px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {s.render()}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-4 flex gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <s.icon className="size-4" />
          </span>
          <div>
            <div className="font-display text-[15px] font-semibold text-foreground">{s.title}</div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{s.caption}</p>
          </div>
        </div>
      </button>
      <div className="mt-4 flex justify-center gap-1.5">
        {STEPS.map((st, n) => (
          <button
            key={st.key}
            type="button"
            aria-label={`Go to ${st.title}`}
            onClick={() => {
              setI(n);
              setPaused(true);
            }}
            className={cn(
              "h-1.5 rounded-full transition-all",
              n === i ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* --- reduced motion: everything visible, stacked ----------------------- */

function StaticList() {
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      {STEPS.map((s) => (
        <div key={s.key}>
          <div className="mb-3 flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <s.icon className="size-4" />
            </span>
            <div>
              <div className="font-display text-[15px] font-semibold text-foreground">{s.title}</div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{s.caption}</p>
            </div>
          </div>
          {s.render()}
        </div>
      ))}
    </div>
  );
}
