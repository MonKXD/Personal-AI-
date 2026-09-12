import { z } from "zod";
import { MEMORY_TYPES } from "@/lib/memory-types";

/**
 * AI adapter contracts. Concrete implementations live in vision.ts / embeddings.ts
 * (real) and fixtures.ts (DRY_RUN). Nothing outside lib/ai imports a vendor SDK.
 * See docs/10-PROMPTS.md and docs/05-SCHEMA.md §7.
 */

export const ENTITY_KINDS = [
  "date",
  "time",
  "deadline",
  "person",
  "place",
  "organization",
  "contact_email",
  "contact_phone",
  "subject",
  "term",
  "url",
  "amount",
] as const;

const KIND_ALIASES: Record<string, (typeof ENTITY_KINDS)[number]> = {
  email: "contact_email",
  phone: "contact_phone",
  mobile: "contact_phone",
  org: "organization",
  company: "organization",
  location: "place",
  venue: "place",
  datetime: "date",
  time_value: "time",
  course: "subject",
  topic: "term",
  keyword: "term",
  link: "url",
  price: "amount",
  money: "amount",
};

export const extractedEntitySchema = z.object({
  kind: z
    .string()
    .transform((k) => {
      const n = k.toLowerCase().trim().replace(/[\s-]+/g, "_");
      const mapped = KIND_ALIASES[n] ?? n;
      return (ENTITY_KINDS as readonly string[]).includes(mapped) ? mapped : "term";
    })
    .pipe(z.enum(ENTITY_KINDS)),
  value_text: z.string().min(1).max(500),
  // Any string — normalised leniently in lib/pipeline/derive.ts, not here.
  value_norm: z.string().max(500).nullish(),
  ts_value: z.string().max(80).nullish(),
  confidence: z.number().min(0).max(1).nullish(),
});

export const extractionSchema = z.object({
  type: z.enum(MEMORY_TYPES).catch("other"),
  type_confidence: z.coerce.number().min(0).max(1).catch(0.5),
  title: z.string().max(200).catch(""),
  summary: z.string().max(4000).catch(""),
  text: z.string().catch(""),
  ocr_confidence: z.enum(["high", "medium", "low"]).catch("medium"),
  language: z.string().max(10).catch("en"),
  structured: z.record(z.string(), z.unknown()).nullish().catch(null),
  // Drop individual malformed entities instead of failing the whole extraction.
  entities: z
    .array(z.unknown())
    .catch([])
    .transform((arr) =>
      arr.flatMap((e) => {
        const r = extractedEntitySchema.safeParse(e);
        return r.success ? [r.data] : [];
      }),
    ),
});

export type ExtractedEntity = z.infer<typeof extractedEntitySchema>;
export type Extraction = z.infer<typeof extractionSchema>;

export type VisionInput = {
  imageBase64: string;
  /** PDFs go through the same extractor as photos — Gemini reads a PDF's
   * text, images, and diagrams natively across all its pages. */
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  /** ISO string; helps the model resolve relative dates. */
  now: string;
  timezone: string;
  /** stable per-image seed so DRY_RUN output is deterministic */
  seed: string;
};

export interface VisionExtractor {
  readonly name: string;
  readonly model: string;
  extract(input: VisionInput): Promise<Extraction>;
}

export type AudioInput = {
  audioBase64: string;
  mediaType: "audio/webm" | "audio/ogg" | "audio/mp4" | "audio/mpeg";
  /** ISO string; helps the model resolve relative dates. */
  now: string;
  timezone: string;
  /** stable per-recording seed so DRY_RUN output is deterministic */
  seed: string;
};

export interface AudioTranscriber {
  readonly name: string;
  readonly model: string;
  transcribe(input: AudioInput): Promise<Extraction>;
}

export type TextDocumentInput = {
  /** Already-extracted plain text (DOCX/PPTX aren't accepted by Gemini
   * directly — lib/pipeline/office-text.ts pulls text out first). */
  text: string;
  /** "docx" | "pptx" — helps the model guess title/type sensibly. */
  sourceKind: string;
  now: string;
  timezone: string;
  seed: string;
};

export interface TextDocumentExtractor {
  readonly name: string;
  readonly model: string;
  extractFromText(input: TextDocumentInput): Promise<Extraction>;
}

export type EmbedKind = "document" | "query";

export interface Embedder {
  readonly name: string;
  readonly model: string;
  readonly dims: number;
  embed(texts: string[], kind?: EmbedKind): Promise<number[][]>;
}

/** L2-normalise a vector so cosine distance is well-behaved for any dimension. */
export function l2normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

/* ------------------------- deadline engine (0017) ------------------------ */

/** Shared extraction step for the deadline engine — every source module
 * (WhatsApp triage, calling assistant; email/manual don't need it) runs its
 * text through this instead of reimplementing date-parsing. See
 * docs/modules/deadline-engine.md. */
export type DeadlineExtractionInput = {
  text: string;
  /** ISO string; helps the model resolve relative dates ("tomorrow", "Friday"). */
  now: string;
  timezone: string;
};

export const deadlineExtractionSchema = z.object({
  found: z.boolean().catch(false),
  title: z.string().max(200).nullish(),
  // ISO datetime with offset, or null if no specific date was found.
  dueDate: z.string().max(40).nullish(),
  confidence: z.number().min(0).max(1).catch(0),
});

export type DeadlineExtraction = z.infer<typeof deadlineExtractionSchema>;

export interface DeadlineExtractor {
  readonly name: string;
  extract(input: DeadlineExtractionInput): Promise<DeadlineExtraction>;
}

/** Only a deadline whose confidence clears this is written automatically —
 * lower-confidence hits are worse as a silent write than as a missed one. */
export const DEADLINE_CONFIDENCE_THRESHOLD = 0.6;

export function computeDeadlinePriority(
  dueAt: Date | null,
  now: Date = new Date(),
): "urgent" | "high" | "normal" | "none" {
  if (!dueAt) return "none";
  const hoursLeft = (dueAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursLeft <= 24) return "urgent";
  if (hoursLeft <= 24 * 7) return "high";
  return "normal";
}

/* -------------------------- finance tracking (0017) ----------------------- */

export type FinanceRowInput = {
  /** Stable per-batch key so the categorized result can be matched back to
   * the parsed row (parser output order isn't guaranteed to round-trip). */
  ref: string;
  date: string;
  amount: number;
  direction: "income" | "expense";
  merchant?: string;
  description?: string;
};

export const financeCategorizationSchema = z.object({
  ref: z.string(),
  category: z.string().min(1).max(60).catch("Other"),
  confidence: z.number().min(0).max(1).catch(0.5),
});

export const financeCategorizationBatchSchema = z.object({
  rows: z.array(financeCategorizationSchema).catch([]),
});

export type FinanceCategorization = z.infer<typeof financeCategorizationSchema>;

export const FINANCE_CATEGORIES = [
  "Food",
  "Travel",
  "Subscriptions",
  "Education",
  "Shopping",
  "Rent/Housing",
  "Health",
  "Entertainment",
  "Transfers",
  "Income",
  "Other",
] as const;

export interface FinanceCategorizer {
  readonly name: string;
  /** One call per statement batch (not per row) — categorization is batched
   * for cost, same principle as embeddings batching (see docs/06-RULES.md §9). */
  categorize(rows: FinanceRowInput[]): Promise<FinanceCategorization[]>;
}

/** Bank/UPI statement PDF formats vary too much for hand-written regex to
 * hold up — a PDF statement's extracted text is normalized into rows by a
 * single Gemini call instead (CSV statements are parsed directly, no AI
 * needed — see lib/finance/parse-statement.ts). */
export const statementParseRowSchema = z.object({
  date: z.string().max(20),
  amount: z.number(),
  direction: z.enum(["income", "expense"]).catch("expense"),
  merchant: z.string().max(200).nullish(),
});

export const statementParseSchema = z.object({
  rows: z.array(statementParseRowSchema).catch([]),
});

export type StatementParseRow = z.infer<typeof statementParseRowSchema>;

export interface StatementTextParser {
  readonly name: string;
  parseText(text: string, now: string): Promise<StatementParseRow[]>;
}

/* --------------------------- whatsapp triage (0017) ------------------------ */

export const WHATSAPP_CATEGORIES = [
  "important",
  "deadline",
  "routine",
  "promotional",
  "filtered",
] as const;

export type WhatsappCategoryInput = {
  chatName: string;
  sender: string;
  text: string;
  /** Last few messages in the same chat, oldest first, for continuity. */
  recentContext: string[];
};

export const whatsappCategorizationSchema = z.object({
  category: z.enum(WHATSAPP_CATEGORIES).catch("routine"),
  // One sentence — shown as a hover tooltip so the user can sanity-check the flag.
  reason: z.string().max(200).catch(""),
});

export type WhatsappCategorization = z.infer<typeof whatsappCategorizationSchema>;

export interface WhatsappCategorizer {
  readonly name: string;
  categorize(input: WhatsappCategoryInput): Promise<WhatsappCategorization>;
}

export type ChatCitation = { memory_id: string };

export type ChatAnswer = {
  answer: string;
  citations: string[];
  used_structured: boolean;
  no_memory: boolean;
};

export type ChatContextBlock = {
  memoryId: string;
  type: string;
  capturedAt: string;
  snippet: string;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatInput = {
  question: string;
  now: string;
  timezone: string;
  context: ChatContextBlock[];
  /** Recent turns of this session, oldest first, for short-term follow-ups
   * ("and the one after that?"). The current question is NOT included. */
  history?: ChatTurn[];
};

export interface ChatModel {
  readonly name: string;
  answer(input: ChatInput): Promise<ChatAnswer>;
  /** Optional streamed variant: yields answer-text deltas as they arrive and
   * returns the full ChatAnswer (citations resolved) when done. Callers fall
   * back to answer() when an adapter doesn't implement it. */
  streamAnswer?(input: ChatInput): AsyncGenerator<string, ChatAnswer, void>;
}
