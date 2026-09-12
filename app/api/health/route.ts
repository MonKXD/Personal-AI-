import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let ai: unknown = { error: "not resolved" };
  try {
    // Imported lazily so a config error here can't 500 the whole endpoint.
    const { aiMode, getVisionExtractor, getEmbedder } = await import("@/lib/ai");
    const mode = aiMode();
    ai = {
      provider: mode.provider,
      visionModel: getVisionExtractor().model,
      embeddingModel: getEmbedder().model,
      embeddingProvider: mode.embeddings,
    };
  } catch (e) {
    ai = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({
    status: "ok",
    service: "mirrormind-web",
    supabaseConfigured: isSupabaseConfigured,
    ai,
    time: new Date().toISOString(),
  });
}
