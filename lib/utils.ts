import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conditional logic, de-duping conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a Date/ISO string as a short relative label ("2h ago", "just now"). */
export function relativeTime(input: Date | string, now: Date = new Date()) {
  const then = typeof input === "string" ? new Date(input) : input;
  const diffMs = now.getTime() - then.getTime();
  const abs = Math.abs(diffMs);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  if (abs < 45_000) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(-Math.round(diffMs / ms), unit);
  }
  return "just now";
}

export function absoluteTime(input: Date | string) {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** True when a signed thumbnail URL points at a real raster image (a
 * generated `thumb.jpg` for a photo or a PDF's page-1 render) rather than
 * the raw original (audio, .docx, .pptx, an un-rendered PDF). Lets render
 * sites decide `<img>` vs an icon tile without threading extra flags. */
export function isImageThumbUrl(url: string | null | undefined): url is string {
  return !!url && /\.(jpe?g|png|webp|avif)(\?|#|$)/i.test(url);
}
