import { describe, it, expect } from "vitest";
import { entityTimestamp, deriveTags, deriveActionItems } from "./derive";
import type { Extraction } from "@/lib/ai/types";

const base: Extraction = {
  type: "notice",
  type_confidence: 0.9,
  title: "Robotics Club — Open House",
  summary: "Open house Sep 5, register by Sep 4.",
  text: "Robotics Club open house. Register by Sep 4. Physics lab exam soon.",
  ocr_confidence: "high",
  language: "en",
  structured: { issuer: "Robotics Club", deadlines: [{ label: "Registration", value: "2026-09-04", time: "17:00" }] },
  entities: [],
};

describe("entityTimestamp", () => {
  it("parses an explicit offset datetime", () => {
    const d = entityTimestamp({ kind: "deadline", value_text: "x", ts_value: "2026-09-04T17:00:00+05:30" });
    expect(d?.toISOString()).toBe("2026-09-04T11:30:00.000Z");
  });

  it("accepts an ISO date in value_norm", () => {
    const d = entityTimestamp({ kind: "date", value_text: "Sep 15", value_norm: "2026-09-15" });
    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(8);
  });

  it("returns null for non-date text", () => {
    expect(entityTimestamp({ kind: "date", value_text: "next friday" })).toBeNull();
  });
});

describe("deriveTags", () => {
  it("always includes the type and slugged structured fields", () => {
    const tags = deriveTags(base);
    expect(tags).toContain("notice");
    expect(tags).toContain("robotics-club");
  });

  it("picks up keyword hits from the text", () => {
    const tags = deriveTags(base);
    expect(tags).toEqual(expect.arrayContaining(["exam", "lab"]));
  });

  it("caps at 8 tags", () => {
    expect(deriveTags(base).length).toBeLessThanOrEqual(8);
  });
});

describe("deriveActionItems", () => {
  it("creates an item from a deadline entity", () => {
    const items = deriveActionItems({
      ...base,
      entities: [
        { kind: "deadline", value_text: "by Sep 4 5pm", ts_value: "2026-09-04T17:00:00+05:30" },
      ],
    });
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].dueAt).toBeInstanceOf(Date);
  });

  it("creates an item from a structured deadline", () => {
    const items = deriveActionItems({ ...base, entities: [] });
    expect(items.some((i) => /registration/i.test(i.title))).toBe(true);
  });

  it("de-dupes by title", () => {
    const items = deriveActionItems({
      ...base,
      entities: [
        { kind: "deadline", value_text: "same", ts_value: null },
        { kind: "deadline", value_text: "same", ts_value: null },
      ],
    });
    const titles = items.map((i) => i.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });
});
