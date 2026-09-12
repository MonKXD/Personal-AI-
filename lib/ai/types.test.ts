import { describe, it, expect } from "vitest";
import { extractionSchema } from "./types";

const good = {
  type: "notice",
  type_confidence: 0.9,
  title: "Robotics Club",
  summary: "Open house.",
  text: "Body text.",
  ocr_confidence: "high",
  language: "en",
  structured: { issuer: "Robotics Club" },
  entities: [
    { kind: "date", value_text: "Sep 5", value_norm: "2026-09-05", ts_value: null },
  ],
};

describe("extractionSchema — tolerance", () => {
  it("parses a well-formed object", () => {
    const r = extractionSchema.parse(good);
    expect(r.type).toBe("notice");
    expect(r.entities).toHaveLength(1);
  });

  it("falls back to 'other' for an unknown type", () => {
    expect(extractionSchema.parse({ ...good, type: "banana" }).type).toBe("other");
  });

  it("aliases entity kinds (email -> contact_email)", () => {
    const r = extractionSchema.parse({
      ...good,
      entities: [{ kind: "email", value_text: "a@b.com" }],
    });
    expect(r.entities[0].kind).toBe("contact_email");
  });

  it("accepts a ts_value without a timezone offset", () => {
    const r = extractionSchema.parse({
      ...good,
      entities: [{ kind: "deadline", value_text: "Fri", ts_value: "2026-09-15" }],
    });
    expect(r.entities[0].ts_value).toBe("2026-09-15");
  });

  it("drops a malformed entity but keeps the good ones", () => {
    const r = extractionSchema.parse({
      ...good,
      entities: [
        { kind: 42, value_text: "bad" },
        { kind: "person", value_text: "Aditi" },
      ],
    });
    expect(r.entities).toHaveLength(1);
    expect(r.entities[0].value_text).toBe("Aditi");
  });

  it("nulls out a non-object structured payload", () => {
    expect(extractionSchema.parse({ ...good, structured: "oops" }).structured).toBeNull();
  });

  it("defaults missing scalar fields", () => {
    const r = extractionSchema.parse({ type: "other" });
    expect(r.title).toBe("");
    expect(r.ocr_confidence).toBe("medium");
    expect(r.entities).toEqual([]);
  });
});
