import { CalendarDays, Megaphone, BookOpen, Sparkles } from "lucide-react";

/**
 * Static, dependency-free visual of a MirrorMind answer with cited evidence.
 * Used on the landing hero — not a live component.
 */
export function AskPreview() {
  return (
    <div className="relative w-full max-w-md">
      <div className="overflow-hidden rounded-[20px] border border-border bg-card shadow-pop">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          </div>
          <span className="ml-1.5 text-[13px] font-semibold text-muted-foreground">
            Ask your memory
          </span>
        </div>

        <div className="space-y-4 p-5">
          <div className="ml-auto w-fit max-w-[88%] rounded-[14px] rounded-br-[4px] bg-primary px-4 py-3 text-[13.5px] leading-normal text-primary-foreground">
            I think my Physics lab clashes with the fee deadline — when&rsquo;s the
            lab, when&rsquo;s the deadline, and what&rsquo;s it on?
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-success">
              <Sparkles className="size-3.5" /> MirrorMind
            </div>
            <p className="text-[13.5px] leading-relaxed text-foreground">
              Your Physics lab is <b>Wed 2–4 PM in Lab-3</b>. The fee deadline is{" "}
              <b>Wed 5 PM</b>. The lab is on <b>RC circuits</b> (Ch. 27, p. 742).
            </p>

            <div className="flex flex-wrap gap-2 pt-0.5">
              <Cite icon={CalendarDays} label="Sem 3 timetable" />
              <Cite icon={Megaphone} label="Fee circular" />
              <Cite icon={BookOpen} label="Physics Ch. 27" />
            </div>

            <p className="text-[11px] text-muted-foreground">
              Filters used: <span className="text-foreground">physics</span> ·{" "}
              <span className="text-foreground">timetable, notice, textbook</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Cite({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs">
      <Icon className="size-3.5 text-primary" />
      {label}
    </span>
  );
}
