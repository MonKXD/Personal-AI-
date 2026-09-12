import Link from "next/link";
import {
  Camera,
  Mic,
  FileText,
  Link2,
  Sparkles,
  ArrowRight,
  Brain,
  MessagesSquare,
  Clock,
  Layers,
  FolderTree,
  ShieldCheck,
  BellRing,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { AskPreview } from "@/components/marketing/ask-preview";
import { FeatureWalkthrough } from "@/components/marketing/feature-walkthrough";
import { Magnetic } from "@/components/fx/magnetic";

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-cosmic relative overflow-hidden">
        <div className="container-px mx-auto grid max-w-6xl items-center gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:py-24">
          <div className="animate-fade-in-up">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-[var(--tint-violet)] px-3.5 py-1.5 text-xs font-semibold tracking-wide text-primary">
              <Sparkles className="size-3" /> A memory for the physical world
            </span>
            <h1 className="max-w-[620px] text-balance text-[2.5rem] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]">
              You saw it once.
              <br />
              <span className="text-gradient">Remember it forever.</span>
            </h1>
            <p className="mt-5 max-w-[520px] text-pretty text-[1.05rem] leading-relaxed text-muted-foreground">
              Point your camera at a notice, timetable, or textbook page — or drop in a
              PDF, slide deck, or voice note. Personal AI reads it, files it, and answers
              your questions later, with the original as proof.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Magnetic>
                <Button asChild size="lg" className="group">
                  <Link href="/sign-in">
                    Start remembering
                    <ArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </Magnetic>
              <Button asChild size="lg" variant="secondary">
                <Link href="/#walkthrough">See how it works</Link>
              </Button>
            </div>
            <p className="mt-5 text-[13px] text-muted-foreground">
              Free in beta · no card · works on your phone as an app
            </p>
          </div>

          <Reveal className="flex justify-center lg:justify-end">
            <HeroOrbit />
          </Reveal>
        </div>

        {/* Capture-types strip */}
        <div className="container-px mx-auto max-w-6xl pb-16">
          <div className="flex flex-wrap items-center justify-center gap-3.5">
            {[
              { icon: Camera, label: "Photo" },
              { icon: Mic, label: "Voice" },
              { icon: FileText, label: "Document" },
              { icon: Link2, label: "Link" },
            ].map(({ icon: Icon, label }, i) => (
              <span
                key={label}
                className="animate-float inline-flex items-center gap-2 rounded-full border border-border bg-card px-[1.125rem] py-2.5 text-[13px] shadow-card"
                style={{ animationDelay: `${i}s` }}
              >
                <Icon className="size-3.5 text-primary" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it becomes memory */}
      <section id="how" className="scroll-mt-16 border-t border-border">
        <div className="container-px mx-auto max-w-5xl py-20 lg:py-24">
          <Reveal>
            <h2 className="text-center text-[1.75rem] font-semibold tracking-tight sm:text-3xl">
              How it becomes memory
            </h2>
            <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">
              Three quiet steps between something you saw and something you can ask about.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-7 sm:grid-cols-3">
            {[
              {
                icon: Camera,
                tint: "var(--tint-violet)",
                title: "Capture",
                body: "A photo, a voice note, a PDF, a link — dropped in as easily as it happened.",
              },
              {
                icon: Brain,
                tint: "var(--tint-teal)",
                title: "Understand",
                body: "Classified, read for entities and deadlines, then chunked into a searchable memory.",
              },
              {
                icon: MessagesSquare,
                tint: "var(--tint-violet)",
                title: "Ask",
                body: "Ask in plain language. Every answer links back to the exact memory it came from.",
              },
            ].map((s, i) => (
              <Reveal key={s.title} delay={i * 70}>
                <div className="h-full rounded-xl border border-border bg-card p-7 shadow-card transition-transform duration-200 hover:-translate-y-1">
                  <div
                    className="mb-4 grid size-10 place-items-center rounded-xl"
                    style={{ background: s.tint }}
                  >
                    <s.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Animated walkthrough — scroll-scrubbed on desktop, autoplay loop on mobile */}
      <section id="walkthrough" className="scroll-mt-16 border-t border-border">
        <div className="container-px mx-auto max-w-6xl pt-16 lg:pt-20">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              The whole app, in six moves
            </p>
            <h2 className="mt-3 text-[1.75rem] font-semibold tracking-tight sm:text-3xl">
              Capture → read → recall
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Scroll through the loop. On a phone it plays on its own — tap to pause.
            </p>
          </Reveal>
        </div>
        <div className="mt-4 lg:mt-0">
          <FeatureWalkthrough />
        </div>
      </section>

      {/* Pull-quote */}
      <section className="bg-[var(--tint-teal)] px-6 py-16 text-center">
        <Reveal>
          <p className="mx-auto max-w-2xl font-display text-2xl font-semibold leading-snug text-success-foreground/90 dark:text-success">
            &ldquo;Not another inbox. A memory that answers back — and always shows its
            work.&rdquo;
          </p>
        </Reveal>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-t border-border">
        <div className="container-px mx-auto max-w-6xl py-20 lg:py-24">
          <Reveal>
            <h2 className="text-[1.75rem] font-semibold tracking-tight sm:text-3xl">
              Built like a memory, not a folder
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Clock, title: "Time-aware recall", body: "“The notice I saw this morning” resolves to the right day and hour." },
              { icon: Layers, title: "Structured extraction", body: "Timetables become schedules. Notices become dates and deadlines. Circuits become component lists." },
              { icon: MessagesSquare, title: "Multi-source answers", body: "One question can combine a timetable, a circular, and a textbook page into a single reply." },
              { icon: FolderTree, title: "Folders that file themselves", body: "Nestable folders, an AI-suggested home for each capture, and an Unfiled bucket that never loses anything." },
              { icon: ShieldCheck, title: "Cited, or it says so", body: "Every answer links the captures it used. No memory of something? It tells you plainly." },
              { icon: BellRing, title: "Deadlines & weekly recap", body: "Dates it reads become reminders; a recap of everything you captured lands each week." },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 55}>
                <div className="h-full rounded-xl border border-border bg-card p-6 shadow-card">
                  <f.icon className="size-5 text-primary" />
                  <h3 className="mt-3 font-display font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border">
        <div className="container-px mx-auto max-w-3xl py-20 lg:py-24">
          <Reveal>
            <h2 className="text-[1.75rem] font-semibold tracking-tight sm:text-3xl">
              Questions, answered
            </h2>
          </Reveal>
          <div className="mt-10 divide-y divide-border border-y border-border">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 40}>
                <details className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-[15px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <Plus className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45" />
                  </summary>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-px mx-auto max-w-5xl pb-24 pt-4">
        <Reveal>
          <div className="bg-cosmic overflow-hidden rounded-2xl border border-border px-8 py-14 text-center shadow-pop sm:px-16">
            <h2 className="mx-auto max-w-2xl text-balance text-[1.75rem] font-semibold tracking-tight sm:text-3xl">
              Give your memory a search bar
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Capture your first notice or timetable in under a minute.
            </p>
            <div className="mt-8 flex justify-center">
              <Magnetic>
                <Button asChild size="lg" className="group">
                  <Link href="/sign-in">
                    <Camera className="size-4" />
                    Start remembering
                    <ArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </Magnetic>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

/** Landing hero: the floating answer card inside two slow orbital rings and a
 * pulsing bloom. Decorative — the rings and bloom are aria-hidden. */
function HeroOrbit() {
  return (
    <div className="relative flex h-[440px] w-full items-center justify-center sm:h-[520px]">
      <div
        aria-hidden
        className="animate-bloom-pulse pointer-events-none absolute left-1/2 top-[44%] size-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[10px]"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--violet) 42%, transparent), color-mix(in srgb, var(--success) 22%, transparent) 60%, transparent 75%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[44%] size-px">
        <div className="animate-orbit-a absolute left-1/2 top-1/2 size-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-primary/30">
          <span className="absolute left-1/2 top-[-6px] size-3 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_12px_var(--violet)]" />
        </div>
        <div className="animate-orbit-b absolute left-1/2 top-1/2 size-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-success/30">
          <span className="absolute left-1/2 top-[-5px] size-2.5 -translate-x-1/2 rounded-full bg-success shadow-[0_0_10px_var(--success)]" />
        </div>
      </div>
      <div className="animate-float relative w-[min(420px,92%)]">
        <AskPreview />
      </div>
    </div>
  );
}

const FAQ: { q: string; a: string }[] = [
  {
    q: "What can it actually read?",
    a: "Photos of notices, timetables, textbook pages, whiteboards, circuit diagrams, handwritten notes and slides — plus uploaded PDFs, Word documents, PowerPoint decks, and voice notes. It transcribes everything and pulls out the dates, rooms, deadlines and key terms.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Personal AI is a web app you can install to your home screen — open it in your phone's browser and choose “Add to Home Screen”. No app store, and you can capture straight from the camera or share a file into it.",
  },
  {
    q: "Is my data private?",
    a: "Every query only ever sees your own memories, and text you photograph is treated as data, never as instructions. One honest caveat: during the beta it runs on Google's free AI tier, where prompts and results may be used to improve Google's models — so don't put genuinely confidential material in yet. The paid tier it moves to next does not train on your data.",
  },
  {
    q: "What happens when I hit 15 captures in a day?",
    a: "Captures pause until midnight IST, then reset. It's a beta guardrail to stay inside the free AI quota with a small group of users — the Pro tier lifts it.",
  },
  {
    q: "Can I get my data out?",
    a: "Yes — there's a full export of your memories and their extracted text from Settings, any time.",
  },
  {
    q: "Why is sign-up sometimes closed?",
    a: "The beta is capped at ten people so it stays comfortably inside the free infrastructure. If it's full, new spots open when someone leaves — or ask the owner directly.",
  },
];
