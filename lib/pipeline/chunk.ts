/**
 * Text chunking for retrieval. No tokenizer dependency — approximate with
 * ~4 chars/token. Target ~300 tokens (~1200 chars) with ~15% overlap, split on
 * paragraph then sentence boundaries. See docs/03-ARCHITECTURE.md §4.
 */

const TARGET_CHARS = 1200;
const OVERLAP_CHARS = 180;
const MAX_CHARS = 1800;

export type Chunk = { ord: number; kind: "summary" | "body"; content: string };

export function chunkMemory(opts: {
  title: string;
  summary: string;
  text: string;
}): Chunk[] {
  const chunks: Chunk[] = [];
  const head = [opts.title, opts.summary].filter(Boolean).join("\n").trim();
  if (head) chunks.push({ ord: 0, kind: "summary", content: head });

  const body = (opts.text || "").replace(/\r\n/g, "\n").trim();
  if (!body) return chunks;

  const paragraphs = body.split(/\n{2,}/).flatMap(splitLongParagraph);

  let buf = "";
  const flush = () => {
    const content = buf.trim();
    if (content) chunks.push({ ord: chunks.length, kind: "body", content });
    buf = content.length > OVERLAP_CHARS ? content.slice(-OVERLAP_CHARS) + "\n" : "";
  };

  for (const p of paragraphs) {
    if (buf && buf.length + p.length + 1 > TARGET_CHARS) flush();
    buf += (buf ? "\n" : "") + p;
    if (buf.length >= MAX_CHARS) flush();
  }
  flush();

  return chunks;
}

/** Break a single oversized paragraph on sentence boundaries. */
function splitLongParagraph(p: string): string[] {
  if (p.length <= MAX_CHARS) return [p];
  const sentences = p.match(/[^.!?\n]+[.!?]?\s*/g) ?? [p];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length > TARGET_CHARS) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
