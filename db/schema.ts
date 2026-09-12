/**
 * Drizzle schema for MirrorMind — mirrors docs/05-SCHEMA.md, adapted for
 * Supabase (user ids are uuid referencing auth.users; RLS enforced in SQL).
 *
 * The authoritative DDL, including RLS policies and the pgvector index, is the
 * hand-written migration in db/migrations/0000_init.sql. This file exists for
 * type-safe queries from the app.
 */
import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  doublePrecision,
  real,
  numeric,
  date,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { vector, EMBEDDING_DIMS } from "./vector";

export const captureStatus = pgEnum("capture_status", [
  "queued",
  "extracting",
  "embedding",
  "ready",
  "failed",
]);

export const memoryType = pgEnum("memory_type", [
  "notice",
  "timetable",
  "textbook_page",
  "whiteboard",
  "circuit",
  "handwritten_note",
  "slide",
  "document",
  "other",
  "voice_note",
]);

export const confidenceBand = pgEnum("confidence_band", ["high", "medium", "low"]);

export const entityKind = pgEnum("entity_kind", [
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
]);

export const actionStatus = pgEnum("action_status", ["open", "done", "dismissed"]);
export const chatRole = pgEnum("chat_role", ["user", "assistant", "system"]);

export const deadlineStatus = pgEnum("deadline_status", ["pending", "done"]);
export const deadlineSource = pgEnum("deadline_source", ["manual", "whatsapp", "call"]);
export const financeDirection = pgEnum("finance_direction", ["income", "expense"]);
export const financeSource = pgEnum("finance_source", ["manual", "statement_upload"]);
export const statementBatchStatus = pgEnum("statement_batch_status", [
  "processing",
  "done",
  "failed",
]);
export const callDirection = pgEnum("call_direction", ["inbound", "outbound"]);
export const callStatus = pgEnum("call_status", [
  "in_progress",
  "completed",
  "missed",
  "voicemail",
  "failed",
]);
export const whatsappCategory = pgEnum("whatsapp_category", [
  "important",
  "deadline",
  "routine",
  "promotional",
  "filtered",
]);
export const whatsappFilterAction = pgEnum("whatsapp_filter_action", ["mute", "always_flag"]);

/** Public mirror of auth.users, kept in sync by a trigger. */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  email: text("email"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  tz: text("tz").notNull().default("Asia/Kolkata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const captures = pgTable(
  "captures",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    status: captureStatus("status").notNull().default("queued"),
    errorCode: text("error_code"),
    errorDetail: text("error_detail"),
    originalKey: text("original_key").notNull(),
    displayKey: text("display_key").notNull(),
    thumbKey: text("thumb_key").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    sha256: text("sha256").notNull(),
    source: text("source").notNull().default("upload"), // upload | webcam | share | url
    sourceUrl: text("source_url"), // original link when source = 'url' (0010)
    folderId: text("folder_id"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    deviceHint: text("device_hint"),
    timings: jsonb("timings").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("captures_user_time_idx").on(t.userId, t.capturedAt.desc()),
    uniqueIndex("captures_user_sha_idx").on(t.userId, t.sha256),
  ],
);

export const memories = pgTable(
  "memories",
  {
    id: text("id").primaryKey(),
    captureId: text("capture_id").notNull().unique(),
    userId: uuid("user_id").notNull(),
    type: memoryType("type").notNull().default("other"),
    typeConfidence: real("type_confidence"),
    title: text("title").notNull().default(""),
    summary: text("summary").notNull().default(""),
    text: text("text").notNull().default(""),
    correctedText: text("corrected_text"),
    folderId: text("folder_id"),
    suggestedFolderId: text("suggested_folder_id"),
    shareId: text("share_id"), // set = publicly viewable at /m/<share_id> (0009)
    pinnedAt: timestamp("pinned_at", { withTimezone: true }), // pinned to Timeline top (0014)
    ocrConfidence: confidenceBand("ocr_confidence").notNull().default("medium"),
    language: text("language").notNull().default("en"),
    structured: jsonb("structured"),
    extractor: text("extractor").notNull().default("vision"),
    modelMeta: jsonb("model_meta").notNull().default({}),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("memories_user_time_idx").on(t.userId, t.capturedAt.desc()),
    index("memories_type_idx").on(t.userId, t.type),
  ],
);

export const chunks = pgTable(
  "chunks",
  {
    id: text("id").primaryKey(),
    memoryId: text("memory_id").notNull(),
    userId: uuid("user_id").notNull(),
    ord: integer("ord").notNull(),
    kind: text("kind").notNull().default("body"),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull().default(0),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    type: memoryType("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("chunks_memory_ord_idx").on(t.memoryId, t.ord),
    index("chunks_filter_idx").on(t.userId, t.capturedAt.desc(), t.type),
  ],
);

export const embeddings = pgTable(
  "embeddings",
  {
    chunkId: text("chunk_id").primaryKey(),
    userId: uuid("user_id").notNull(),
    model: text("model").notNull(),
    dims: integer("dims").notNull(),
    embedding: vector("embedding", EMBEDDING_DIMS).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("embeddings_user_idx").on(t.userId)],
);

export const entities = pgTable(
  "entities",
  {
    id: text("id").primaryKey(),
    memoryId: text("memory_id").notNull(),
    userId: uuid("user_id").notNull(),
    kind: entityKind("kind").notNull(),
    valueText: text("value_text").notNull(),
    valueNorm: text("value_norm"),
    tsValue: timestamp("ts_value", { withTimezone: true }),
    spanStart: integer("span_start"),
    spanEnd: integer("span_end"),
    confidence: real("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("entities_memory_idx").on(t.memoryId),
    index("entities_kind_ts_idx").on(t.userId, t.kind, t.tsValue),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    source: text("source").notNull().default("derived"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tags_user_name_idx").on(t.userId, t.name)],
);

export const memoryTags = pgTable(
  "memory_tags",
  {
    memoryId: text("memory_id").notNull(),
    tagId: text("tag_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.memoryId, t.tagId] }),
    index("memory_tags_tag_idx").on(t.tagId),
  ],
);

export const actionItems = pgTable(
  "action_items",
  {
    id: text("id").primaryKey(),
    memoryId: text("memory_id").notNull(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: actionStatus("status").notNull().default("open"),
    sourceEntityId: text("source_entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("action_items_due_idx").on(t.userId, t.status, t.dueAt)],
);

/** Source-agnostic deadline list (0017). Sits alongside `action_items`
 * (capture-derived) for manual entries and future sources (whatsapp, call).
 * `status` only ever stores pending/done — "missed" is computed on read from
 * `dueAt`, same pattern as action_items' overdue flag. */
export const deadlines = pgTable(
  "deadlines",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: deadlineStatus("status").notNull().default("pending"),
    source: deadlineSource("source").notNull().default("manual"),
    sourceRefId: text("source_ref_id"),
    confidence: real("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deadlines_user_status_due_idx").on(t.userId, t.status, t.dueAt)],
);

/** One statement upload = one batch (0017). */
export const financeStatementBatches = pgTable(
  "finance_statement_batches",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    accountLabel: text("account_label").notNull(),
    fileName: text("file_name").notNull(),
    status: statementBatchStatus("status").notNull().default("processing"),
    rowCount: integer("row_count").notNull().default(0),
    errorDetail: text("error_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("finance_statement_batches_user_idx").on(t.userId, t.createdAt.desc())],
);

/** Manual entries + statement-upload rows, AI-categorized (0017). */
export const financeTransactions = pgTable(
  "finance_transactions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(), // YYYY-MM-DD, tz-free
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // string mode — avoids float drift
    direction: financeDirection("direction").notNull(),
    category: text("category").notNull(),
    categoryConfidence: real("category_confidence"),
    merchant: text("merchant"),
    note: text("note"),
    source: financeSource("source").notNull().default("manual"),
    statementBatchId: text("statement_batch_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("finance_transactions_user_date_idx").on(t.userId, t.occurredOn.desc()),
    index("finance_transactions_user_category_idx").on(t.userId, t.category),
  ],
);

/** Twilio ConversationRelay calling-assistant log (0017). The live call
 * itself is handled by an external WebSocket relay (CONVERSATION_RELAY_WS_URL,
 * see docs/modules/calling-assistant.md) — this row is written on placement
 * and updated with the transcript/summary when the relay reports completion. */
export const calls = pgTable(
  "calls",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    direction: callDirection("direction").notNull(),
    counterpart: text("counterpart").notNull(),
    status: callStatus("status").notNull().default("in_progress"),
    purpose: text("purpose"),
    instructions: text("instructions"),
    transcript: jsonb("transcript").notNull().default([]),
    summary: text("summary"),
    extractedTasks: jsonb("extracted_tasks").notNull().default([]),
    durationSec: integer("duration_sec"),
    providerCallSid: text("provider_call_sid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("calls_user_time_idx").on(t.userId, t.createdAt.desc())],
);

/** Per-chat mute / always-flag override for WhatsApp triage (0017). */
export const whatsappFilterRules = pgTable(
  "whatsapp_filter_rules",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    chatId: text("chat_id").notNull(),
    action: whatsappFilterAction("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("whatsapp_filter_rules_user_chat_idx").on(t.userId, t.chatId)],
);

/** Passive WhatsApp triage inbox mirror (0017). Written only by
 * /api/whatsapp/sync, called by an external Baileys listener — see
 * docs/modules/whatsapp-triage.md. Never used to send messages. */
export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    chatId: text("chat_id").notNull(),
    chatName: text("chat_name"),
    sender: text("sender"),
    direction: text("direction").notNull().default("in"),
    text: text("text").notNull(),
    category: whatsappCategory("category").notNull().default("routine"),
    reason: text("reason"),
    isDeadline: boolean("is_deadline").notNull().default(false),
    deadlineId: text("deadline_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("whatsapp_messages_user_time_idx").on(t.userId, t.occurredAt.desc()),
    index("whatsapp_messages_user_category_idx").on(t.userId, t.category, t.occurredAt.desc()),
    index("whatsapp_messages_user_chat_idx").on(t.userId, t.chatId),
  ],
);

/** Folders — a memory has at most one (memories.folder_id NULL = "Unfiled").
 * Nestable via parent_id. Supersedes `collections` (0004). */
export const folders = pgTable(
  "folders",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    color: text("color"), // hex accent (0014)
    emoji: text("emoji"), // single emoji (0014)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("folders_user_parent_idx").on(t.userId, t.parentId)],
);

/** @deprecated superseded by `folders` (0004) — tables kept until a cleanup migration. */
export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("collections_user_name_idx").on(t.userId, t.name)],
);

export const collectionMemories = pgTable(
  "collection_memories",
  {
    collectionId: text("collection_id").notNull(),
    memoryId: text("memory_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.memoryId] }),
    index("collection_memories_memory_idx").on(t.memoryId),
  ],
);

export const memoryLinks = pgTable(
  "memory_links",
  {
    srcMemoryId: text("src_memory_id").notNull(),
    dstMemoryId: text("dst_memory_id").notNull(),
    relation: text("relation").notNull().default("related"),
    score: real("score"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.srcMemoryId, t.dstMemoryId, t.relation] })],
);

export const chatSessions = pgTable("chat_sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull().default("New chat"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: chatRole("role").notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations").notNull().default([]),
    usedFilters: jsonb("used_filters").notNull().default({}),
    retrievalDebug: jsonb("retrieval_debug").notNull().default({}),
    modelMeta: jsonb("model_meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_session_idx").on(t.sessionId, t.createdAt)],
);

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  userId: uuid("user_id").notNull(),
  captureId: text("capture_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Sign-up allowlist. Managed by the owner (OWNER_EMAIL). */
export const allowedEmails = pgTable("allowed_emails", {
  email: text("email").primaryKey(),
  note: text("note"),
  addedBy: uuid("added_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-user preferences (timezone, notification opt-ins). 1 row per user. */
export const profilePrefs = pgTable("profile_prefs", {
  userId: uuid("user_id").primaryKey(),
  tz: text("tz").notNull().default("Asia/Kolkata"),
  emailReminders: boolean("email_reminders").notNull().default(true),
  weeklyDigest: boolean("weekly_digest").notNull().default(true),
  accent: text("accent"), // one of lib/accent.ts keys; null = default "grape"
  calendarToken: text("calendar_token"), // unguessable; powers /api/calendar/<token>
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Records that a reminder email was sent for an action item (dedupe). */
export const reminderLog = pgTable(
  "reminder_log",
  {
    actionItemId: text("action_item_id").notNull(),
    kind: text("kind").notNull(), // 'due_soon' | 'weekly_digest'
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.actionItemId, t.kind] })],
);

/** In-app notification feed (0005). */
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    dedupeKey: text("dedupe_key"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt.desc())],
);

/** Telegram bot ↔ account link (0016). */
export const telegramLinks = pgTable("telegram_links", {
  userId: uuid("user_id").primaryKey(),
  chatId: text("chat_id").unique(), // bigint in SQL; drizzle reads as string
  linkCode: text("link_code").unique(),
  linkCodeExpires: timestamp("link_code_expires", { withTimezone: true }),
  linkedAt: timestamp("linked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Web Push subscriptions (0015). One per browser/device. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

/** In-app "report a problem" messages (0013). Owner reads them at
 * /settings/feedback. */
export const feedback = pgTable("feedback", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  message: text("message").notNull(),
  page: text("page"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Personal API tokens for the public REST API (0011). Only the hash is kept. */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull().default("API token"),
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_tokens_user_idx").on(t.userId, t.createdAt.desc())],
);

/** Outbound webhooks (0012). Signed POSTs on capture.completed / memory.created
 * / action_item.due_soon / digest.weekly. See lib/webhooks.ts. */
export const webhooks = pgTable(
  "webhooks",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    events: jsonb("events").notNull().default([]),
    active: boolean("active").notNull().default(true),
    failureCount: integer("failure_count").notNull().default(0),
    lastStatus: integer("last_status"),
    lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhooks_user_idx").on(t.userId, t.createdAt.desc())],
);

/** Shared per-IST-day counter of successful Gemini API calls (0006). One row
 * per day; only the service-role connection writes to it. Free-tier budget
 * guard — see lib/ai/usage.ts. */
export const aiCallLog = pgTable("ai_call_log", {
  bucketStart: timestamp("bucket_start", { withTimezone: true }).primaryKey(),
  calls: integer("calls").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
