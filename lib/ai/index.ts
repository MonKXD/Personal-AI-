import "server-only";

import { getEnv } from "@/lib/env";
import type {
  AudioTranscriber,
  ChatModel,
  DeadlineExtractor,
  Embedder,
  FinanceCategorizer,
  StatementTextParser,
  WhatsappCategorizer,
  TextDocumentExtractor,
  VisionExtractor,
} from "./types";
import { AnthropicVisionExtractor } from "./vision";
import { AnthropicChatModel } from "./chat";
import { HttpEmbedder } from "./embeddings";
import { OpenAICompatChatModel } from "./openai-compat";
import { FallbackChatModel } from "./fallback";
import {
  GeminiVisionExtractor,
  GeminiChatModel,
  GeminiEmbedder,
  GeminiAudioTranscriber,
  GeminiTextDocumentExtractor,
  GeminiDeadlineExtractor,
  GeminiFinanceCategorizer,
  GeminiStatementParser,
  GeminiWhatsappCategorizer,
} from "./gemini";
import { OllamaVisionExtractor, OllamaChatModel, OllamaEmbedder } from "./ollama";
import {
  FixtureAudioTranscriber,
  FixtureChatModel,
  FixtureDeadlineExtractor,
  FixtureEmbedder,
  FixtureFinanceCategorizer,
  FixtureStatementParser,
  FixtureTextDocumentExtractor,
  FixtureVisionExtractor,
  FixtureWhatsappCategorizer,
} from "./fixtures";

/**
 * Adapter factory. Provider is chosen by AI_PROVIDER; "auto" prefers a free key
 * (Gemini) then Anthropic then deterministic fixtures. DRY_RUN=1 forces fixtures.
 */

export type Provider = "gemini" | "anthropic" | "ollama" | "fixture";

export function resolveProvider(): Provider {
  const env = getEnv();
  if (env.DRY_RUN) return "fixture";
  if (env.AI_PROVIDER !== "auto") return env.AI_PROVIDER;
  if (env.GOOGLE_API_KEY) return "gemini";
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  return "fixture";
}

export type AiMode = {
  provider: Provider;
  vision: Provider;
  chat: Provider;
  embeddings: "gemini" | "ollama" | "voyage" | "openai" | "fixture";
};

export function aiMode(): AiMode {
  const env = getEnv();
  const p = resolveProvider();

  let embeddings: AiMode["embeddings"];
  if (env.DRY_RUN) embeddings = "fixture";
  else if (env.EMBEDDING_API_KEY && env.EMBEDDING_PROVIDER)
    embeddings = env.EMBEDDING_PROVIDER; // explicit override
  else if (p === "gemini") embeddings = "gemini";
  else if (p === "ollama") embeddings = "ollama";
  else embeddings = "fixture"; // anthropic has no embeddings API

  return { provider: p, vision: p, chat: p, embeddings };
}

export function getVisionExtractor(): VisionExtractor {
  const env = getEnv();
  switch (resolveProvider()) {
    case "gemini":
      return new GeminiVisionExtractor(env.GOOGLE_API_KEY!, env.GEMINI_MODEL);
    case "anthropic":
      return new AnthropicVisionExtractor(env.ANTHROPIC_API_KEY!, env.ANTHROPIC_MODEL);
    case "ollama":
      return new OllamaVisionExtractor(env.OLLAMA_BASE_URL, env.OLLAMA_VISION_MODEL);
    default:
      return new FixtureVisionExtractor();
  }
}

/** Only Gemini's REST API is wired for inline audio here. */
export function getAudioTranscriber(): AudioTranscriber {
  const env = getEnv();
  switch (resolveProvider()) {
    case "gemini":
      return new GeminiAudioTranscriber(env.GOOGLE_API_KEY!, env.GEMINI_MODEL);
    case "fixture":
      return new FixtureAudioTranscriber();
    default:
      throw new Error(
        "Voice notes need AI_PROVIDER=gemini (or DRY_RUN=1) — audio transcription isn't wired up for anthropic/ollama.",
      );
  }
}

/** Only Gemini's REST API is wired for plain-text document structuring here. */
export function getTextDocumentExtractor(): TextDocumentExtractor {
  const env = getEnv();
  switch (resolveProvider()) {
    case "gemini":
      return new GeminiTextDocumentExtractor(env.GOOGLE_API_KEY!, env.GEMINI_MODEL);
    case "fixture":
      return new FixtureTextDocumentExtractor();
    default:
      throw new Error(
        "Word/PowerPoint capture needs AI_PROVIDER=gemini (or DRY_RUN=1) — not wired up for anthropic/ollama.",
      );
  }
}

/** Wrap a model so it falls back to an OpenAI-compatible endpoint (OpenRouter /
 * Groq) when the primary is rate-limited. No-op unless FALLBACK_AI_KEY is set. */
function withFallback(primary: ChatModel): ChatModel {
  const env = getEnv();
  if (!env.FALLBACK_AI_KEY) return primary;
  return new FallbackChatModel(
    primary,
    new OpenAICompatChatModel(env.FALLBACK_AI_BASE_URL, env.FALLBACK_AI_KEY, env.FALLBACK_AI_MODEL),
  );
}

export function getChatModel(): ChatModel {
  const env = getEnv();
  switch (resolveProvider()) {
    case "gemini":
      return withFallback(new GeminiChatModel(env.GOOGLE_API_KEY!, env.GEMINI_MODEL));
    case "anthropic":
      return new AnthropicChatModel(env.ANTHROPIC_API_KEY!, env.ANTHROPIC_MODEL);
    case "ollama":
      return new OllamaChatModel(env.OLLAMA_BASE_URL, env.OLLAMA_CHAT_MODEL);
    default:
      return new FixtureChatModel();
  }
}

/** Deadline engine (0017) — only Gemini's REST API is wired here, same
 * constraint as audio/text-document extraction above. */
export function getDeadlineExtractor(): DeadlineExtractor {
  const env = getEnv();
  switch (resolveProvider()) {
    case "gemini":
      return new GeminiDeadlineExtractor(env.GOOGLE_API_KEY!, env.GEMINI_MODEL);
    case "fixture":
      return new FixtureDeadlineExtractor();
    default:
      throw new Error(
        "Deadline extraction needs AI_PROVIDER=gemini (or DRY_RUN=1) — not wired up for anthropic/ollama.",
      );
  }
}

/** Finance statement categorization (0017) — same constraint. */
export function getFinanceCategorizer(): FinanceCategorizer {
  const env = getEnv();
  switch (resolveProvider()) {
    case "gemini":
      return new GeminiFinanceCategorizer(env.GOOGLE_API_KEY!, env.GEMINI_MODEL);
    case "fixture":
      return new FixtureFinanceCategorizer();
    default:
      throw new Error(
        "Finance categorization needs AI_PROVIDER=gemini (or DRY_RUN=1) — not wired up for anthropic/ollama.",
      );
  }
}

/** PDF statement text → transaction rows (0017) — same constraint. */
export function getStatementParser(): StatementTextParser {
  const env = getEnv();
  switch (resolveProvider()) {
    case "gemini":
      return new GeminiStatementParser(env.GOOGLE_API_KEY!, env.GEMINI_MODEL);
    case "fixture":
      return new FixtureStatementParser();
    default:
      throw new Error(
        "PDF statement parsing needs AI_PROVIDER=gemini (or DRY_RUN=1) — not wired up for anthropic/ollama. Upload a CSV export instead.",
      );
  }
}

/** WhatsApp message triage (0017) — same constraint. */
export function getWhatsappCategorizer(): WhatsappCategorizer {
  const env = getEnv();
  switch (resolveProvider()) {
    case "gemini":
      return new GeminiWhatsappCategorizer(env.GOOGLE_API_KEY!, env.GEMINI_MODEL);
    case "fixture":
      return new FixtureWhatsappCategorizer();
    default:
      throw new Error(
        "WhatsApp categorization needs AI_PROVIDER=gemini (or DRY_RUN=1) — not wired up for anthropic/ollama.",
      );
  }
}

export function getEmbedder(): Embedder {
  const env = getEnv();
  switch (aiMode().embeddings) {
    case "gemini":
      return new GeminiEmbedder(env.GOOGLE_API_KEY!, env.GEMINI_EMBED_MODEL, env.EMBEDDING_DIMS);
    case "ollama":
      return new OllamaEmbedder(env.OLLAMA_BASE_URL, env.OLLAMA_EMBED_MODEL, env.EMBEDDING_DIMS);
    case "voyage":
    case "openai":
      return new HttpEmbedder({
        provider: env.EMBEDDING_PROVIDER!,
        apiKey: env.EMBEDDING_API_KEY!,
        model:
          env.EMBEDDING_MODEL ??
          (env.EMBEDDING_PROVIDER === "openai"
            ? "text-embedding-3-small"
            : "voyage-3.5"),
        dims: env.EMBEDDING_DIMS,
      });
    default:
      return new FixtureEmbedder(env.EMBEDDING_DIMS);
  }
}

export * from "./types";
