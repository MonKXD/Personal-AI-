import "server-only";

import { getEmbedder } from "@/lib/ai";
import { chunkMemory } from "./chunk";
import { getMemoryDetail, updateMemoryCorrectedText } from "@/lib/db/queries";

/**
 * Lets a user fix misread text without a new vision call. Re-chunks and
 * re-embeds from the corrected text so chat retrieval picks it up; entities,
 * tags, and action items are left as derived from the original extraction.
 */
export async function correctMemoryText(
  userId: string,
  memoryId: string,
  text: string,
): Promise<boolean> {
  const detail = await getMemoryDetail(userId, memoryId);
  if (!detail) return false;

  const chunkList = chunkMemory({
    title: detail.memory.title,
    summary: detail.memory.summary,
    text,
  });

  const embedder = getEmbedder();
  const vectors = chunkList.length > 0 ? await embedder.embed(chunkList.map((c) => c.content)) : [];

  return updateMemoryCorrectedText(
    userId,
    memoryId,
    text,
    chunkList,
    vectors,
    embedder.model,
    embedder.dims,
  );
}
