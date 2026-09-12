import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The Personal AI mark — a violet sphere split into two "mind" hemispheres
 * (cream + teal) with a soft specular highlight and a small teal orbit ring.
 * Reads on cream paper and on ink. Source: "Personal AI Logo Final.dc.html".
 */
export function Orb({
  size = 38,
  glow = "sm",
  className,
}: {
  size?: number;
  glow?: "sm" | "lg" | "none";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative block shrink-0 rounded-full",
        glow === "sm" && "animate-[orb-glow-sm_5.5s_ease-in-out_infinite]",
        glow === "lg" && "animate-[orb-glow_6s_ease-in-out_infinite]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 96 96"
        width={size}
        height={size}
        style={{ overflow: "visible", display: "block" }}
      >
        <defs>
          <radialGradient id="mmSphere" cx="32%" cy="26%" r="72%">
            <stop offset="0" stopColor="#8b7ee0" />
            <stop offset="0.55" stopColor="#4a3f8f" />
            <stop offset="1" stopColor="#221c48" />
          </radialGradient>
          <radialGradient id="mmSpec" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="48" cy="48" r="44" fill="url(#mmSphere)" />
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M46 24c-9-5-20-1-21 8-6 1-8 8-4 12-4 5-2 12 5 13 1 6 8 10 14 7"
            stroke="#f6f1e7"
            strokeWidth="3"
            opacity="0.95"
          />
          <path d="M46 24v46" stroke="#f6f1e7" strokeWidth="2.2" opacity="0.55" />
          <path
            d="M46 24c9-5 20-1 21 8 6 1 8 8 4 12 4 5 2 12-5 13-1 6-8 10-14 7"
            stroke="#3f8f82"
            strokeWidth="3"
          />
        </g>
        <ellipse cx="29" cy="18" rx="12.5" ry="7.5" fill="url(#mmSpec)" />
        <circle
          cx="84"
          cy="12"
          r="12"
          fill="none"
          stroke="#3f8f82"
          strokeOpacity="0.55"
          strokeWidth="1.5"
        />
      </svg>
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return <Orb size={28} glow="sm" className={className} />;
}

export function Logo({
  className,
  href = "/",
  showWord = true,
  withTagline = false,
  tagline = "Your Daily Assistant",
  size = 34,
}: {
  className?: string;
  href?: string | null;
  showWord?: boolean;
  withTagline?: boolean;
  tagline?: string;
  size?: number;
}) {
  const inner = (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Orb size={size} glow="sm" />
      {showWord && (
        <span className="leading-none">
          <span className="font-display block text-[1.05rem] font-bold tracking-tight text-foreground">
            Personal AI
          </span>
          {withTagline && (
            <span className="mt-0.5 block font-body text-[11px] tracking-wide text-muted-foreground">
              {tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
  if (href === null) return inner;
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {inner}
    </Link>
  );
}
