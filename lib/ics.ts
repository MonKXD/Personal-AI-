/**
 * Minimal RFC 5545 calendar generator for the deadline feed. One all-day
 * VEVENT per action item with a due date, plus a one-day-before alarm.
 */

export type IcsItem = {
  id: string;
  title: string;
  due: Date;
  memoryTitle: string | null;
  done: boolean;
};

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines to 75 octets per spec (continuations start with a space). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    out.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) out.push(" " + rest);
  return out.join("\r\n");
}

const ymd = (d: Date) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;

const stamp = (d: Date) =>
  `${ymd(d)}T${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`;

export function buildIcs(items: IcsItem[], calName: string): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MirrorMind//Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calName)}`,
    "X-PUBLISHED-TTL:PT6H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
  ];

  for (const it of items) {
    const start = new Date(Date.UTC(it.due.getUTCFullYear(), it.due.getUTCMonth(), it.due.getUTCDate()));
    const end = new Date(start.getTime() + 86_400_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${it.id}@mirrormind`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${ymd(start)}`,
      `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${esc((it.done ? "✓ " : "") + it.title)}`,
      `DESCRIPTION:${esc(it.memoryTitle ? `From: ${it.memoryTitle}` : "MirrorMind")}`,
      `STATUS:${it.done ? "CONFIRMED" : "TENTATIVE"}`,
      "TRANSP:TRANSPARENT",
    );
    if (!it.done) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${esc(it.title)}`,
        "TRIGGER:-P1D",
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
