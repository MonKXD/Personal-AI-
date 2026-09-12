import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const QUOTES = [
  {
    q: "What was written on the robotics club notice I saw this morning?",
    a: "Answered from a photo you took at 9:14 AM.",
  },
  {
    q: "When's my next Physics lab, and what's it on?",
    a: "Cross-referenced from your timetable and a textbook page.",
  },
  {
    q: "Anything due this week?",
    a: "Two deadlines, pulled from a circular and a whiteboard.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pick = QUOTES[new Date().getUTCHours() % QUOTES.length];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="flex flex-col justify-between p-6 sm:p-10">
        <Logo />
        <main className="mx-auto w-full max-w-sm py-12">{children}</main>
        <p className="text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-border bg-secondary lg:block">
        <div className="bg-cosmic absolute inset-0 opacity-80" />
        <div className="relative flex h-full flex-col justify-center gap-6 p-14">
          <div className="text-sm font-semibold text-primary">Ask your memory</div>
          <blockquote className="font-display text-2xl font-semibold leading-snug tracking-tight text-foreground">
            &ldquo;{pick.q}&rdquo;
          </blockquote>
          <p className="max-w-sm text-sm text-muted-foreground">{pick.a}</p>
          <div className="mt-6 h-px w-24 bg-border" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Personal AI reads what you capture, remembers it, and shows the original
            image as evidence for every answer.
          </p>
        </div>
      </aside>
    </div>
  );
}
