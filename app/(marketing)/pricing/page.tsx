import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Personal AI is free while it's in a small private beta. Pro and Teams are on the way.",
};

type Cell = boolean | string;

const TIERS = [
  { name: "Free", tagline: "The whole app, today.", price: "₹0", cadence: "while in beta", cta: "Get started", href: "/sign-in", featured: true, soon: false },
  { name: "Pro", tagline: "For everyday use.", price: "Coming soon", cadence: "", cta: "Coming soon", href: "/sign-in", featured: false, soon: true },
  { name: "Teams", tagline: "Shared memory for a class or team.", price: "Coming soon", cadence: "", cta: "Coming soon", href: "/sign-in", featured: false, soon: true },
] as const;

const ROWS: { label: string; values: [Cell, Cell, Cell] }[] = [
  { label: "Captures per day", values: ["15", "Unlimited", "Unlimited"] },
  { label: "Questions per hour", values: ["40", "Unlimited", "Unlimited"] },
  { label: "Photo, PDF, Word, PowerPoint, voice", values: [true, true, true] },
  { label: "Folders, full-text search, citations", values: [true, true, true] },
  { label: "Conflict-aware answers & reminders", values: [true, true, true] },
  { label: "Full history & export", values: [true, true, true] },
  { label: "Priority AI — paid model, no training on your data", values: [false, true, true] },
  { label: "Shared team spaces & roles", values: [false, false, true] },
  { label: "Support", values: ["Community", "Email", "Priority"] },
];

function CellView({ v }: { v: Cell }) {
  if (v === true) return <Check className="mx-auto size-4 text-success" aria-label="Included" />;
  if (v === false)
    return <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="Not included" />;
  return <span className="text-sm text-foreground">{v}</span>;
}

export default function PricingPage() {
  return (
    <div className="container-px mx-auto max-w-5xl py-20 lg:py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Pricing
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Free while it&rsquo;s small</h1>
          <p className="mt-3 text-muted-foreground">
            Personal AI is in a private beta capped at a handful of people, so the whole
            app is free right now. Pro and Teams are being built — the shape below is
            what they&rsquo;ll cover.
          </p>
        </div>
      </Reveal>

      {/* tier headers */}
      <Reveal delay={60}>
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={
                "flex flex-col rounded-xl border bg-card p-6 shadow-card " +
                (t.featured ? "border-primary ring-1 ring-primary" : "border-border")
              }
            >
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-semibold">{t.name}</h2>
                {t.featured && <Badge>Available now</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span
                  className={
                    "font-display font-semibold tracking-tight " +
                    (t.soon ? "text-lg text-muted-foreground" : "text-3xl")
                  }
                >
                  {t.price}
                </span>
                {t.cadence && (
                  <span className="text-xs text-muted-foreground">{t.cadence}</span>
                )}
              </div>
              <Button
                asChild={!t.soon}
                disabled={t.soon}
                className="mt-5"
                variant={t.featured ? "default" : "secondary"}
              >
                {t.soon ? <span>{t.cta}</span> : <Link href={t.href}>{t.cta}</Link>}
              </Button>
            </div>
          ))}
        </div>
      </Reveal>

      {/* comparison table */}
      <Reveal delay={100}>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="w-[46%] pb-3 pl-1 font-normal">Feature</th>
                {TIERS.map((t) => (
                  <th key={t.name} className="pb-3 text-center font-normal">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label}>
                  <td className="border-t border-border py-3 pl-1 pr-4 text-sm text-muted-foreground">
                    {r.label}
                  </td>
                  {r.values.map((v, i) => (
                    <td key={i} className="border-t border-border py-3 text-center">
                      <CellView v={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        On the free AI tier, prompts and results may be used by the model provider to
        improve their models. Pro moves to a paid model that doesn&rsquo;t train on your
        data. See the{" "}
        <Link href="/privacy" className="underline hover:text-foreground">
          privacy note
        </Link>
        .
      </p>
    </div>
  );
}
