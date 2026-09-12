import { describe, it, expect } from "vitest";
import { buildDigest } from "./digest";
import type { MemoryType } from "@/lib/memory-types";

const m = (type: MemoryType, i = 0) => ({ id: `id-${type}-${i}`, type, title: `${type} ${i}` });

describe("buildDigest", () => {
  it("handles an empty day", () => {
    const d = buildDigest([]);
    expect(d.sentence).toBe("Nothing captured yet today.");
    expect(d.groups).toEqual([]);
  });

  it("phrases a single capture", () => {
    const d = buildDigest([m("notice")]);
    expect(d.sentence).toBe("You captured 1 thing today: a notice.");
    expect(d.groups).toHaveLength(1);
  });

  it("counts and lists multiple types", () => {
    const d = buildDigest([m("notice", 1), m("notice", 2), m("timetable")]);
    expect(d.sentence).toBe("You captured 3 things today: 2 notices and a timetable.");
    expect(d.groups.map((g) => g.type)).toEqual(["notice", "timetable"]);
    expect(d.groups[0].items).toHaveLength(2);
  });

  it("joins three groups with commas + 'and'", () => {
    const d = buildDigest([m("notice"), m("timetable"), m("whiteboard")]);
    expect(d.sentence).toContain("a notice, a timetable and a whiteboard");
  });
});
