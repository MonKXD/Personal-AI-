/** Timezone helpers built on Intl — no dependency. */

/** Milliseconds to add to a UTC instant to get wall-clock time in `tz`. */
export function tzOffsetMs(at: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = dtf.formatToParts(at).reduce<Record<string, string>>((a, x) => {
    a[x.type] = x.value;
    return a;
  }, {});
  const asIfUtc = Date.UTC(
    +p.year,
    +p.month - 1,
    +p.day,
    +p.hour % 24,
    +p.minute,
    +p.second,
  );
  // `asIfUtc` is floored to the whole second, but `at.getTime()` carries the
  // caller's milliseconds — differencing them leaks that sub-second remainder
  // into the result. Every real tz offset is a whole number of minutes, so
  // round to the minute: this keeps startOfUtcDayForTz() returning a stable,
  // second-and-ms-zeroed instant (the primary key `ai_call_log` buckets on).
  return Math.round((asIfUtc - at.getTime()) / 60_000) * 60_000;
}

/** The UTC instant of the most recent local midnight in `tz`. */
export function startOfUtcDayForTz(now: Date, tz: string): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = fmt.format(now).split("-").map(Number);
  const midnightAsUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  return new Date(midnightAsUtc - tzOffsetMs(now, tz));
}

/** Monday 00:00 (local `tz`) of the current week, as a UTC instant. */
export function startOfUtcWeekForTz(now: Date, tz: string): Date {
  const day0 = startOfUtcDayForTz(now, tz);
  const localDow = (new Date(day0.getTime() + tzOffsetMs(now, tz)).getUTCDay() + 6) % 7;
  return new Date(day0.getTime() - localDow * 86_400_000);
}
