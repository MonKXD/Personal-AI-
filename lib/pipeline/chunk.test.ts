import { describe, it, expect } from "vitest";
import { chunkMemory } from "./chunk";

describe("chunkMemory", () => {
  it("returns nothing for entirely empty input", () => {
    expect(chunkMemory({ title: "", summary: "", text: "" })).toEqual([]);
  });

  it("emits a leading summary chunk from title + summary", () => {
    const chunks = chunkMemory({
      title: "Robotics Club",
      summary: "Open house on Sep 5.",
      text: "",
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].kind).toBe("summary");
    expect(chunks[0].ord).toBe(0);
    expect(chunks[0].content).toContain("Robotics Club");
    expect(chunks[0].content).toContain("Open house on Sep 5.");
  });

  it("splits long text into multiple contiguous body chunks", () => {
    const para = "This is a sentence that repeats to build length. ".repeat(40);
    const text = `${para}\n\n${para}\n\n${para}`;
    const chunks = chunkMemory({ title: "T", summary: "S", text });

    const body = chunks.filter((c) => c.kind === "body");
    expect(body.length).toBeGreaterThan(1);
    // ords are 0..n with no gaps, summary first
    expect(chunks.map((c) => c.ord)).toEqual(chunks.map((_, i) => i));
    expect(chunks[0].kind).toBe("summary");
    // no chunk wildly over the hard cap
    for (const c of body) expect(c.content.length).toBeLessThanOrEqual(2000);
  });

  it("keeps a single short body as one chunk", () => {
    const chunks = chunkMemory({ title: "T", summary: "S", text: "Short body." });
    expect(chunks.filter((c) => c.kind === "body")).toHaveLength(1);
  });
});
