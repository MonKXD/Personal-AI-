import { MEMORY_TYPE_META, type MemoryType } from "@/lib/memory-types";

type Item = { id: string; type: MemoryType; title: string };

/**
 * Template digest — no LLM call. Groups the day's captures by type into one
 * friendly sentence. See docs/10-PROMPTS.md §4 for the (optional) LLM version.
 */
export function buildDigest(
  items: Item[],
  periodLabel = "today",
): { sentence: string; groups: { type: MemoryType; label: string; items: Item[] }[] } {
  if (items.length === 0) {
    return { sentence: `Nothing captured yet ${periodLabel}.`, groups: [] };
  }

  const byType = new Map<MemoryType, Item[]>();
  for (const it of items) {
    const arr = byType.get(it.type) ?? [];
    arr.push(it);
    byType.set(it.type, arr);
  }

  const parts: string[] = [];
  const groups: { type: MemoryType; label: string; items: Item[] }[] = [];
  for (const [type, list] of byType) {
    const meta = MEMORY_TYPE_META[type];
    const noun = meta.label.toLowerCase();
    parts.push(list.length === 1 ? `a ${noun}` : `${list.length} ${noun}s`);
    groups.push({ type, label: meta.label, items: list });
  }

  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

  const n = items.length;
  return {
    sentence: `You captured ${n} ${n === 1 ? "thing" : "things"} ${periodLabel}: ${list}.`,
    groups,
  };
}
