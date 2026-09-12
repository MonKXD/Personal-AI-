import { describe, it, expect } from "vitest";
import { startOfUtcDayForTz, startOfUtcWeekForTz, tzOffsetMs } from "./time";

describe("tzOffsetMs", () => {
  it("returns a whole-minute offset regardless of the input's milliseconds", () => {
    for (const ms of [0, 1, 411, 559, 999]) {
      const at = new Date(Date.UTC(2026, 8, 8, 12, 34, 56, ms));
      const off = tzOffsetMs(at, "Asia/Kolkata");
      expect(off % 60_000).toBe(0);
      expect(off).toBe(5.5 * 60 * 60 * 1000); // IST = UTC+05:30, no DST
    }
  });
});

describe("startOfUtcDayForTz", () => {
  it("zeroes seconds and milliseconds so the bucket key is stable", () => {
    // Two instants in the same IST day, with dirty sub-second components.
    const a = startOfUtcDayForTz(new Date("2026-09-08T18:51:32.559Z"), "Asia/Kolkata");
    const b = startOfUtcDayForTz(new Date("2026-09-08T21:07:03.001Z"), "Asia/Kolkata");
    expect(a.getUTCSeconds()).toBe(0);
    expect(a.getUTCMilliseconds()).toBe(0);
    expect(a.toISOString()).toBe("2026-09-08T18:30:00.000Z"); // IST midnight 2026-09-09
    expect(b.getTime()).toBe(a.getTime()); // same bucket → upsert PK collides
  });

  it("rolls to the next bucket after local midnight", () => {
    const before = startOfUtcDayForTz(new Date("2026-09-08T18:29:00Z"), "Asia/Kolkata");
    const after = startOfUtcDayForTz(new Date("2026-09-08T18:31:00Z"), "Asia/Kolkata");
    expect(after.getTime() - before.getTime()).toBe(86_400_000);
  });
});

describe("startOfUtcWeekForTz", () => {
  it("also lands on a clean instant", () => {
    const w = startOfUtcWeekForTz(new Date("2026-09-09T10:00:00.123Z"), "Asia/Kolkata");
    expect(w.getUTCSeconds()).toBe(0);
    expect(w.getUTCMilliseconds()).toBe(0);
  });
});
