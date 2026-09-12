import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/http";
import { exportUserData, listFolderPaths } from "@/lib/db/queries";
import { buildMarkdownZip, buildAnkiTsv } from "@/lib/export";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/export
 *   ?format=json  (default) — full JSON dump
 *   ?format=md              — a .zip of one Markdown file per memory (Obsidian)
 *   ?format=anki            — a tab-separated file Anki imports directly
 */
export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const data = await exportUserData(user.id);

  if (format === "md" || format === "anki") {
    const memories = data.memories.filter((m) => !m.deletedAt);

    if (format === "anki") {
      return new NextResponse(buildAnkiTsv(memories), {
        headers: {
          "content-type": "text/tab-separated-values; charset=utf-8",
          "content-disposition": 'attachment; filename="personal-ai-anki.txt"',
          "cache-control": "no-store",
        },
      });
    }

    const tagsByMemory = new Map<string, string[]>();
    for (const t of data.memory_tags) {
      const arr = tagsByMemory.get(t.memoryId) ?? [];
      arr.push(t.name);
      tagsByMemory.set(t.memoryId, arr);
    }
    const folderPath = new Map((await listFolderPaths(user.id)).map((f) => [f.id, f.path]));
    const zip = buildMarkdownZip(memories, tagsByMemory, folderPath);

    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="personal-ai-markdown.zip"',
        "cache-control": "no-store",
      },
    });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="personal-ai-export.json"',
      "cache-control": "no-store",
    },
  });
});
