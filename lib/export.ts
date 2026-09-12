import "server-only";

import { zipSync, strToU8 } from "fflate";

type Mem = {
  id: string;
  type: string;
  title: string;
  summary: string;
  text: string;
  correctedText: string | null;
  folderId: string | null;
  capturedAt: Date | string;
  structured: unknown;
};

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^\da-z]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "memory"
  );
}

const yamlStr = (s: string) => `"${s.replace(/"/g, '\\"')}"`;

/** One Markdown file per memory (YAML frontmatter + summary + full text),
 * zipped. Obsidian-ready. */
export function buildMarkdownZip(
  memories: Mem[],
  tagsByMemory: Map<string, string[]>,
  folderPath: Map<string, string>,
): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "README.md": strToU8(
      `# Personal AI export\n\nExported ${new Date().toISOString()}\n\n${memories.length} memories, one Markdown file each in \`memories/\`.\n`,
    ),
  };

  for (const m of memories) {
    const date = new Date(m.capturedAt).toISOString().slice(0, 10);
    const tags = tagsByMemory.get(m.id) ?? [];
    const folder = m.folderId ? folderPath.get(m.folderId) : null;
    const fm = [
      "---",
      `title: ${yamlStr(m.title || "Untitled memory")}`,
      `type: ${m.type}`,
      `captured: ${date}`,
      folder ? `folder: ${yamlStr(folder)}` : null,
      tags.length ? `tags: [${tags.map((t) => yamlStr(t)).join(", ")}]` : null,
      `id: ${m.id}`,
      "---",
      "",
    ]
      .filter((l) => l !== null)
      .join("\n");

    const body = [
      `# ${m.title || "Untitled memory"}`,
      "",
      m.summary ? `> ${m.summary}` : null,
      m.summary ? "" : null,
      (m.correctedText ?? m.text ?? "").trim(),
      "",
    ]
      .filter((l) => l !== null)
      .join("\n");

    files[`memories/${date}-${slug(m.title)}-${m.id.slice(-6)}.md`] = strToU8(fm + body);
  }

  return zipSync(files, { level: 6 });
}

/** Tab-separated Anki import: definitions from textbook/other memories, plus a
 * "recall the summary" card per memory. Anki reads this directly. */
export function buildAnkiTsv(memories: Mem[]): string {
  const rows: string[] = [
    "#separator:tab",
    "#html:false",
    "#columns:Front\tBack\tTags",
  ];
  const cell = (s: string) =>
    /[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;

  for (const m of memories) {
    const tag = `personal-ai::${m.type}`;
    const st = (m.structured ?? {}) as Record<string, unknown>;
    const defs = Array.isArray(st.definitions) ? (st.definitions as Record<string, unknown>[]) : [];
    for (const d of defs) {
      const term = String(d.term ?? "").trim();
      const text = String(d.text ?? d.definition ?? "").trim();
      if (term && text) rows.push([cell(term), cell(text), tag].join("\t"));
    }
    if (m.title && m.summary) {
      rows.push(
        [cell(`What was in "${m.title}"?`), cell(m.summary), tag].join("\t"),
      );
    }
  }
  return rows.join("\n") + "\n";
}
