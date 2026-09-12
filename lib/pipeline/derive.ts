import type { Extraction, ExtractedEntity } from "@/lib/ai/types";
import type { MemoryType } from "@/lib/memory-types";

/** Best-effort ISO datetime from an entity. */
export function entityTimestamp(e: ExtractedEntity): Date | null {
  const raw = e.ts_value ?? (looksIso(e.value_norm) ? e.value_norm! : null);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function looksIso(v?: string | null): boolean {
  return !!v && /^\d{4}-\d{2}-\d{2}/.test(v);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Derive up to ~8 tags from type + structured + entities + keyword hits. */
export function deriveTags(x: Extraction): string[] {
  const tags = new Set<string>();
  tags.add(x.type.replace(/_/g, "-"));

  const st = (x.structured ?? {}) as Record<string, unknown>;
  for (const key of ["subject", "book", "owner", "issuer"]) {
    const v = st[key];
    if (typeof v === "string" && v) tags.add(slug(v));
  }

  for (const e of x.entities) {
    if (e.kind === "subject" || e.kind === "organization") {
      const s = slug(e.value_text);
      if (s) tags.add(s);
    }
  }

  const hay = `${x.title}\n${x.summary}\n${x.text}`.toLowerCase();
  for (const kw of ["exam", "lab", "assignment", "deadline", "fee", "holiday", "meeting", "quiz"]) {
    if (hay.includes(kw)) tags.add(kw);
  }

  return [...tags].filter(Boolean).slice(0, 8);
}

export type DerivedActionItem = { title: string; dueAt: Date | null; entityIndex: number | null };

/** Action items from deadline entities and structured deadlines. */
export function deriveActionItems(x: Extraction): DerivedActionItem[] {
  const items: DerivedActionItem[] = [];

  x.entities.forEach((e, i) => {
    if (e.kind !== "deadline") return;
    items.push({
      title: actionTitle(x, e.value_text),
      dueAt: entityTimestamp(e),
      entityIndex: i,
    });
  });

  const st = (x.structured ?? {}) as Record<string, unknown>;
  const structuredDeadlines = Array.isArray(st.deadlines) ? st.deadlines : [];
  for (const d of structuredDeadlines as Record<string, unknown>[]) {
    const label = typeof d.label === "string" ? d.label : "Deadline";
    const value = typeof d.value === "string" ? d.value : null;
    const time = typeof d.time === "string" ? d.time : null;
    const when = value ? new Date(`${value}T${time ?? "23:59"}:00`) : null;
    const dueAt = when && !Number.isNaN(when.getTime()) ? when : null;
    if (!items.some((it) => it.title.toLowerCase().includes(label.toLowerCase()))) {
      items.push({ title: `${label}: ${x.title || x.type}`.slice(0, 200), dueAt, entityIndex: null });
    }
  }

  // de-dupe by title
  const seen = new Set<string>();
  return items.filter((it) => {
    const k = it.title.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function actionTitle(x: Extraction, deadlineText: string): string {
  const subject = x.title || labelForType(x.type);
  return `${subject} — ${deadlineText}`.slice(0, 200);
}

function labelForType(t: MemoryType): string {
  return t.replace(/_/g, " ");
}
