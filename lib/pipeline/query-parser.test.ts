import { describe, it, expect } from "vitest";
import { parseQuery } from "./query-parser";

// 2026-09-04 09:00:00Z == 14:30 IST (offset 330). Local midnight Sep 4 == Sep 3 18:30Z.
const NOW = new Date("2026-09-04T09:00:00.000Z");
const TODAY0 = new Date("2026-09-03T18:30:00.000Z").getTime();

describe("parseQuery — temporal", () => {
  it("'today' sets after to local midnight, no before", () => {
    const { filters, label } = parseQuery("what did I capture today", NOW);
    expect(filters.after?.getTime()).toBe(TODAY0);
    expect(filters.before).toBeUndefined();
    expect(label).toContain("today");
  });

  it("'this morning' is local 00:00–12:00", () => {
    const { filters } = parseQuery("the notice from this morning", NOW);
    expect(filters.after?.getTime()).toBe(TODAY0);
    expect(filters.before?.getTime()).toBe(TODAY0 + 12 * 3600_000);
  });

  it("'yesterday' spans the previous local day", () => {
    const { filters } = parseQuery("anything from yesterday", NOW);
    expect(filters.after?.getTime()).toBe(TODAY0 - 24 * 3600_000);
    expect(filters.before?.getTime()).toBe(TODAY0);
  });

  it("no temporal words → no date filters", () => {
    const { filters } = parseQuery("summarize the robotics notice", NOW);
    expect(filters.after).toBeUndefined();
    expect(filters.before).toBeUndefined();
  });
});

describe("parseQuery — type", () => {
  it("maps 'notice' to the notice type", () => {
    expect(parseQuery("what was on the notice", NOW).filters.types).toEqual(["notice"]);
  });

  it("maps 'timetable' / 'schedule'", () => {
    expect(parseQuery("check my schedule", NOW).filters.types).toContain("timetable");
  });

  it("detects multiple types", () => {
    const { filters } = parseQuery("the whiteboard and the textbook page", NOW);
    expect(filters.types).toEqual(expect.arrayContaining(["whiteboard", "textbook_page"]));
  });

  it("no type words → no type filter", () => {
    expect(parseQuery("what happened today", NOW).filters.types).toBeUndefined();
  });
});
