import {
  CalendarClock,
  MapPin,
  Mail,
  Phone,
  Link2,
  BookOpen,
  ListChecks,
} from "lucide-react";
import type { MemoryType } from "@/lib/memory-types";
import { absoluteTime } from "@/lib/utils";

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const asArr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function StructuredCard({
  type,
  structured,
}: {
  type: MemoryType;
  structured: unknown;
}) {
  const s = asObj(structured);
  if (!structured || Object.keys(s).length === 0) return null;

  switch (type) {
    case "notice":
      return <NoticeCard s={s} />;
    case "timetable":
      return <TimetableCard s={s} />;
    case "textbook_page":
      return <TextbookCard s={s} />;
    case "whiteboard":
      return <WhiteboardCard s={s} />;
    case "circuit":
      return <CircuitCard s={s} />;
    default:
      return <GenericCard s={s} />;
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      {children}
    </div>
  );
}

function Row({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </div>
  );
}

function dateList(items: Obj[]) {
  return items
    .map((d) => {
      const label = str(d.label);
      const value = str(d.value);
      const time = str(d.time);
      if (!value) return null;
      const when = time ? `${value} · ${time}` : value;
      return label ? `${label}: ${when}` : when;
    })
    .filter(Boolean) as string[];
}

function NoticeCard({ s }: { s: Obj }) {
  const dates = dateList(asArr(s.dates));
  const deadlines = dateList(asArr(s.deadlines));
  const contacts = asArr(s.contacts);
  const links = (Array.isArray(s.links) ? s.links : []).filter(
    (x): x is string => typeof x === "string",
  );
  return (
    <Shell>
      {str(s.headline) && (
        <div className="font-medium">{str(s.headline)}</div>
      )}
      {str(s.body) && (
        <p className="mt-1 text-sm text-muted-foreground">{str(s.body)}</p>
      )}
      <div className="mt-3 space-y-2">
        {deadlines.map((d, i) => (
          <Row key={`dl-${i}`} icon={CalendarClock}>
            <span className="font-medium text-warning">{d}</span>
          </Row>
        ))}
        {dates.map((d, i) => (
          <Row key={`dt-${i}`} icon={CalendarClock}>
            {d}
          </Row>
        ))}
        {str(s.location) && <Row icon={MapPin}>{str(s.location)}</Row>}
        {contacts.map((c, i) => (
          <Row key={`c-${i}`} icon={str(c.email) ? Mail : Phone}>
            {[str(c.name), str(c.email), str(c.phone)].filter(Boolean).join(" · ")}
          </Row>
        ))}
        {links.map((l, i) => (
          <Row key={`l-${i}`} icon={Link2}>
            <span className="break-all">{l}</span>
          </Row>
        ))}
      </div>
    </Shell>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function TimetableCard({ s }: { s: Obj }) {
  const slots = asArr(s.slots)
    .map((sl) => ({
      day: str(sl.day),
      start: str(sl.start),
      end: str(sl.end),
      subject: str(sl.subject),
      room: str(sl.room),
    }))
    .filter((sl) => sl.subject);

  const byDay = DAYS.map((d) => ({
    day: d,
    items: slots
      .filter((sl) => sl.day.toLowerCase().startsWith(d.toLowerCase()))
      .sort((a, b) => a.start.localeCompare(b.start)),
  })).filter((g) => g.items.length);

  return (
    <Shell>
      {str(s.owner) && <div className="font-medium">{str(s.owner)}</div>}
      {str(s.valid_from) && (
        <div className="text-xs text-muted-foreground">
          Effective {str(s.valid_from)}
        </div>
      )}
      <div className="mt-3 space-y-3">
        {byDay.map((g) => (
          <div key={g.day}>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.day}
            </div>
            <ul className="mt-1 space-y-1">
              {g.items.map((it, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                    {it.start}
                    {it.end ? `–${it.end}` : ""}
                  </span>
                  <span className="font-medium">{it.subject}</span>
                  {it.room && (
                    <span className="text-xs text-muted-foreground">· {it.room}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function TextbookCard({ s }: { s: Obj }) {
  const terms = (Array.isArray(s.key_terms) ? s.key_terms : []).filter(
    (x): x is string => typeof x === "string",
  );
  const defs = asArr(s.definitions);
  const points = (Array.isArray(s.summary_points) ? s.summary_points : []).filter(
    (x): x is string => typeof x === "string",
  );
  return (
    <Shell>
      <Row icon={BookOpen}>
        {[str(s.book), str(s.chapter), str(s.page) && `p. ${str(s.page)}`]
          .filter(Boolean)
          .join(" · ") || "Textbook page"}
      </Row>
      {points.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      {defs.length > 0 && (
        <dl className="mt-3 space-y-2 text-sm">
          {defs.map((d, i) => (
            <div key={i}>
              <dt className="font-medium">{str(d.term)}</dt>
              <dd className="text-muted-foreground">{str(d.text)}</dd>
            </div>
          ))}
        </dl>
      )}
      {terms.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {terms.map((t) => (
            <span
              key={t}
              className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </Shell>
  );
}

function bulletList(v: unknown) {
  return (Array.isArray(v) ? v : []).filter(
    (x): x is string => typeof x === "string",
  );
}

function WhiteboardCard({ s }: { s: Obj }) {
  const points = bulletList(s.points);
  const actions = bulletList(s.action_items);
  return (
    <Shell>
      {str(s.summary) && <p className="text-sm">{str(s.summary)}</p>}
      {points.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      {actions.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ListChecks className="size-3.5" /> Action items
          </div>
          <ul className="mt-1 space-y-1 text-sm">
            {actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {str(s.diagram_note) && (
        <p className="mt-3 text-xs text-muted-foreground">{str(s.diagram_note)}</p>
      )}
    </Shell>
  );
}

function CircuitCard({ s }: { s: Obj }) {
  const comps = asArr(s.components);
  const conns = asArr(s.connections);
  const notes = bulletList(s.notes);
  return (
    <Shell>
      {str(s.title) && <div className="font-medium">{str(s.title)}</div>}
      {comps.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {comps.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {str(c.ref) || "—"}
              </span>
              <span>{[str(c.kind), str(c.value)].filter(Boolean).join(" ")}</span>
            </li>
          ))}
        </ul>
      )}
      {conns.length > 0 && (
        <div className="mt-3 text-sm text-muted-foreground">
          {conns
            .map((c) => `${str(c.from)} → ${str(c.to)}`)
            .filter((x) => x !== " → ")
            .join(",  ")}
        </div>
      )}
      {notes.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function GenericCard({ s }: { s: Obj }) {
  const points = bulletList(s.points);
  const dates = bulletList(s.dates);
  if (!str(s.summary) && points.length === 0 && dates.length === 0) return null;
  return (
    <Shell>
      {str(s.summary) && <p className="text-sm">{str(s.summary)}</p>}
      {points.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      {dates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dates.map((d, i) => (
            <span key={i} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
              {isNaN(Date.parse(d)) ? d : absoluteTime(d)}
            </span>
          ))}
        </div>
      )}
    </Shell>
  );
}
