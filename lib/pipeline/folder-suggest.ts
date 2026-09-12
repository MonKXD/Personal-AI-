import "server-only";

import { getEnv } from "@/lib/env";
import { aiMode } from "@/lib/ai";
import { FOLDER_SUGGEST_SYSTEM } from "@/lib/ai/prompts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MIN_CONFIDENCE = 0.55;

/**
 * Best-effort: pick the folder a new memory most likely belongs in, for the
 * user to confirm (stored as memories.suggested_folder_id, never applied
 * silently). Returns null unless a real provider is configured, the user has
 * ≥2 folders, and the model is confident — a wrong guess is worse than none.
 */
export async function suggestFolderId(
  folders: { id: string; path: string }[],
  memory: { title: string; summary: string; text: string },
): Promise<string | null> {
  if (folders.length < 2) return null;
  if (aiMode().provider !== "gemini") return null;
  const key = getEnv().GOOGLE_API_KEY;
  if (!key) return null;

  const list = folders.map((f) => `[${f.id}] ${f.path}`).join("\n");
  const user = `FOLDERS:\n${list}\n\nMEMORY:\nTitle: ${memory.title}\nSummary: ${memory.summary}\nText: ${memory.text.slice(0, 1500)}\n\nReturn ONLY: {"folder_id": "<one id above, or null>", "confidence": <0..1>}`;

  try {
    const res = await fetch(
      `${GEMINI_BASE}/models/${getEnv().GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: FOLDER_SUGGEST_SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            maxOutputTokens: 200,
          },
        }),
      },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as {
      folder_id?: unknown;
      confidence?: unknown;
    };
    const id = parsed.folder_id;
    const conf = Number(parsed.confidence ?? 0);
    if (typeof id === "string" && conf >= MIN_CONFIDENCE && folders.some((f) => f.id === id)) {
      return id;
    }
    return null;
  } catch {
    return null;
  }
}
