import { describe, it, expect, beforeEach, vi } from "vitest";

const MINIMAL = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxxxxxxxxxxxxxxxxx",
};

async function loadEnv(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  for (const k of Object.keys(process.env)) {
    if (/^(NEXT_PUBLIC_|SUPABASE_|DATABASE_|AI_|GEMINI_|GOOGLE_|ANTHROPIC_|OLLAMA_|EMBEDDING_|DRY_RUN)/.test(k)) {
      delete process.env[k];
    }
  }
  Object.assign(process.env, MINIMAL, overrides);
  const mod = await import("./env");
  return mod.getEnv();
}

describe("env schema", () => {
  beforeEach(() => vi.resetModules());

  it("applies defaults when optional vars are absent", async () => {
    const e = await loadEnv({});
    expect(e.AI_PROVIDER).toBe("auto");
    expect(e.GEMINI_MODEL).toBe("gemini-flash-lite-latest");
    expect(e.GEMINI_EMBED_MODEL).toBe("gemini-embedding-001");
    expect(e.EMBEDDING_DIMS).toBe(1024);
    expect(e.DRY_RUN).toBe(false);
  });

  it("treats blank/whitespace values as unset", async () => {
    const e = await loadEnv({
      GEMINI_EMBED_MODEL: "   ",
      NEXT_PUBLIC_SITE_URL: "",
      GOOGLE_API_KEY: "  ",
      OLLAMA_BASE_URL: "",
    });
    expect(e.GEMINI_EMBED_MODEL).toBe("gemini-embedding-001");
    expect(e.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(e.GOOGLE_API_KEY).toBeUndefined();
    expect(e.OLLAMA_BASE_URL).toBe("http://localhost:11434");
  });

  it("normalises AI_PROVIDER and falls back on a bad value", async () => {
    expect((await loadEnv({ AI_PROVIDER: "  Gemini  " })).AI_PROVIDER).toBe("gemini");
    expect((await loadEnv({ AI_PROVIDER: "banana" })).AI_PROVIDER).toBe("auto");
  });

  it("coerces a bad DRY_RUN / EMBEDDING_DIMS to safe defaults", async () => {
    const e = await loadEnv({ DRY_RUN: "yes", EMBEDDING_DIMS: "not-a-number" });
    expect(e.DRY_RUN).toBe(false);
    expect(e.EMBEDDING_DIMS).toBe(1024);
  });

  it("throws when a required var is missing", async () => {
    await expect(loadEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined })).rejects.toThrow(
      /environment variables/i,
    );
  });
});
