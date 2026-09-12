import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="container-px mx-auto grid max-w-6xl gap-8 py-12 sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Your AI memory for the physical world. Capture what you see, ask about
            it later.
          </p>
        </div>

        <FooterCol
          title="Product"
          links={[
            { href: "/#how", label: "How it works" },
            { href: "/#features", label: "Features" },
            { href: "/pricing", label: "Pricing" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { href: "/#features", label: "Features" },
            { href: "/privacy", label: "Privacy" },
            { href: "/terms", label: "Terms" },
          ]}
        />
        <FooterCol
          title="Get started"
          links={[
            { href: "/sign-in", label: "Sign in" },
            { href: "/sign-in", label: "Create account" },
          ]}
        />
      </div>
      <div className="container-px mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-border py-6 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} MirrorMind</span>
        <Link
          href="/sign-in"
          className="font-semibold text-primary transition-colors hover:text-violet-bright"
        >
          Open your memory →
        </Link>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
