import "server-only";

import { signImageUrls } from "@/lib/storage";
import type { MemoryType } from "@/lib/memory-types";

type StoredCitation = {
  memoryId: string;
  title: string;
  type: MemoryType;
  snippet: string;
  thumbKey?: string;
  mime?: string;
};

export type HydratedChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: {
    memoryId: string;
    title: string;
    type: MemoryType;
    snippet: string;
    thumbUrl: string | null;
    mime: string;
  }[];
  usedFilters: { types?: MemoryType[]; label?: string[] } & Record<string, unknown>;
  createdAt: string;
};

type Row = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: unknown;
  usedFilters: unknown;
  createdAt: Date;
};

/** Re-sign citation thumbnails (stored as keys) into fresh URLs. */
export async function hydrateChatMessages(rows: Row[]): Promise<HydratedChatMessage[]> {
  const allCitations = rows.flatMap((r) =>
    Array.isArray(r.citations) ? (r.citations as StoredCitation[]) : [],
  );
  const keys = allCitations.map((c) => c.thumbKey).filter((k): k is string => !!k);
  const urls = await signImageUrls(keys);

  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    citations: (Array.isArray(r.citations) ? (r.citations as StoredCitation[]) : []).map(
      (c) => ({
        memoryId: c.memoryId,
        title: c.title,
        type: c.type,
        snippet: c.snippet,
        thumbUrl: c.thumbKey ? (urls[c.thumbKey] ?? null) : null,
        mime: c.mime ?? "",
      }),
    ),
    usedFilters:
      r.usedFilters && typeof r.usedFilters === "object"
        ? (r.usedFilters as HydratedChatMessage["usedFilters"])
        : {},
    createdAt: r.createdAt.toISOString(),
  }));
}
