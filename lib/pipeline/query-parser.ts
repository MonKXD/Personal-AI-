import { MEMORY_TYPES, type MemoryType } from "@/lib/memory-types";

/**
 * Rule-based parsing of temporal + type constraints from a chat question.
 * Deterministic and debuggable; an LLM fallback can be layered later.
 * See docs/03-ARCHITECTURE.md §5 and docs/10-PROMPTS.md §2.
 */

export type QueryFilters = {
  after?: Date;
  before?: Date;
  types?: MemoryType[];
};

export type ParsedQuery = {
  cleanedQuery: string;
  filters: QueryFilters;
  /** human-readable echo for the UI */
  label: string[];
};

const TYPE_KEYWORDS: [RegExp, MemoryType][] = [
  [/\b(notice|circular|memo|announcement)s?\b/i, "notice"],
  [/\b(timetable|time-table|schedule|routine)s?\b/i, "timetable"],
  [/\b(textbook|book|chapter|page)s?\b/i, "textbook_page"],
  [/\b(whiteboard|white-board|board)s?\b/i, "whiteboard"],
  [/\b(circuit|schematic|diagram)s?\b/i, "circuit"],
  [/\b(note|notes)\b/i, "handwritten_note"],
  [/\b(slide|deck|presentation)s?\b/i, "slide"],
];

export function parseQuery(question: string, now: Date, tzOffsetMinutes = 330): ParsedQuery {
  const label: string[] = [];
  const filters: QueryFilters = {};
  const q = question.trim();
  const lower = q.toLowerCase();

  // ---- temporal ----
  const local = new Date(now.getTime() + tzOffsetMinutes * 60_000);
  const startOfLocalDay = (d: Date) => {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return new Date(x.getTime() - tzOffsetMinutes * 60_000);
  };
  const today0 = startOfLocalDay(local);

  if (/\bthis morning\b/.test(lower)) {
    filters.after = today0;
    filters.before = new Date(today0.getTime() + 12 * 3600_000);
    label.push("this morning");
  } else if (/\bthis afternoon\b/.test(lower)) {
    filters.after = new Date(today0.getTime() + 12 * 3600_000);
    filters.before = new Date(today0.getTime() + 18 * 3600_000);
    label.push("this afternoon");
  } else if (/\b(tonight|this evening)\b/.test(lower)) {
    filters.after = new Date(today0.getTime() + 17 * 3600_000);
    label.push("this evening");
  } else if (/\btoday\b/.test(lower)) {
    filters.after = today0;
    label.push("today");
  } else if (/\byesterday\b/.test(lower)) {
    filters.after = new Date(today0.getTime() - 24 * 3600_000);
    filters.before = today0;
    label.push("yesterday");
  } else if (/\blast night\b/.test(lower)) {
    filters.after = new Date(today0.getTime() - 12 * 3600_000);
    filters.before = today0;
    label.push("last night");
  } else if (/\bthis week\b/.test(lower)) {
    const dow = (local.getUTCDay() + 6) % 7;
    filters.after = new Date(today0.getTime() - dow * 24 * 3600_000);
    label.push("this week");
  } else if (/\blast week\b/.test(lower)) {
    const dow = (local.getUTCDay() + 6) % 7;
    const thisMon = new Date(today0.getTime() - dow * 24 * 3600_000);
    filters.after = new Date(thisMon.getTime() - 7 * 24 * 3600_000);
    filters.before = thisMon;
    label.push("last week");
  }

  // ---- type ----
  const types = new Set<MemoryType>();
  for (const [re, t] of TYPE_KEYWORDS) {
    if (re.test(lower)) types.add(t);
  }
  if (types.size) {
    filters.types = [...types].filter((t) =>
      (MEMORY_TYPES as readonly string[]).includes(t),
    );
    label.push(...filters.types.map((t) => t.replace(/_/g, " ")));
  }

  return { cleanedQuery: q, filters, label };
}
