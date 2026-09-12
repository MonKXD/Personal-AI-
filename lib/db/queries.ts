import "server-only";

import { and, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { newId } from "@/lib/ids";
import type { CaptureStatus, MemoryType } from "@/lib/memory-types";
import type { Extraction } from "@/lib/ai/types";
import type { Chunk } from "@/lib/pipeline/chunk";
import { deriveActionItems, deriveTags, entityTimestamp } from "@/lib/pipeline/derive";
import { DEMO_USER_ID } from "@/lib/demo";

const {
  captures,
  memories,
  chunks,
  embeddings,
  entities,
  tags,
  memoryTags,
  actionItems,
  memoryLinks,
  folders,
  chatSessions,
  chatMessages,
  allowedEmails,
  profiles,
  profilePrefs,
  reminderLog,
  notifications,
  aiCallLog,
  apiTokens,
  webhooks,
  feedback,
  pushSubscriptions,
  telegramLinks,
  deadlines,
  financeTransactions,
  financeStatementBatches,
  calls,
  whatsappMessages,
  whatsappFilterRules,
} = schema;

/* ------------------------------- captures -------------------------------- */

export type NewCapture = {
  id: string;
  userId: string;
  originalKey: string;
  displayKey: string;
  thumbKey: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  source: string;
  sourceUrl?: string | null;
  folderId?: string | null;
  capturedAt: Date;
};

export async function findCaptureBySha(userId: string, sha256: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: captures.id, status: captures.status })
    .from(captures)
    .where(and(eq(captures.userId, userId), eq(captures.sha256, sha256)))
    .limit(1);
  return row ?? null;
}

export async function insertCapture(row: NewCapture) {
  const db = getDb();
  await db.insert(captures).values({ ...row, status: "queued" });
}

export async function getCapture(userId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: captures.id,
      status: captures.status,
      errorCode: captures.errorCode,
      errorDetail: captures.errorDetail,
      capturedAt: captures.capturedAt,
      updatedAt: captures.updatedAt,
      thumbKey: captures.thumbKey,
      displayKey: captures.displayKey,
    })
    .from(captures)
    .where(and(eq(captures.id, id), eq(captures.userId, userId)))
    .limit(1);
  if (!row) return null;
  const [mem] = await db
    .select({ id: memories.id })
    .from(memories)
    .where(eq(memories.captureId, id))
    .limit(1);
  return { ...row, memoryId: mem?.id ?? null };
}

export async function setCaptureStatus(
  id: string,
  status: CaptureStatus,
  patch: { errorCode?: string | null; errorDetail?: string | null; timings?: Record<string, number> } = {},
) {
  const db = getDb();
  await db
    .update(captures)
    .set({
      status,
      errorCode: patch.errorCode ?? null,
      errorDetail: patch.errorDetail ?? null,
      ...(patch.timings ? { timings: patch.timings } : {}),
      updatedAt: new Date(),
    })
    .where(eq(captures.id, id));
}

export async function loadCaptureForPipeline(id: string) {
  const db = getDb();
  const [row] = await db.select().from(captures).where(eq(captures.id, id)).limit(1);
  return row ?? null;
}

/** Images now upload their real original (whatever format the browser sent)
 * and get display/thumb JPEG derivatives generated in the pipeline, not at
 * upload time — this points the row at those derivatives once they exist. */
export async function updateCaptureDerivedKeys(
  id: string,
  displayKey: string,
  thumbKey: string,
) {
  const db = getDb();
  await db
    .update(captures)
    .set({ displayKey, thumbKey, updatedAt: new Date() })
    .where(eq(captures.id, id));
}

export async function listRecentCaptures(userId: string, limit = 12) {
  const db = getDb();
  return db
    .select({
      id: captures.id,
      status: captures.status,
      capturedAt: captures.capturedAt,
      thumbKey: captures.thumbKey,
      mime: captures.mime,
      memoryId: memories.id,
      type: memories.type,
      title: memories.title,
    })
    .from(captures)
    .leftJoin(memories, eq(memories.captureId, captures.id))
    .where(eq(captures.userId, userId))
    .orderBy(desc(captures.capturedAt))
    .limit(limit);
}

/* ---------------------------- memory graph ------------------------------ */

export async function clearMemoryForCapture(captureId: string) {
  const db = getDb();
  // FKs cascade from memories -> chunks/embeddings/entities/memory_tags/action_items
  await db.delete(memories).where(eq(memories.captureId, captureId));
}

export async function insertMemoryGraph(args: {
  userId: string;
  captureId: string;
  capturedAt: Date;
  extraction: Extraction;
  chunkList: Chunk[];
  vectors: number[][];
  embeddingModel: string;
  embeddingDims: number;
  extractor: string;
  modelMeta: Record<string, unknown>;
}): Promise<{ memoryId: string }> {
  const db = getDb();
  const x = args.extraction;
  const memoryId = newId();

  await db.transaction(async (tx) => {
    await tx.insert(memories).values({
      id: memoryId,
      captureId: args.captureId,
      userId: args.userId,
      type: x.type as MemoryType,
      typeConfidence: x.type_confidence,
      title: x.title.slice(0, 200),
      summary: x.summary.slice(0, 2000),
      text: x.text,
      ocrConfidence: x.ocr_confidence,
      language: x.language || "en",
      structured: x.structured ?? null,
      extractor: args.extractor,
      modelMeta: args.modelMeta,
      capturedAt: args.capturedAt,
    });

    // entities — array position i lines up with extraction.entities[i]
    const entityRows = x.entities.map((e) => ({
      id: newId(),
      memoryId,
      userId: args.userId,
      kind: e.kind,
      valueText: e.value_text.slice(0, 500),
      valueNorm: e.value_norm ?? null,
      tsValue: entityTimestamp(e),
      confidence: e.confidence ?? null,
    }));
    if (entityRows.length) {
      await tx.insert(entities).values(entityRows);
    }

    // tags
    const tagNames = deriveTags(x);
    for (const name of tagNames) {
      const tagId = newId();
      await tx
        .insert(tags)
        .values({ id: tagId, userId: args.userId, name, source: "derived" })
        .onConflictDoNothing({ target: [tags.userId, tags.name] });
      const [tag] = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.userId, args.userId), eq(tags.name, name)))
        .limit(1);
      if (tag) {
        await tx
          .insert(memoryTags)
          .values({ memoryId, tagId: tag.id })
          .onConflictDoNothing();
      }
    }

    // action items
    for (const it of deriveActionItems(x)) {
      const srcId =
        it.entityIndex !== null ? entityRows[it.entityIndex]?.id ?? null : null;
      await tx.insert(actionItems).values({
        id: newId(),
        memoryId,
        userId: args.userId,
        title: it.title,
        dueAt: it.dueAt,
        status: "open",
        sourceEntityId: srcId,
      });
    }

    // chunks + embeddings
    for (let i = 0; i < args.chunkList.length; i++) {
      const c = args.chunkList[i];
      const chunkId = newId();
      await tx.insert(chunks).values({
        id: chunkId,
        memoryId,
        userId: args.userId,
        ord: c.ord,
        kind: c.kind,
        content: c.content,
        tokenCount: Math.ceil(c.content.length / 4),
        capturedAt: args.capturedAt,
        type: x.type as MemoryType,
      });
      const vec = args.vectors[i];
      if (vec && vec.length === args.embeddingDims) {
        await tx.insert(embeddings).values({
          chunkId,
          userId: args.userId,
          model: args.embeddingModel,
          dims: args.embeddingDims,
          embedding: vec,
        });
      }
    }
  });

  return { memoryId };
}

/* ------------------------------- reads --------------------------------- */

export type MemoryListItem = {
  id: string;
  type: MemoryType;
  title: string;
  summary: string;
  capturedAt: Date;
  ocrConfidence: "high" | "medium" | "low";
  thumbKey: string;
  mime: string;
  tags: string[];
};

export async function listMemories(
  userId: string,
  opts: {
    after?: Date;
    before?: Date;
    types?: MemoryType[];
    q?: string;
    limit?: number;
    cursor?: string;
    /** Restrict to these folder ids and/or Unfiled (folder_id IS NULL). */
    folderIds?: string[];
    unfiled?: boolean;
    /** Skip pinned memories (they render in their own shelf on Timeline). */
    excludePinned?: boolean;
  } = {},
): Promise<{ items: MemoryListItem[]; nextCursor: string | null }> {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 24, 100);

  const filters = [eq(memories.userId, userId), isNull(memories.deletedAt)];
  if (opts.excludePinned) filters.push(isNull(memories.pinnedAt));
  if (opts.after) filters.push(gte(memories.capturedAt, opts.after));
  if (opts.before) filters.push(lte(memories.capturedAt, opts.before));
  if (opts.types?.length) filters.push(inArray(memories.type, opts.types));
  if (opts.unfiled && !opts.folderIds?.length) {
    filters.push(isNull(memories.folderId));
  } else if (opts.folderIds?.length || opts.unfiled) {
    const parts = [];
    if (opts.folderIds?.length) parts.push(inArray(memories.folderId, opts.folderIds));
    if (opts.unfiled) parts.push(isNull(memories.folderId));
    filters.push(parts.length === 1 ? parts[0] : or(...parts)!);
  }
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim().toLowerCase()}%`;
    filters.push(
      or(
        sql`lower(${memories.title}) like ${like}`,
        sql`lower(${memories.summary}) like ${like}`,
        sql`lower(coalesce(${memories.correctedText}, ${memories.text})) like ${like}`,
      )!,
    );
  }
  if (opts.cursor) filters.push(lt(memories.id, opts.cursor));

  const rows = await db
    .select({
      id: memories.id,
      type: memories.type,
      title: memories.title,
      summary: memories.summary,
      capturedAt: memories.capturedAt,
      ocrConfidence: memories.ocrConfidence,
      thumbKey: captures.thumbKey,
      mime: captures.mime,
      tags: sql<string[]>`coalesce((
        select array_agg(t.name order by t.name)
        from memory_tags mt join tags t on t.id = mt.tag_id
        where mt.memory_id = ${memories.id}
      ), '{}')`,
    })
    .from(memories)
    .innerJoin(captures, eq(captures.id, memories.captureId))
    .where(and(...filters))
    .orderBy(desc(memories.capturedAt), desc(memories.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit) as MemoryListItem[];
  const nextCursor = rows.length > limit ? items[items.length - 1]?.id ?? null : null;
  return { items, nextCursor };
}

/** Nodes + edges for the memory graph view. Capped at 250 most-recent
 * memories; edges kept only when both ends are in that set. */
export async function graphData(userId: string): Promise<{
  nodes: { id: string; title: string; type: MemoryType; folderId: string | null }[];
  edges: { a: string; b: string }[];
}> {
  const db = getDb();
  const nodes = await db
    .select({
      id: memories.id,
      title: memories.title,
      type: memories.type,
      folderId: memories.folderId,
    })
    .from(memories)
    .where(and(eq(memories.userId, userId), isNull(memories.deletedAt)))
    .orderBy(desc(memories.capturedAt))
    .limit(250);

  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size === 0) return { nodes: [], edges: [] };

  const raw = await db
    .select({ a: memoryLinks.srcMemoryId, b: memoryLinks.dstMemoryId })
    .from(memoryLinks)
    .innerJoin(memories, eq(memories.id, memoryLinks.srcMemoryId))
    .where(eq(memories.userId, userId));

  const seen = new Set<string>();
  const edges: { a: string; b: string }[] = [];
  for (const e of raw) {
    if (!ids.has(e.a) || !ids.has(e.b) || e.a === e.b) continue;
    const key = e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ a: e.a, b: e.b });
  }
  return { nodes: nodes as typeof nodes, edges };
}

/** Pin / unpin a memory (Timeline shelf). */
export async function setMemoryPin(
  userId: string,
  memoryId: string,
  pinned: boolean,
): Promise<boolean> {
  const db = getDb();
  const res = await db
    .update(memories)
    .set({ pinnedAt: pinned ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId), isNull(memories.deletedAt)));
  return (res as unknown as { count?: number }).count !== 0;
}

/** The user's pinned memories, most-recently-pinned first. */
export async function listPinnedMemories(userId: string): Promise<MemoryListItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: memories.id,
      type: memories.type,
      title: memories.title,
      summary: memories.summary,
      capturedAt: memories.capturedAt,
      ocrConfidence: memories.ocrConfidence,
      thumbKey: captures.thumbKey,
      mime: captures.mime,
      tags: sql<string[]>`coalesce((
        select array_agg(t.name order by t.name)
        from memory_tags mt join tags t on t.id = mt.tag_id
        where mt.memory_id = ${memories.id}
      ), '{}')`,
    })
    .from(memories)
    .innerJoin(captures, eq(captures.id, memories.captureId))
    .where(
      and(eq(memories.userId, userId), isNull(memories.deletedAt), sql`${memories.pinnedAt} is not null`),
    )
    .orderBy(desc(memories.pinnedAt))
    .limit(24);
  return rows as MemoryListItem[];
}

/** A few recent memories, lightest possible — for chat suggestion chips. */
export async function listRecentMemoryBriefs(
  userId: string,
  limit = 8,
): Promise<{ type: MemoryType; title: string }[]> {
  const db = getDb();
  return db
    .select({ type: memories.type, title: memories.title })
    .from(memories)
    .where(and(eq(memories.userId, userId), isNull(memories.deletedAt)))
    .orderBy(desc(memories.capturedAt))
    .limit(limit);
}

/** Turn public sharing on (mints a `share_id` if absent) or off for one of the
 * caller's own memories. Returns the current `share_id` (or null). */
export async function setMemoryShare(
  userId: string,
  memoryId: string,
  on: boolean,
): Promise<{ shareId: string | null } | null> {
  const db = getDb();
  const [mem] = await db
    .select({ shareId: memories.shareId })
    .from(memories)
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId), isNull(memories.deletedAt)))
    .limit(1);
  if (!mem) return null;
  if (!on) {
    await db
      .update(memories)
      .set({ shareId: null, updatedAt: new Date() })
      .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)));
    return { shareId: null };
  }
  if (mem.shareId) return { shareId: mem.shareId };
  const shareId = `${newId()}${Math.random().toString(36).slice(2, 8)}`.toLowerCase();
  await db
    .update(memories)
    .set({ shareId, updatedAt: new Date() })
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)));
  return { shareId };
}

/** Public read: the shared memory, no user scoping. Null if the id is unknown,
 * revoked, or the memory was deleted. */
export async function getSharedMemory(shareId: string) {
  if (!shareId || shareId.length < 20) return null;
  const db = getDb();
  const [row] = await db
    .select({
      id: memories.id,
      type: memories.type,
      title: memories.title,
      summary: memories.summary,
      text: sql<string>`coalesce(${memories.correctedText}, ${memories.text})`,
      capturedAt: memories.capturedAt,
      thumbKey: captures.thumbKey,
      mime: captures.mime,
    })
    .from(memories)
    .innerJoin(captures, eq(captures.id, memories.captureId))
    .where(and(eq(memories.shareId, shareId), isNull(memories.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getMemoryDetail(userId: string, id: string) {
  const db = getDb();
  const [mem] = await db
    .select()
    .from(memories)
    .innerJoin(captures, eq(captures.id, memories.captureId))
    .where(and(eq(memories.id, id), eq(memories.userId, userId), isNull(memories.deletedAt)))
    .limit(1);
  if (!mem) return null;

  const [ents, tagRows, actions] = await Promise.all([
    db.select().from(entities).where(eq(entities.memoryId, id)),
    db
      .select({ name: tags.name })
      .from(memoryTags)
      .innerJoin(tags, eq(tags.id, memoryTags.tagId))
      .where(eq(memoryTags.memoryId, id)),
    db.select().from(actionItems).where(eq(actionItems.memoryId, id)).orderBy(actionItems.dueAt),
  ]);

  return {
    memory: mem.memories,
    capture: mem.captures,
    entities: ents,
    tags: tagRows.map((t) => t.name),
    actionItems: actions,
  };
}

export async function updateMemoryTags(userId: string, memoryId: string, names: string[]) {
  const db = getDb();
  const [owned] = await db
    .select({ id: memories.id })
    .from(memories)
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
    .limit(1);
  if (!owned) return false;

  const clean = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
  await db.transaction(async (tx) => {
    await tx.delete(memoryTags).where(eq(memoryTags.memoryId, memoryId));
    for (const name of clean) {
      const tagId = newId();
      await tx
        .insert(tags)
        .values({ id: tagId, userId, name, source: "user" })
        .onConflictDoNothing({ target: [tags.userId, tags.name] });
      const [tag] = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.userId, userId), eq(tags.name, name)))
        .limit(1);
      if (tag) await tx.insert(memoryTags).values({ memoryId, tagId: tag.id }).onConflictDoNothing();
    }
  });
  return true;
}

export async function softDeleteMemory(userId: string, memoryId: string) {
  const db = getDb();
  const res = await db
    .update(memories)
    .set({ deletedAt: new Date() })
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId), isNull(memories.deletedAt)));
  return (res as unknown as { count?: number }).count !== 0;
}

/** Replace a memory's chunks/embeddings and store the corrected text, in one
 * transaction. Chunking/embedding happens in lib/pipeline/correct.ts — this
 * is pure persistence, mirroring the tail of insertMemoryGraph(). Leaves
 * entities/tags/action items untouched (no new vision call). */
export async function updateMemoryCorrectedText(
  userId: string,
  memoryId: string,
  correctedText: string,
  chunkList: Chunk[],
  vectors: number[][],
  embeddingModel: string,
  embeddingDims: number,
): Promise<boolean> {
  const db = getDb();
  const [owned] = await db
    .select({ id: memories.id, type: memories.type, capturedAt: memories.capturedAt })
    .from(memories)
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId), isNull(memories.deletedAt)))
    .limit(1);
  if (!owned) return false;

  await db.transaction(async (tx) => {
    await tx
      .update(memories)
      .set({ correctedText, updatedAt: new Date() })
      .where(eq(memories.id, memoryId));

    await tx.delete(chunks).where(eq(chunks.memoryId, memoryId));

    for (let i = 0; i < chunkList.length; i++) {
      const c = chunkList[i];
      const chunkId = newId();
      await tx.insert(chunks).values({
        id: chunkId,
        memoryId,
        userId,
        ord: c.ord,
        kind: c.kind,
        content: c.content,
        tokenCount: Math.ceil(c.content.length / 4),
        capturedAt: owned.capturedAt,
        type: owned.type,
      });
      const vec = vectors[i];
      if (vec && vec.length === embeddingDims) {
        await tx.insert(embeddings).values({
          chunkId,
          userId,
          model: embeddingModel,
          dims: embeddingDims,
          embedding: vec,
        });
      }
    }
  });
  return true;
}

/* ------------------------------- search ---------------------------------- */

export type SearchMemoryHit = {
  id: string;
  type: MemoryType;
  title: string;
  summary: string;
  thumbKey: string;
  mime: string;
};

export type SearchSessionHit = { id: string; title: string; updatedAt: Date };

export async function searchAll(
  userId: string,
  q: string,
  limit = 8,
): Promise<{ memories: SearchMemoryHit[]; sessions: SearchSessionHit[] }> {
  const term = q.trim().toLowerCase();
  if (!term) return { memories: [], sessions: [] };
  const db = getDb();
  const like = `%${term}%`;

  const [memRows, sessionRows] = await Promise.all([
    db
      .select({
        id: memories.id,
        type: memories.type,
        title: memories.title,
        summary: memories.summary,
        thumbKey: captures.thumbKey,
        mime: captures.mime,
      })
      .from(memories)
      .innerJoin(captures, eq(captures.id, memories.captureId))
      .where(
        and(
          eq(memories.userId, userId),
          isNull(memories.deletedAt),
          or(
            sql`lower(${memories.title}) like ${like}`,
            sql`lower(${memories.summary}) like ${like}`,
            sql`lower(coalesce(${memories.correctedText}, ${memories.text})) like ${like}`,
          )!,
        ),
      )
      .orderBy(desc(memories.capturedAt))
      .limit(limit),
    db
      .select({ id: chatSessions.id, title: chatSessions.title, updatedAt: chatSessions.updatedAt })
      .from(chatSessions)
      .where(and(eq(chatSessions.userId, userId), sql`lower(${chatSessions.title}) like ${like}`))
      .orderBy(desc(chatSessions.updatedAt))
      .limit(limit),
  ]);

  return { memories: memRows, sessions: sessionRows };
}

/* --------------------------- memory linking ------------------------------ */

export type LinkedMemory = {
  id: string;
  type: MemoryType;
  title: string;
  thumbKey: string;
  mime: string;
};

/**
 * After a memory is created, link it to its nearest neighbours by embedding
 * similarity so "Related" is populated without manual work. Best-effort:
 * skips silently if the memory has no embedding yet. Won't duplicate an
 * existing link in either direction; a link the user later removes stays
 * removed unless the capture is re-processed.
 */
export async function autoLinkMemory(
  userId: string,
  memoryId: string,
  opts: { limit?: number; minSim?: number } = {},
): Promise<number> {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 4, 8);
  const minSim = opts.minSim ?? 0.78;

  // Representative vector = the summary chunk's embedding (fall back to any).
  const vecRows = await db.execute<{ embedding: string }>(sql`
    select e.embedding::text as embedding
    from embeddings e join chunks c on c.id = e.chunk_id
    where c.memory_id = ${memoryId}
    order by (c.kind = 'summary') desc, c.ord asc
    limit 1
  `);
  const vecArr = Array.isArray(vecRows)
    ? vecRows
    : ((vecRows as { rows?: unknown[] }).rows ?? []);
  const vec = (vecArr[0] as { embedding?: string } | undefined)?.embedding;
  if (!vec) return 0;

  const hitRows = await db.execute<{ id: string; sim: number }>(sql`
    select m.id, max(1 - (e.embedding <=> ${vec}::vector)) as sim
    from embeddings e
    join chunks c on c.id = e.chunk_id
    join memories m on m.id = c.memory_id
    where c.user_id = ${userId} and m.id <> ${memoryId} and m.deleted_at is null
    group by m.id
    order by sim desc
    limit ${limit + 4}
  `);
  const hits = (
    Array.isArray(hitRows) ? hitRows : ((hitRows as { rows?: unknown[] }).rows ?? [])
  ) as { id: string; sim: number }[];

  const targets = hits.filter((h) => Number(h.sim) >= minSim).slice(0, limit);
  if (targets.length === 0) return 0;

  // Drop any that are already linked (either direction, any relation).
  const existing = await db
    .select({ a: memoryLinks.srcMemoryId, b: memoryLinks.dstMemoryId })
    .from(memoryLinks)
    .where(or(eq(memoryLinks.srcMemoryId, memoryId), eq(memoryLinks.dstMemoryId, memoryId)));
  const linked = new Set(existing.flatMap((r) => [r.a, r.b]));

  const rows = targets
    .filter((t) => !linked.has(t.id))
    .map((t) => ({
      srcMemoryId: memoryId,
      dstMemoryId: t.id,
      relation: "auto",
      score: Number(t.sim),
    }));
  if (rows.length === 0) return 0;

  await db.insert(memoryLinks).values(rows).onConflictDoNothing();
  return rows.length;
}

export async function linkMemories(
  userId: string,
  memoryId: string,
  targetId: string,
  relation = "related",
): Promise<boolean> {
  if (memoryId === targetId) return false;
  const db = getDb();
  const owned = await db
    .select({ id: memories.id })
    .from(memories)
    .where(and(inArray(memories.id, [memoryId, targetId]), eq(memories.userId, userId)));
  if (owned.length !== 2) return false;

  await db
    .insert(memoryLinks)
    .values({ srcMemoryId: memoryId, dstMemoryId: targetId, relation })
    .onConflictDoNothing();
  return true;
}

export async function unlinkMemory(userId: string, memoryId: string, targetId: string): Promise<boolean> {
  const db = getDb();
  const [owned] = await db
    .select({ id: memories.id })
    .from(memories)
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
    .limit(1);
  if (!owned) return false;

  await db
    .delete(memoryLinks)
    .where(
      or(
        and(eq(memoryLinks.srcMemoryId, memoryId), eq(memoryLinks.dstMemoryId, targetId)),
        and(eq(memoryLinks.srcMemoryId, targetId), eq(memoryLinks.dstMemoryId, memoryId)),
      ),
    );
  return true;
}

export async function listLinkedMemories(userId: string, memoryId: string): Promise<LinkedMemory[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: memories.id,
      type: memories.type,
      title: memories.title,
      thumbKey: captures.thumbKey,
      mime: captures.mime,
      srcId: memoryLinks.srcMemoryId,
      dstId: memoryLinks.dstMemoryId,
    })
    .from(memoryLinks)
    .innerJoin(
      memories,
      or(
        and(eq(memoryLinks.srcMemoryId, memoryId), eq(memories.id, memoryLinks.dstMemoryId)),
        and(eq(memoryLinks.dstMemoryId, memoryId), eq(memories.id, memoryLinks.srcMemoryId)),
      )!,
    )
    .innerJoin(captures, eq(captures.id, memories.captureId))
    .where(
      and(
        eq(memories.userId, userId),
        isNull(memories.deletedAt),
        or(eq(memoryLinks.srcMemoryId, memoryId), eq(memoryLinks.dstMemoryId, memoryId)),
      ),
    );

  const seen = new Set<string>();
  const out: LinkedMemory[] = [];
  for (const r of rows) {
    if (r.id === memoryId || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({ id: r.id, type: r.type, title: r.title, thumbKey: r.thumbKey, mime: r.mime });
  }
  return out;
}

/* -------------------------------- folders ------------------------------- */

export type FolderRow = {
  id: string;
  parentId: string | null;
  name: string;
  position: number;
  color: string | null;
  emoji: string | null;
  count: number; // memories filed directly in this folder
};

const MAX_FOLDER_DEPTH = 4;

/** Flat list of the user's folders with direct-memory counts. The caller
 * builds the tree. */
export async function listFolders(userId: string): Promise<FolderRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: folders.id,
      parentId: folders.parentId,
      name: folders.name,
      position: folders.position,
      color: folders.color,
      emoji: folders.emoji,
      count: sql<number>`(select count(*)::int from memories m
        where m.folder_id = ${folders.id} and m.deleted_at is null)`,
    })
    .from(folders)
    .where(eq(folders.userId, userId))
    .orderBy(folders.position, folders.name);
  return rows;
}

/** Count of memories with no folder ("Unfiled"). */
export async function countUnfiledMemories(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(memories)
    .where(
      and(eq(memories.userId, userId), isNull(memories.deletedAt), isNull(memories.folderId)),
    );
  return row?.n ?? 0;
}

async function folderDepth(userId: string, id: string): Promise<number> {
  const db = getDb();
  const all = await db
    .select({ id: folders.id, parentId: folders.parentId })
    .from(folders)
    .where(eq(folders.userId, userId));
  const byId = new Map(all.map((f) => [f.id, f.parentId]));
  let depth = 1;
  let cur: string | null = id;
  const seen = new Set<string>();
  while (cur && byId.get(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = byId.get(cur) ?? null;
    depth++;
    if (depth > 32) break;
  }
  return depth;
}

/** IDs of a folder plus every descendant (for "include subfolders"), scoped
 * to `userId`. Returns [] if `rootId` isn't one of this user's folders. */
export async function folderSubtreeIds(userId: string, rootId: string): Promise<string[]> {
  const db = getDb();
  const all = await db
    .select({ id: folders.id, parentId: folders.parentId })
    .from(folders)
    .where(eq(folders.userId, userId));
  const owned = new Set(all.map((f) => f.id));
  if (!owned.has(rootId)) return [];

  const children = new Map<string, string[]>();
  for (const f of all) {
    if (!f.parentId) continue;
    const arr = children.get(f.parentId) ?? [];
    arr.push(f.id);
    children.set(f.parentId, arr);
  }
  const out: string[] = [];
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const c of children.get(id) ?? []) stack.push(c);
  }
  return out;
}

/** A short emoji (1 grapheme-ish) or null. */
function cleanEmoji(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s && s.length <= 8 ? s : null;
}
/** A #rrggbb hex or null. */
function cleanColor(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
}

export async function createFolder(
  userId: string,
  input: { name: string; parentId?: string | null; color?: string | null; emoji?: string | null },
): Promise<{ id: string } | { error: string }> {
  const db = getDb();
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Name required." };

  const parentId: string | null = input.parentId ?? null;
  if (parentId) {
    const [parent] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, parentId), eq(folders.userId, userId)))
      .limit(1);
    if (!parent) return { error: "Parent folder not found." };
    if ((await folderDepth(userId, parentId)) >= MAX_FOLDER_DEPTH) {
      return { error: `Folders can only nest ${MAX_FOLDER_DEPTH} levels deep.` };
    }
  }

  const id = newId();
  const [row] = await db
    .insert(folders)
    .values({
      id,
      userId,
      name,
      parentId,
      color: cleanColor(input.color),
      emoji: cleanEmoji(input.emoji),
    })
    .onConflictDoNothing()
    .returning({ id: folders.id });
  if (!row) return { error: "A folder with that name already exists here." };
  return { id: row.id };
}

/** Find a top-level folder by (case-insensitive) name, creating it if absent.
 * Used for auto-filing captures from an external source (e.g. the Telegram
 * bot). Race-safe via the (user_id, coalesce(parent_id,''), lower(name))
 * unique index. Returns null only if the name is empty or a DB error swallows
 * both the insert and the re-read. */
export async function getOrCreateFolder(
  userId: string,
  name: string,
  opts: { emoji?: string | null; color?: string | null } = {},
): Promise<string | null> {
  const db = getDb();
  const clean = name.trim().slice(0, 80);
  if (!clean) return null;
  const find = () =>
    db
      .select({ id: folders.id })
      .from(folders)
      .where(
        and(
          eq(folders.userId, userId),
          isNull(folders.parentId),
          sql`lower(${folders.name}) = lower(${clean})`,
        ),
      )
      .limit(1);
  const [existing] = await find();
  if (existing) return existing.id;
  const [row] = await db
    .insert(folders)
    .values({
      id: newId(),
      userId,
      name: clean,
      emoji: cleanEmoji(opts.emoji),
      color: cleanColor(opts.color),
    })
    .onConflictDoNothing()
    .returning({ id: folders.id });
  if (row) return row.id;
  const [again] = await find(); // lost a create race — read the winner
  return again?.id ?? null;
}

/** Set a folder's colour and/or emoji. Pass null to clear one. */
export async function updateFolderStyle(
  userId: string,
  id: string,
  style: { color?: string | null; emoji?: string | null },
): Promise<{ ok: boolean }> {
  const db = getDb();
  const patch: Record<string, string | null> = {};
  if ("color" in style) patch.color = cleanColor(style.color);
  if ("emoji" in style) patch.emoji = cleanEmoji(style.emoji);
  if (Object.keys(patch).length === 0) return { ok: true };
  const res = await db
    .update(folders)
    .set(patch)
    .where(and(eq(folders.id, id), eq(folders.userId, userId)));
  return { ok: (res as unknown as { count?: number }).count !== 0 };
}

export async function renameFolder(
  userId: string,
  id: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const clean = name.trim().slice(0, 80);
  if (!clean) return { ok: false, error: "Name required." };
  try {
    const res = await db
      .update(folders)
      .set({ name: clean })
      .where(and(eq(folders.id, id), eq(folders.userId, userId)));
    return { ok: (res as unknown as { count?: number }).count !== 0 };
  } catch {
    return { ok: false, error: "A folder with that name already exists here." };
  }
}

export async function moveFolder(
  userId: string,
  id: string,
  parentId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (parentId === id) return { ok: false, error: "A folder can't be its own parent." };
  if (parentId) {
    const subtree = await folderSubtreeIds(userId, id);
    if (subtree.includes(parentId)) {
      return { ok: false, error: "Can't move a folder inside itself." };
    }
    if ((await folderDepth(userId, parentId)) >= MAX_FOLDER_DEPTH) {
      return { ok: false, error: `Folders can only nest ${MAX_FOLDER_DEPTH} levels deep.` };
    }
  }
  const res = await db
    .update(folders)
    .set({ parentId })
    .where(and(eq(folders.id, id), eq(folders.userId, userId)));
  return { ok: (res as unknown as { count?: number }).count !== 0 };
}

/** Delete a folder. FK `on delete set null` moves its memories to Unfiled
 * and its subfolders to top level — nothing is destroyed. */
export async function deleteFolder(userId: string, id: string): Promise<void> {
  const db = getDb();
  await db.delete(folders).where(and(eq(folders.id, id), eq(folders.userId, userId)));
}

/** Folders as `{ id, path }` ("College > Physics"), for the AI suggester. */
export async function listFolderPaths(userId: string): Promise<{ id: string; path: string }[]> {
  const db = getDb();
  const all = await db
    .select({ id: folders.id, parentId: folders.parentId, name: folders.name })
    .from(folders)
    .where(eq(folders.userId, userId));
  const byId = new Map(all.map((f) => [f.id, f]));
  const pathOf = (id: string): string => {
    const parts: string[] = [];
    let cur = byId.get(id);
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      parts.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts.join(" > ");
  };
  return all.map((f) => ({ id: f.id, path: pathOf(f.id) }));
}

/** Store an unapplied AI folder suggestion (only if the memory is still
 * unfiled — a capture-time choice always wins). */
export async function setSuggestedFolder(
  userId: string,
  memoryId: string,
  folderId: string | null,
): Promise<void> {
  const db = getDb();
  await db
    .update(memories)
    .set({ suggestedFolderId: folderId })
    .where(
      and(
        eq(memories.id, memoryId),
        eq(memories.userId, userId),
        isNull(memories.folderId),
      ),
    );
}

/** Dismiss the AI suggestion without filing. */
export async function clearSuggestedFolder(userId: string, memoryId: string): Promise<void> {
  const db = getDb();
  await db
    .update(memories)
    .set({ suggestedFolderId: null })
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)));
}

export async function setMemoryFolder(
  userId: string,
  memoryIds: string[],
  folderId: string | null,
): Promise<number> {
  const db = getDb();
  const ids = [...new Set(memoryIds)].filter(Boolean).slice(0, 200);
  if (ids.length === 0) return 0;
  if (folderId) {
    const [f] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
      .limit(1);
    if (!f) return 0;
  }
  const res = await db
    .update(memories)
    .set({ folderId, suggestedFolderId: null, updatedAt: new Date() })
    .where(and(inArray(memories.id, ids), eq(memories.userId, userId)));
  return (res as unknown as { count?: number }).count ?? ids.length;
}

/* ------------------------------ retrieval ------------------------------ */

export type RetrievedChunk = {
  chunkId: string;
  memoryId: string;
  content: string;
  kind: string;
  type: MemoryType;
  title: string;
  summary: string;
  capturedAt: Date;
  thumbKey: string;
  mime: string;
  sim: number;
};

export async function searchChunks(
  userId: string,
  queryVec: number[],
  opts: { after?: Date; before?: Date; types?: MemoryType[]; limit?: number } = {},
): Promise<RetrievedChunk[]> {
  const db = getDb();
  const vecLit = `[${queryVec.join(",")}]`;
  const limit = Math.min(opts.limit ?? 24, 60);

  const conds = [sql`c.user_id = ${userId}`, sql`m.deleted_at is null`];
  if (opts.after) conds.push(sql`c.captured_at >= ${opts.after.toISOString()}`);
  if (opts.before) conds.push(sql`c.captured_at < ${opts.before.toISOString()}`);
  // Bind each type as its own text param — a JS array passed straight into a
  // raw `sql` template binds as an untyped param that Postgres won't accept on
  // the right of `= any(...)` ("Failed query"), the same class of bug the
  // `.toISOString()` calls above fix for dates. Any type-scoped chat question
  // ("show me the timetable", "which notice…") hit this.
  if (opts.types?.length) {
    conds.push(sql`c.type::text in (${sql.join(
      opts.types.map((t) => sql`${t}`),
      sql`, `,
    )})`);
  }

  const where = sql.join(conds, sql` and `);
  const result = await db.execute<{
    chunk_id: string;
    memory_id: string;
    content: string;
    kind: string;
    type: MemoryType;
    title: string;
    summary: string;
    captured_at: string | Date;
    thumb_key: string;
    mime: string;
    sim: number;
  }>(sql`
    select c.id as chunk_id, c.memory_id, c.content, c.kind,
           m.type, m.title, m.summary, m.captured_at,
           cap.thumb_key, cap.mime,
           1 - (e.embedding <=> ${vecLit}::vector) as sim
    from embeddings e
    join chunks c on c.id = e.chunk_id
    join memories m on m.id = c.memory_id
    join captures cap on cap.id = m.capture_id
    where ${where}
    order by e.embedding <=> ${vecLit}::vector
    limit ${limit}
  `);

  const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
  return (rows as Record<string, unknown>[]).map((r) => ({
    chunkId: String(r.chunk_id),
    memoryId: String(r.memory_id),
    content: String(r.content),
    kind: String(r.kind),
    type: r.type as MemoryType,
    title: String(r.title),
    summary: String(r.summary),
    capturedAt: new Date(r.captured_at as string),
    thumbKey: String(r.thumb_key),
    mime: String(r.mime),
    sim: Number(r.sim),
  }));
}

/* ------------------------------ chat sessions ------------------------------ */

export async function listChatSessions(userId: string, limit = 30) {
  const db = getDb();
  return db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      updatedAt: chatSessions.updatedAt,
    })
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(limit);
}

/** How many questions this user has asked since `since` — cheap rolling-window
 * rate limit for /api/chat, using the table we already write. */
export async function countChatMessagesSince(userId: string, since: Date): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.role, "user"),
        gte(chatMessages.createdAt, since),
      ),
    );
  return row?.n ?? 0;
}

export async function createChatSession(userId: string, title = "New chat") {
  const db = getDb();
  const id = newId();
  await db.insert(chatSessions).values({ id, userId, title });
  return id;
}

export async function assertSessionOwner(userId: string, sessionId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: chatSessions.id, title: chatSessions.title })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getChatMessages(userId: string, sessionId: string) {
  const db = getDb();
  return db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      citations: chatMessages.citations,
      usedFilters: chatMessages.usedFilters,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.userId, userId)))
    .orderBy(chatMessages.createdAt);
}

export async function appendChatMessages(
  userId: string,
  sessionId: string,
  rows: {
    role: "user" | "assistant";
    content: string;
    citations?: unknown;
    usedFilters?: unknown;
    retrievalDebug?: unknown;
  }[],
) {
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const r of rows) {
      await tx.insert(chatMessages).values({
        id: newId(),
        sessionId,
        userId,
        role: r.role,
        content: r.content,
        citations: r.citations ?? [],
        usedFilters: r.usedFilters ?? {},
        retrievalDebug: r.retrievalDebug ?? {},
      });
    }
    await tx
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  });
}

export async function maybeTitleSession(userId: string, sessionId: string, firstMessage: string) {
  const db = getDb();
  const [s] = await db
    .select({ title: chatSessions.title })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  if (!s || s.title !== "New chat") return;
  const title = firstMessage.replace(/\s+/g, " ").trim().slice(0, 60);
  await db
    .update(chatSessions)
    .set({ title: title || "New chat" })
    .where(eq(chatSessions.id, sessionId));
}

export async function deleteChatSession(userId: string, sessionId: string) {
  const db = getDb();
  await db
    .delete(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
}

/* ----------------------------- notifications --------------------------- */

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/** Insert a notification; a matching `dedupeKey` for this user is a no-op. */
export async function addNotification(input: {
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
  dedupeKey?: string | null;
}): Promise<void> {
  const db = getDb();
  await db
    .insert(notifications)
    .values({
      id: newId(),
      userId: input.userId,
      kind: input.kind,
      title: input.title.slice(0, 200),
      body: input.body?.slice(0, 500) ?? null,
      href: input.href ?? null,
      dedupeKey: input.dedupeKey ?? null,
    })
    .onConflictDoNothing();
}

export async function listNotifications(userId: string, limit = 30): Promise<NotificationRow[]> {
  const db = getDb();
  return db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

/** Mark specific notifications read, or all of the user's if `ids` is omitted. */
export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  const db = getDb();
  const where = ids?.length
    ? and(eq(notifications.userId, userId), inArray(notifications.id, ids))
    : and(eq(notifications.userId, userId), isNull(notifications.readAt));
  await db.update(notifications).set({ readAt: new Date() }).where(where);
}

/* ------------------------------ today / digest --------------------------- */

export async function listMemoriesBetween(userId: string, after: Date, before: Date) {
  const db = getDb();
  return db
    .select({
      id: memories.id,
      type: memories.type,
      title: memories.title,
      summary: memories.summary,
      capturedAt: memories.capturedAt,
      thumbKey: captures.thumbKey,
    })
    .from(memories)
    .innerJoin(captures, eq(captures.id, memories.captureId))
    .where(
      and(
        eq(memories.userId, userId),
        isNull(memories.deletedAt),
        gte(memories.capturedAt, after),
        lt(memories.capturedAt, before),
      ),
    )
    .orderBy(desc(memories.capturedAt));
}

/** Memories the reader flagged as poorly read (`ocr_confidence = low`) that
 * haven't been corrected yet — the review queue. */
export async function listMemoriesNeedingReview(
  userId: string,
  limit = 20,
): Promise<{ id: string; type: MemoryType; title: string; summary: string; capturedAt: Date }[]> {
  const db = getDb();
  return db
    .select({
      id: memories.id,
      type: memories.type,
      title: memories.title,
      summary: memories.summary,
      capturedAt: memories.capturedAt,
    })
    .from(memories)
    .where(
      and(
        eq(memories.userId, userId),
        isNull(memories.deletedAt),
        eq(memories.ocrConfidence, "low"),
        isNull(memories.correctedText),
      ),
    )
    .orderBy(desc(memories.capturedAt))
    .limit(limit);
}

/** Count for the review queue (nav badge). */
export async function countMemoriesNeedingReview(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(memories)
    .where(
      and(
        eq(memories.userId, userId),
        isNull(memories.deletedAt),
        eq(memories.ocrConfidence, "low"),
        isNull(memories.correctedText),
      ),
    );
  return row?.n ?? 0;
}

export type ActionItemRow = {
  id: string;
  title: string;
  dueAt: Date | null;
  status: "open" | "done" | "dismissed";
  memoryId: string;
  memoryTitle: string;
  thumbKey: string;
};

export async function listActionItems(
  userId: string,
  opts: { status?: "open" | "done" | "dismissed"; limit?: number } = {},
): Promise<ActionItemRow[]> {
  const db = getDb();
  const conds = [eq(actionItems.userId, userId), isNull(memories.deletedAt)];
  if (opts.status) conds.push(eq(actionItems.status, opts.status));
  const rows = await db
    .select({
      id: actionItems.id,
      title: actionItems.title,
      dueAt: actionItems.dueAt,
      status: actionItems.status,
      memoryId: actionItems.memoryId,
      memoryTitle: memories.title,
      thumbKey: captures.thumbKey,
    })
    .from(actionItems)
    .innerJoin(memories, eq(memories.id, actionItems.memoryId))
    .innerJoin(captures, eq(captures.id, memories.captureId))
    .where(and(...conds))
    .orderBy(sql`${actionItems.dueAt} asc nulls last`, desc(actionItems.createdAt))
    .limit(Math.min(opts.limit ?? 100, 200));
  return rows as ActionItemRow[];
}

export async function setActionItemStatus(
  userId: string,
  id: string,
  status: "open" | "done" | "dismissed",
) {
  const db = getDb();
  const res = await db
    .update(actionItems)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(actionItems.id, id), eq(actionItems.userId, userId)));
  return (res as unknown as { count?: number }).count !== 0;
}

/* ------------------------------ deadlines -------------------------------- */

export type NewDeadline = {
  id: string;
  userId: string;
  title: string;
  dueAt: Date | null;
  status?: "pending" | "done";
  source?: "manual" | "whatsapp" | "call";
  sourceRefId?: string | null;
  confidence?: number | null;
};

export async function insertDeadline(row: NewDeadline) {
  const db = getDb();
  await db.insert(deadlines).values({
    id: row.id,
    userId: row.userId,
    title: row.title,
    dueAt: row.dueAt,
    status: row.status ?? "pending",
    source: row.source ?? "manual",
    sourceRefId: row.sourceRefId ?? null,
    confidence: row.confidence ?? null,
  });
}

export async function listDeadlines(
  userId: string,
  opts: { status?: "pending" | "done"; before?: Date; limit?: number } = {},
) {
  const db = getDb();
  const conds = [eq(deadlines.userId, userId)];
  if (opts.status) conds.push(eq(deadlines.status, opts.status));
  if (opts.before) conds.push(lte(deadlines.dueAt, opts.before));
  return db
    .select()
    .from(deadlines)
    .where(and(...conds))
    .orderBy(sql`${deadlines.dueAt} asc nulls last`, desc(deadlines.createdAt))
    .limit(Math.min(opts.limit ?? 100, 200));
}

export async function setDeadlineStatus(
  userId: string,
  id: string,
  status: "pending" | "done",
): Promise<boolean> {
  const db = getDb();
  const res = await db
    .update(deadlines)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(deadlines.id, id), eq(deadlines.userId, userId)));
  return (res as unknown as { count?: number }).count !== 0;
}

/* -------------------------- finance tracking ------------------------------ */

export type NewFinanceTransaction = {
  id: string;
  userId: string;
  occurredOn: string; // YYYY-MM-DD
  amount: string; // decimal string
  direction: "income" | "expense";
  category: string;
  categoryConfidence?: number | null;
  merchant?: string | null;
  note?: string | null;
  source?: "manual" | "statement_upload";
  statementBatchId?: string | null;
};

export async function addFinanceTransaction(row: NewFinanceTransaction) {
  const db = getDb();
  await db.insert(financeTransactions).values({
    id: row.id,
    userId: row.userId,
    occurredOn: row.occurredOn,
    amount: row.amount,
    direction: row.direction,
    category: row.category,
    categoryConfidence: row.categoryConfidence ?? null,
    merchant: row.merchant ?? null,
    note: row.note ?? null,
    source: row.source ?? "manual",
    statementBatchId: row.statementBatchId ?? null,
  });
}

/** Insert a batch of statement rows, skipping any that collide with the
 * dedupe unique index (same user/date/amount/direction/merchant/batch) so a
 * re-uploaded statement doesn't double-count. Returns the number inserted. */
export async function insertFinanceTransactionsBatch(
  rows: NewFinanceTransaction[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const db = getDb();
  const res = await db
    .insert(financeTransactions)
    .values(
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        occurredOn: row.occurredOn,
        amount: row.amount,
        direction: row.direction,
        category: row.category,
        categoryConfidence: row.categoryConfidence ?? null,
        merchant: row.merchant ?? null,
        note: row.note ?? null,
        source: row.source ?? "statement_upload",
        statementBatchId: row.statementBatchId ?? null,
      })),
    )
    .onConflictDoNothing();
  return (res as unknown as { count?: number }).count ?? rows.length;
}

export async function listFinanceTransactions(
  userId: string,
  opts: { category?: string; source?: "manual" | "statement_upload"; limit?: number } = {},
) {
  const db = getDb();
  const conds = [eq(financeTransactions.userId, userId)];
  if (opts.category) conds.push(eq(financeTransactions.category, opts.category));
  if (opts.source) conds.push(eq(financeTransactions.source, opts.source));
  return db
    .select()
    .from(financeTransactions)
    .where(and(...conds))
    .orderBy(desc(financeTransactions.occurredOn), desc(financeTransactions.createdAt))
    .limit(Math.min(opts.limit ?? 200, 500));
}

export async function createStatementBatch(row: {
  id: string;
  userId: string;
  accountLabel: string;
  fileName: string;
}) {
  const db = getDb();
  await db.insert(financeStatementBatches).values({ ...row, status: "processing" });
}

export async function finishStatementBatch(
  id: string,
  patch: { status: "done" | "failed"; rowCount?: number; errorDetail?: string | null },
) {
  const db = getDb();
  await db
    .update(financeStatementBatches)
    .set({ status: patch.status, rowCount: patch.rowCount ?? 0, errorDetail: patch.errorDetail ?? null })
    .where(eq(financeStatementBatches.id, id));
}

export async function listStatementBatches(userId: string, limit = 20) {
  const db = getDb();
  return db
    .select()
    .from(financeStatementBatches)
    .where(eq(financeStatementBatches.userId, userId))
    .orderBy(desc(financeStatementBatches.createdAt))
    .limit(limit);
}

/** Category totals for a given month (YYYY-MM), expenses only. */
export async function getSpendingSummary(userId: string, month: string) {
  const db = getDb();
  const rows = await db
    .select({
      category: financeTransactions.category,
      total: sql<string>`sum(${financeTransactions.amount})`,
      count: sql<number>`count(*)::int`,
    })
    .from(financeTransactions)
    .where(
      and(
        eq(financeTransactions.userId, userId),
        eq(financeTransactions.direction, "expense"),
        sql`to_char(${financeTransactions.occurredOn}, 'YYYY-MM') = ${month}`,
      ),
    )
    .groupBy(financeTransactions.category)
    .orderBy(sql`sum(${financeTransactions.amount}) desc`);
  return rows;
}

/* -------------------------- calling assistant ------------------------------ */

export type NewCall = {
  id: string;
  userId: string;
  direction: "inbound" | "outbound";
  counterpart: string;
  purpose?: string | null;
  instructions?: string | null;
  providerCallSid?: string | null;
};

export async function insertCall(row: NewCall) {
  const db = getDb();
  await db.insert(calls).values({
    id: row.id,
    userId: row.userId,
    direction: row.direction,
    counterpart: row.counterpart,
    status: "in_progress",
    purpose: row.purpose ?? null,
    instructions: row.instructions ?? null,
    providerCallSid: row.providerCallSid ?? null,
  });
}

export async function listCalls(userId: string, limit = 50) {
  const db = getDb();
  return db.select().from(calls).where(eq(calls.userId, userId)).orderBy(desc(calls.createdAt)).limit(limit);
}

/** No userId filter — only for the Twilio webhook, which authenticates via
 * the request signature (lib/twilio.ts validateTwilioSignature), not a user
 * session, and only needs purpose/instructions to build TwiML. */
export async function getCallById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(calls).where(eq(calls.id, id));
  return row ?? null;
}

export async function getCall(userId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(calls)
    .where(and(eq(calls.id, id), eq(calls.userId, userId)));
  return row ?? null;
}

export async function setCallProviderSid(id: string, sid: string) {
  const db = getDb();
  await db.update(calls).set({ providerCallSid: sid, updatedAt: new Date() }).where(eq(calls.id, id));
}

export async function finishCall(
  id: string,
  patch: {
    status: "completed" | "missed" | "voicemail" | "failed";
    transcript?: unknown[];
    summary?: string | null;
    extractedTasks?: unknown[];
    durationSec?: number | null;
  },
) {
  const db = getDb();
  await db
    .update(calls)
    .set({
      status: patch.status,
      transcript: patch.transcript ?? [],
      summary: patch.summary ?? null,
      extractedTasks: patch.extractedTasks ?? [],
      durationSec: patch.durationSec ?? null,
      updatedAt: new Date(),
    })
    .where(eq(calls.id, id));
}

/* --------------------------- whatsapp triage ------------------------------- */

export type NewWhatsappMessage = {
  id: string;
  userId: string;
  chatId: string;
  chatName?: string | null;
  sender?: string | null;
  direction?: string;
  text: string;
  category: "important" | "deadline" | "routine" | "promotional" | "filtered";
  reason?: string | null;
  isDeadline?: boolean;
  deadlineId?: string | null;
  occurredAt: Date;
};

export async function insertWhatsappMessage(row: NewWhatsappMessage) {
  const db = getDb();
  await db.insert(whatsappMessages).values({
    id: row.id,
    userId: row.userId,
    chatId: row.chatId,
    chatName: row.chatName ?? null,
    sender: row.sender ?? null,
    direction: row.direction ?? "in",
    text: row.text,
    category: row.category,
    reason: row.reason ?? null,
    isDeadline: row.isDeadline ?? false,
    deadlineId: row.deadlineId ?? null,
    occurredAt: row.occurredAt,
  });
}

export async function listWhatsappMessages(
  userId: string,
  opts: { category?: "important" | "deadline" | "routine" | "promotional" | "filtered"; limit?: number } = {},
) {
  const db = getDb();
  const conds = [eq(whatsappMessages.userId, userId)];
  if (opts.category) conds.push(eq(whatsappMessages.category, opts.category));
  return db
    .select()
    .from(whatsappMessages)
    .where(and(...conds))
    .orderBy(desc(whatsappMessages.occurredAt))
    .limit(Math.min(opts.limit ?? 100, 300));
}

export async function getWhatsappFilterRules(userId: string) {
  const db = getDb();
  return db.select().from(whatsappFilterRules).where(eq(whatsappFilterRules.userId, userId));
}

export async function setWhatsappFilterRule(
  userId: string,
  chatId: string,
  action: "mute" | "always_flag",
) {
  const db = getDb();
  await db
    .insert(whatsappFilterRules)
    .values({ id: newId(), userId, chatId, action })
    .onConflictDoUpdate({
      target: [whatsappFilterRules.userId, whatsappFilterRules.chatId],
      set: { action },
    });
}

/* --------------------------- caps / recovery ---------------------------- */

export async function countCapturesSince(userId: string, since: Date): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(captures)
    .where(and(eq(captures.userId, userId), gte(captures.createdAt, since)));
  return row?.n ?? 0;
}

/** Non-terminal captures whose status hasn't moved in `cutoffMs`. */
export async function findStuckCaptures(cutoffMs: number, limit = 25) {
  const db = getDb();
  const before = new Date(Date.now() - cutoffMs);
  return db
    .select({ id: captures.id, userId: captures.userId, status: captures.status })
    .from(captures)
    .where(
      and(
        inArray(captures.status, ["queued", "extracting", "embedding"]),
        lt(captures.updatedAt, before),
      ),
    )
    .orderBy(captures.updatedAt)
    .limit(limit);
}

export async function findStuckCapturesForUser(userId: string, cutoffMs: number) {
  const db = getDb();
  const before = new Date(Date.now() - cutoffMs);
  return db
    .select({ id: captures.id })
    .from(captures)
    .where(
      and(
        eq(captures.userId, userId),
        inArray(captures.status, ["queued", "extracting", "embedding"]),
        lt(captures.updatedAt, before),
      ),
    )
    .limit(10);
}

/* ----------------------------- api tokens ---------------------------- */

export type ApiTokenRow = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export async function createApiToken(
  userId: string,
  name: string,
  hash: string,
  prefix: string,
): Promise<string> {
  const db = getDb();
  const id = newId();
  await db.insert(apiTokens).values({ id, userId, name: name.slice(0, 60) || "API token", tokenHash: hash, prefix });
  return id;
}

export async function listApiTokens(userId: string): Promise<ApiTokenRow[]> {
  const db = getDb();
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.prefix,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.createdAt));
}

export async function revokeApiToken(userId: string, id: string): Promise<boolean> {
  const db = getDb();
  const res = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));
  return (res as unknown as { count?: number }).count !== 0;
}

/** Resolve a token hash to its owner. Touches last_used_at (fire-and-forget). */
export async function resolveApiToken(
  hash: string,
): Promise<{ userId: string; tokenId: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId })
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hash), isNull(apiTokens.revokedAt)))
    .limit(1);
  if (!row) return null;
  void db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, row.id))
    .catch(() => {});
  return { userId: row.userId, tokenId: row.id };
}

/* ------------------------------ webhooks ----------------------------- */

export type WebhookRow = {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  failureCount: number;
  lastStatus: number | null;
  lastDeliveryAt: Date | null;
  createdAt: Date;
};

export async function createWebhook(
  userId: string,
  url: string,
  secret: string,
  events: string[],
): Promise<string> {
  const db = getDb();
  const id = newId();
  await db.insert(webhooks).values({ id, userId, url, secret, events });
  return id;
}

export async function listWebhooks(userId: string): Promise<WebhookRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      secret: webhooks.secret,
      events: webhooks.events,
      active: webhooks.active,
      failureCount: webhooks.failureCount,
      lastStatus: webhooks.lastStatus,
      lastDeliveryAt: webhooks.lastDeliveryAt,
      createdAt: webhooks.createdAt,
    })
    .from(webhooks)
    .where(eq(webhooks.userId, userId))
    .orderBy(desc(webhooks.createdAt));
  return rows as WebhookRow[];
}

export async function deleteWebhook(userId: string, id: string): Promise<void> {
  const db = getDb();
  await db.delete(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)));
}

/** Active hooks for a user subscribed to `event` (or "*"). */
export async function webhooksForEvent(
  userId: string,
  event: string,
): Promise<{ id: string; url: string; secret: string }[]> {
  const db = getDb();
  const rows = await db
    .select({ id: webhooks.id, url: webhooks.url, secret: webhooks.secret, events: webhooks.events })
    .from(webhooks)
    .where(and(eq(webhooks.userId, userId), eq(webhooks.active, true)));
  return rows
    .filter((r) => {
      const evs = (r.events as string[]) ?? [];
      return evs.includes("*") || evs.includes(event);
    })
    .map(({ id, url, secret }) => ({ id, url, secret }));
}

export async function recordWebhookResult(id: string, status: number, ok: boolean): Promise<void> {
  const db = getDb();
  await db
    .update(webhooks)
    .set({
      lastStatus: status,
      lastDeliveryAt: new Date(),
      failureCount: ok ? 0 : sql`${webhooks.failureCount} + 1`,
      active: ok ? true : sql`case when ${webhooks.failureCount} + 1 >= 15 then false else ${webhooks.active} end`,
    })
    .where(eq(webhooks.id, id));
}

/* --------------------- shared daily AI-call budget -------------------- */

/** Record N successful Gemini calls against the given IST-day bucket. Atomic
 * upsert-increment; safe to call concurrently. */
export async function bumpAiCalls(bucketStart: Date, n = 1): Promise<void> {
  if (n <= 0) return;
  const db = getDb();
  await db
    .insert(aiCallLog)
    .values({ bucketStart, calls: n, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: aiCallLog.bucketStart,
      set: { calls: sql`${aiCallLog.calls} + ${n}`, updatedAt: new Date() },
    });
}

export async function getAiCallsInBucket(bucketStart: Date): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: aiCallLog.calls })
    .from(aiCallLog)
    .where(eq(aiCallLog.bucketStart, bucketStart));
  return row?.n ?? 0;
}

/* --------------------------- user seat count ------------------------- */

/** The read-only demo account never counts toward the MAX_USERS seat cap. */
const notDemo = DEMO_USER_ID ? sql`${profiles.id} <> ${DEMO_USER_ID}` : undefined;

export async function countProfiles(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(notDemo);
  return row?.n ?? 0;
}

/** Total registered users excluding one id (used at the OAuth door, where the
 * new user's profile row may already have been inserted by the sync trigger). */
export async function countProfilesExcluding(id: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(and(sql`${profiles.id} <> ${id}`, notDemo));
  return row?.n ?? 0;
}

export async function emailHasProfile(email: string): Promise<boolean> {
  const db = getDb();
  const norm = email.trim().toLowerCase();
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(sql`lower(${profiles.email}) = ${norm}`)
    .limit(1);
  return !!row;
}

/* ------------------------------ telegram --------------------------- */

/** Start (or refresh) a link: store a one-time code for this user. */
export async function setTelegramLinkCode(
  userId: string,
  code: string,
  expires: Date,
): Promise<void> {
  const db = getDb();
  await db
    .insert(telegramLinks)
    .values({ userId, linkCode: code, linkCodeExpires: expires })
    .onConflictDoUpdate({
      target: telegramLinks.userId,
      set: { linkCode: code, linkCodeExpires: expires },
    });
}

/** Redeem a code from the bot's /start handler → bind the chat id. */
export async function redeemTelegramCode(
  code: string,
  chatId: string,
): Promise<{ userId: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ userId: telegramLinks.userId, exp: telegramLinks.linkCodeExpires })
    .from(telegramLinks)
    .where(eq(telegramLinks.linkCode, code))
    .limit(1);
  if (!row || !row.exp || row.exp.getTime() < Date.now()) return null;
  await db
    .update(telegramLinks)
    .set({ chatId, linkCode: null, linkCodeExpires: null, linkedAt: new Date() })
    .where(eq(telegramLinks.userId, row.userId));
  return { userId: row.userId };
}

export async function userIdForTelegramChat(chatId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ userId: telegramLinks.userId })
    .from(telegramLinks)
    .where(eq(telegramLinks.chatId, chatId))
    .limit(1);
  return row?.userId ?? null;
}

export async function getTelegramLink(
  userId: string,
): Promise<{ linked: boolean } | null> {
  const db = getDb();
  const [row] = await db
    .select({ chatId: telegramLinks.chatId })
    .from(telegramLinks)
    .where(eq(telegramLinks.userId, userId))
    .limit(1);
  if (!row) return null;
  return { linked: !!row.chatId };
}

export async function unlinkTelegram(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(telegramLinks).where(eq(telegramLinks.userId, userId));
}

/* ------------------------- push subscriptions ----------------------- */

export async function savePushSubscription(
  userId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  const db = getDb();
  await db
    .insert(pushSubscriptions)
    .values({ id: newId(), userId, ...sub })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.p256dh, auth: sub.auth },
    });
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  const db = getDb();
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function listPushSubscriptions(
  userId: string,
): Promise<{ endpoint: string; p256dh: string; auth: string }[]> {
  const db = getDb();
  return db
    .select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

export async function dropPushEndpoints(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const db = getDb();
  await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, endpoints));
}

/* ------------------------------ feedback ----------------------------- */

export async function addFeedback(input: {
  userId: string;
  message: string;
  page?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const db = getDb();
  await db.insert(feedback).values({
    id: newId(),
    userId: input.userId,
    message: input.message.slice(0, 4000),
    page: input.page?.slice(0, 200) ?? null,
    userAgent: input.userAgent?.slice(0, 400) ?? null,
  });
}

export type FeedbackRow = {
  id: string;
  message: string;
  page: string | null;
  email: string | null;
  createdAt: Date;
};

export async function listFeedback(limit = 100): Promise<FeedbackRow[]> {
  const db = getDb();
  return db
    .select({
      id: feedback.id,
      message: feedback.message,
      page: feedback.page,
      email: profiles.email,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .leftJoin(profiles, eq(profiles.id, feedback.userId))
    .orderBy(desc(feedback.createdAt))
    .limit(Math.min(limit, 300));
}

/** The owner's user id (for routing notifications). Null if OWNER_EMAIL unset
 * or no matching profile. */
export async function ownerUserId(): Promise<string | null> {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(sql`lower(${profiles.email}) = ${email}`)
    .limit(1);
  return row?.id ?? null;
}

/* ----------------------------- allowlist ------------------------------- */

export async function isEmailAllowed(email: string): Promise<boolean> {
  const db = getDb();
  const norm = email.trim().toLowerCase();
  const [row] = await db
    .select({ email: allowedEmails.email })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, norm))
    .limit(1);
  return !!row;
}

export async function listAllowedEmails() {
  const db = getDb();
  return db
    .select()
    .from(allowedEmails)
    .orderBy(desc(allowedEmails.createdAt));
}

/* ----------------------------- members ------------------------------- */

export type Member = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: Date;
};

/** Every registered user, oldest first. Used by the owner's Members page. */
export async function listMembers(): Promise<Member[]> {
  const db = getDb();
  return db
    .select({
      id: profiles.id,
      email: profiles.email,
      displayName: profiles.displayName,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .orderBy(profiles.createdAt);
}

export async function addAllowedEmail(email: string, note: string | null, byUserId: string) {
  const db = getDb();
  const norm = email.trim().toLowerCase();
  await db
    .insert(allowedEmails)
    .values({ email: norm, note, addedBy: byUserId })
    .onConflictDoNothing();
}

export async function removeAllowedEmail(email: string) {
  const db = getDb();
  await db.delete(allowedEmails).where(eq(allowedEmails.email, email.trim().toLowerCase()));
}

/* ------------------------------- prefs -------------------------------- */

export type Prefs = {
  tz: string;
  emailReminders: boolean;
  weeklyDigest: boolean;
};

const DEFAULT_PREFS: Prefs = {
  tz: "Asia/Kolkata",
  emailReminders: true,
  weeklyDigest: true,
};

export async function getPrefs(userId: string): Promise<Prefs> {
  try {
    const db = getDb();
    const [row] = await db
      .select({
        tz: profilePrefs.tz,
        emailReminders: profilePrefs.emailReminders,
        weeklyDigest: profilePrefs.weeklyDigest,
      })
      .from(profilePrefs)
      .where(eq(profilePrefs.userId, userId))
      .limit(1);
    return row ?? DEFAULT_PREFS;
  } catch {
    // profile_prefs table not migrated yet
    return DEFAULT_PREFS;
  }
}

/** Lazily mint (and store) the user's calendar-feed token. Idempotent. */
export async function getOrCreateCalendarToken(userId: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ t: profilePrefs.calendarToken })
    .from(profilePrefs)
    .where(eq(profilePrefs.userId, userId))
    .limit(1);
  if (row?.t) return row.t;
  const token = `${newId()}${newId()}`.toLowerCase(); // 52 chars, unguessable
  await db
    .insert(profilePrefs)
    .values({ userId, calendarToken: token })
    .onConflictDoUpdate({
      target: profilePrefs.userId,
      set: { calendarToken: token, updatedAt: new Date() },
    });
  return token;
}

export async function userIdForCalendarToken(token: string): Promise<string | null> {
  if (!token || token.length < 20) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: profilePrefs.userId })
    .from(profilePrefs)
    .where(eq(profilePrefs.calendarToken, token))
    .limit(1);
  return row?.id ?? null;
}

export async function upsertPrefs(userId: string, p: Prefs) {
  const db = getDb();
  await db
    .insert(profilePrefs)
    .values({ userId, ...p })
    .onConflictDoUpdate({
      target: profilePrefs.userId,
      set: { ...p, updatedAt: new Date() },
    });
}

/* ---------------------------- email: reminders --------------------------- */

export type DigestRecipient = { userId: string; email: string; tz: string };

/** Left join so a user who's never opened Settings (no profile_prefs row yet)
 * still gets emails — profile_prefs.{email_reminders,weekly_digest} both
 * default to true, matching Prefs' DEFAULT_PREFS fallback in getPrefs(). An
 * inner join would silently exclude every user until their first Settings
 * save, contradicting the opt-out (not opt-in) framing of both defaults. */
export async function listUsersForWeeklyDigest(): Promise<DigestRecipient[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: profiles.id,
      email: profiles.email,
      tz: sql<string>`coalesce(${profilePrefs.tz}, ${profiles.tz})`,
    })
    .from(profiles)
    .leftJoin(profilePrefs, eq(profilePrefs.userId, profiles.id))
    .where(
      and(
        sql`coalesce(${profilePrefs.weeklyDigest}, true) = true`,
        sql`${profiles.email} is not null`,
        notDemo,
      ),
    );
  return rows as DigestRecipient[];
}

export async function listUsersForReminders(): Promise<DigestRecipient[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: profiles.id,
      email: profiles.email,
      tz: sql<string>`coalesce(${profilePrefs.tz}, ${profiles.tz})`,
    })
    .from(profiles)
    .leftJoin(profilePrefs, eq(profilePrefs.userId, profiles.id))
    .where(
      and(
        sql`coalesce(${profilePrefs.emailReminders}, true) = true`,
        sql`${profiles.email} is not null`,
        notDemo,
      ),
    );
  return rows as DigestRecipient[];
}

/** Dedupe key for reminder_log — 'due_soon' is keyed by the real action item id;
 * 'weekly_digest' has no natural per-item key, so it reuses the column with a
 * synthetic `${userId}:${isoYearWeek}` value (documented here, not a new
 * migration — the table was already shaped for exactly this kind of dedupe). */
/** Atomically claims a reminder-send slot: the insert either succeeds (no
 * prior row for this key+kind — go ahead and send) or hits the composite PK
 * and inserts nothing (someone already claimed/sent it — skip). Doing this
 * as one insert-with-return, rather than a separate "was it sent" check
 * followed later by "mark it sent", closes the race where two overlapping
 * cron invocations could both pass the check before either marks it. */
export async function claimReminderSlot(key: string, kind: "due_soon" | "weekly_digest"): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .insert(reminderLog)
    .values({ actionItemId: key, kind })
    .onConflictDoNothing()
    .returning({ key: reminderLog.actionItemId });
  return !!row;
}

/** Releases a claimed slot when the send itself failed (no key configured,
 * transient error) so the next run retries instead of skipping forever. */
export async function releaseReminderSlot(key: string, kind: "due_soon" | "weekly_digest"): Promise<void> {
  const db = getDb();
  await db.delete(reminderLog).where(and(eq(reminderLog.actionItemId, key), eq(reminderLog.kind, kind)));
}

/* --------------------------- export / delete -------------------------- */

export async function exportUserData(userId: string) {
  const db = getDb();
  const [mems, ents, tagRows, mtags, actions, sessions, msgs, caps] = await Promise.all([
    db.select().from(memories).where(eq(memories.userId, userId)),
    db.select().from(entities).where(eq(entities.userId, userId)),
    db.select().from(tags).where(eq(tags.userId, userId)),
    db
      .select({ memoryId: memoryTags.memoryId, name: tags.name })
      .from(memoryTags)
      .innerJoin(tags, eq(tags.id, memoryTags.tagId))
      .where(eq(tags.userId, userId)),
    db.select().from(actionItems).where(eq(actionItems.userId, userId)),
    db.select().from(chatSessions).where(eq(chatSessions.userId, userId)),
    db.select().from(chatMessages).where(eq(chatMessages.userId, userId)),
    db.select().from(captures).where(eq(captures.userId, userId)),
  ]);
  return {
    exported_at: new Date().toISOString(),
    counts: {
      memories: mems.length,
      captures: caps.length,
      action_items: actions.length,
      chat_sessions: sessions.length,
    },
    memories: mems,
    entities: ents,
    tags: tagRows,
    memory_tags: mtags,
    action_items: actions,
    chat_sessions: sessions,
    chat_messages: msgs,
    captures: caps,
  };
}

/** Object-storage keys owned by the user (for cleanup on delete). */
/** The storage keys for one memory's capture (original/display/thumb), so a
 * per-memory delete can clean up its files too. */
export async function captureKeysForMemory(
  userId: string,
  memoryId: string,
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ o: captures.originalKey, d: captures.displayKey, t: captures.thumbKey })
    .from(captures)
    .innerJoin(memories, eq(memories.captureId, captures.id))
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
    .limit(1);
  return rows.length ? [...new Set([rows[0].o, rows[0].d, rows[0].t])] : [];
}

export async function listUserObjectKeys(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({
      o: captures.originalKey,
      d: captures.displayKey,
      t: captures.thumbKey,
    })
    .from(captures)
    .where(eq(captures.userId, userId));
  return [...new Set(rows.flatMap((r) => [r.o, r.d, r.t]))];
}

export async function deleteAllUserData(userId: string) {
  const db = getDb();
  // memories cascade to chunks/embeddings/entities/memory_tags/action_items/links.
  await db.transaction(async (tx) => {
    await tx.delete(memories).where(eq(memories.userId, userId));
    await tx.delete(captures).where(eq(captures.userId, userId));
    await tx.delete(tags).where(eq(tags.userId, userId));
    await tx.delete(chatSessions).where(eq(chatSessions.userId, userId));
    await tx.delete(profilePrefs).where(eq(profilePrefs.userId, userId));
  });
}
