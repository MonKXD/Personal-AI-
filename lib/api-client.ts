"use client";

import type { CaptureStatus, MemoryType } from "@/lib/memory-types";
import { createClient } from "@/lib/supabase/client";

/** Must match CAPTURES_BUCKET in lib/supabase/admin.ts (a server-only module,
 * so this can't just import the constant). */
const CAPTURES_BUCKET = "captures";

/** Thin typed wrappers over the /api routes for use in client components. */

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export type CreateCaptureResult = {
  id: string;
  status: CaptureStatus;
  deduped?: boolean;
};

async function sha256Hex(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type BeginCaptureResult =
  | { deduped: true; id: string; status: CaptureStatus }
  | {
      deduped: false;
      captureId: string;
      uploadUrl: string;
      token: string;
      path: string;
      thumb?: { uploadUrl: string; token: string; path: string };
    };

/**
 * Uploads a capture (photo, audio, PDF, or Word/PowerPoint) straight to
 * Supabase Storage from the browser, bypassing the Vercel function body
 * limit (a hard, unconfigurable 4.5MB) entirely — only small JSON requests
 * go through our own API. See lib/pipeline/create-capture.ts.
 */
export async function uploadCapture(
  file: File | Blob,
  opts: {
    capturedAt?: string;
    source?: string;
    width?: number;
    height?: number;
    folderId?: string | null;
    /** PDF only: a browser-rendered page-1 JPEG for the thumbnail. */
    thumbBlob?: Blob | null;
  } = {},
): Promise<CreateCaptureResult> {
  const mime = file.type || "application/octet-stream";
  const sha256 = await sha256Hex(file);

  const beginRes = await j<BeginCaptureResult>(
    await fetch("/api/captures/begin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mime, sha256, bytes: file.size }),
    }),
  );

  if (beginRes.deduped) {
    return { id: beginRes.id, status: beginRes.status, deduped: true };
  }

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(CAPTURES_BUCKET)
    .uploadToSignedUrl(beginRes.path, beginRes.token, file, { contentType: mime });
  if (uploadError) {
    throw new Error("Upload failed. Try again.");
  }

  let thumbUploaded = false;
  if (opts.thumbBlob && beginRes.thumb) {
    const { error } = await supabase.storage
      .from(CAPTURES_BUCKET)
      .uploadToSignedUrl(beginRes.thumb.path, beginRes.thumb.token, opts.thumbBlob, {
        contentType: "image/jpeg",
      });
    thumbUploaded = !error;
  }

  return j(
    await fetch("/api/captures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        captureId: beginRes.captureId,
        mime,
        sha256,
        bytes: file.size,
        capturedAt: opts.capturedAt,
        source: opts.source,
        width: opts.width,
        height: opts.height,
        folderId: opts.folderId ?? null,
        thumbUploaded,
      }),
    }),
  );
}


export type CaptureStatusResult = {
  id: string;
  status: CaptureStatus;
  errorCode: string | null;
  errorDetail: string | null;
  memoryId: string | null;
};

export async function getCaptureStatus(id: string): Promise<CaptureStatusResult> {
  return j(await fetch(`/api/captures/${id}`, { cache: "no-store" }));
}

export async function retryCapture(id: string): Promise<{ id: string; status: CaptureStatus }> {
  return j(await fetch(`/api/captures/${id}/retry`, { method: "POST" }));
}

export async function captureUrl(
  url: string,
): Promise<{ id: string; status: CaptureStatus; deduped?: boolean }> {
  return j(
    await fetch("/api/captures/url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  );
}

export type ChatCitation = {
  memoryId: string;
  title: string;
  type: MemoryType;
  snippet: string;
  thumbUrl: string | null;
  mime: string;
};

export type ChatFilters = {
  types?: MemoryType[];
  after?: string | null;
  before?: string | null;
  label?: string[];
};

export type ChatResult = {
  sessionId: string;
  answer: string;
  citations: ChatCitation[];
  usedFilters: ChatFilters;
  noMemory: boolean;
};

/**
 * Ask a question. The API streams the answer as newline-delimited JSON
 * events ({t:"delta"|"done"|"error"}); `onDelta` fires per text chunk and the
 * promise resolves with the final result once the "done" event arrives.
 */
export async function askChat(
  text: string,
  sessionId: string | null,
  onDelta?: (chunk: string) => void,
): Promise<ChatResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, sessionId }),
  });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let answer = "";
  let done: {
    sessionId: string;
    citations: ChatCitation[];
    usedFilters: ChatFilters;
    noMemory: boolean;
  } | null = null;

  for (;;) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as
        | { t: "delta"; v: string }
        | { t: "error"; message: string }
        | { t: "done"; sessionId: string; citations: ChatCitation[]; usedFilters: ChatFilters; noMemory: boolean };
      if (ev.t === "delta") {
        answer += ev.v;
        onDelta?.(ev.v);
      } else if (ev.t === "error") {
        throw new Error(ev.message || "Couldn't get an answer.");
      } else if (ev.t === "done") {
        done = ev;
      }
    }
  }

  if (!done) throw new Error("The answer stream ended unexpectedly.");
  return {
    sessionId: done.sessionId,
    answer,
    citations: done.citations,
    usedFilters: done.usedFilters,
    noMemory: done.noMemory,
  };
}

export type ChatSessionSummary = { id: string; title: string; updatedAt: string };

export async function listChatSessions(): Promise<{ items: ChatSessionSummary[] }> {
  return j(await fetch("/api/chat/sessions", { cache: "no-store" }));
}

export async function newChatSession(): Promise<{ id: string; title: string }> {
  return j(await fetch("/api/chat/sessions", { method: "POST" }));
}

export async function deleteChatSession(id: string): Promise<void> {
  const res = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error("Delete failed");
}

export async function setActionItemStatus(
  id: string,
  status: "open" | "done" | "dismissed",
): Promise<void> {
  await j(
    await fetch(`/api/action-items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
}

/* ------------------------------- deadlines -------------------------------- */

export type DeadlineItem = {
  id: string;
  title: string;
  dueAt: string | null;
  status: "pending" | "done";
  priority: "urgent" | "high" | "normal" | "none";
  source: "manual" | "whatsapp" | "call";
  sourceRefId: string | null;
  confidence: number | null;
};

export async function listDeadlines(status?: "pending" | "done"): Promise<DeadlineItem[]> {
  const qs = status ? `?status=${status}` : "";
  const { deadlines } = await j<{ deadlines: DeadlineItem[] }>(await fetch(`/api/deadlines${qs}`));
  return deadlines;
}

export async function addDeadline(title: string, dueDate: string): Promise<void> {
  await j(
    await fetch("/api/deadlines", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, dueDate }),
    }),
  );
}

export async function setDeadlineStatus(id: string, status: "pending" | "done"): Promise<void> {
  await j(
    await fetch(`/api/deadlines/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
}

/* -------------------------------- finance ---------------------------------- */

export type FinanceTransaction = {
  id: string;
  occurredOn: string;
  amount: string;
  direction: "income" | "expense";
  category: string;
  merchant: string | null;
  note: string | null;
  source: "manual" | "statement_upload";
  createdAt: string;
};

export async function listFinanceTransactions(category?: string): Promise<FinanceTransaction[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  const { transactions } = await j<{ transactions: FinanceTransaction[] }>(
    await fetch(`/api/finance/transactions${qs}`),
  );
  return transactions;
}

export async function addFinanceTransaction(input: {
  date: string;
  amount: number;
  direction: "income" | "expense";
  category: string;
  note?: string;
}): Promise<void> {
  await j(
    await fetch("/api/finance/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function uploadStatement(
  file: File,
  accountLabel: string,
): Promise<{ rowsInserted: number; rowsParsed: number }> {
  const form = new FormData();
  form.append("file", file);
  form.append("accountLabel", accountLabel);
  return j(await fetch("/api/finance/statements", { method: "POST", body: form }));
}

export type SpendingSummary = {
  month: string;
  total: number;
  categories: { category: string; total: string; count: number }[];
};

export async function getSpendingSummary(month: string): Promise<SpendingSummary> {
  return j(await fetch(`/api/finance/summary?month=${month}`));
}

/* ---------------------------- calling assistant ----------------------------- */

export type CallItem = {
  id: string;
  direction: "inbound" | "outbound";
  counterpart: string;
  status: "in_progress" | "completed" | "missed" | "voicemail" | "failed";
  purpose: string | null;
  summary: string | null;
  durationSec: number | null;
  createdAt: string;
};

export async function listCalls(): Promise<CallItem[]> {
  const { calls } = await j<{ calls: CallItem[] }>(await fetch("/api/calls"));
  return calls;
}

export async function placeCall(input: {
  to: string;
  purpose?: string;
  instructions: string;
}): Promise<{ id: string }> {
  return j(
    await fetch("/api/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

/* ---------------------------- whatsapp triage ------------------------------- */

export type WhatsappMessageItem = {
  id: string;
  chatId: string;
  chatName: string | null;
  sender: string | null;
  text: string;
  category: "important" | "deadline" | "routine" | "promotional" | "filtered";
  reason: string | null;
  occurredAt: string;
};

export async function listWhatsappMessages(category?: string): Promise<WhatsappMessageItem[]> {
  const qs = category ? `?category=${category}` : "";
  const { messages } = await j<{ messages: WhatsappMessageItem[] }>(
    await fetch(`/api/whatsapp/messages${qs}`),
  );
  return messages;
}

export async function setWhatsappFilterRule(
  chatId: string,
  action: "mute" | "always_flag",
): Promise<void> {
  await j(
    await fetch("/api/whatsapp/filters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chatId, action }),
    }),
  );
}

/* --------------------------------- search -------------------------------- */

export type SearchResult = {
  memories: {
    id: string;
    type: MemoryType;
    title: string;
    summary: string;
    thumbUrl: string | null;
    mime: string;
  }[];
  sessions: { id: string; title: string; updatedAt: string }[];
};

export async function search(q: string): Promise<SearchResult> {
  return j(await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" }));
}

/* ---------------------------- memory linking ------------------------------ */

export type LinkedMemory = {
  id: string;
  type: MemoryType;
  title: string;
  thumbUrl: string | null;
  mime: string;
};

export async function listLinkedMemories(memoryId: string): Promise<{ items: LinkedMemory[] }> {
  return j(await fetch(`/api/memories/${memoryId}/links`, { cache: "no-store" }));
}

export async function linkMemory(memoryId: string, targetId: string): Promise<void> {
  await j(
    await fetch(`/api/memories/${memoryId}/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetId }),
    }),
  );
}

export async function unlinkMemory(memoryId: string, targetId: string): Promise<void> {
  const res = await fetch(`/api/memories/${memoryId}/links/${targetId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Couldn't remove link.");
}

/* -------------------------------- folders ------------------------------- */

export type Folder = {
  id: string;
  parentId: string | null;
  name: string;
  position: number;
  color: string | null;
  emoji: string | null;
  count: number;
};

export async function listFolders(): Promise<{ folders: Folder[]; unfiledCount: number }> {
  return j(await fetch("/api/folders", { cache: "no-store" }));
}

export async function createFolder(
  name: string,
  parentId?: string | null,
): Promise<{ id: string; name: string }> {
  return j(
    await fetch("/api/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, parentId: parentId ?? null }),
    }),
  );
}

export async function updateFolder(
  id: string,
  patch: { name?: string; parentId?: string | null; color?: string | null; emoji?: string | null },
): Promise<void> {
  await j(
    await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteFolder(id: string): Promise<void> {
  const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error("Couldn't delete folder.");
}

export async function moveMemoriesToFolder(
  memoryIds: string[],
  folderId: string | null,
): Promise<{ moved: number }> {
  return j(
    await fetch("/api/memories/folder", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoryIds, folderId }),
    }),
  );
}

export async function dismissFolderSuggestion(memoryId: string): Promise<void> {
  const res = await fetch(`/api/memories/${memoryId}/suggestion`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error("Couldn't dismiss.");
}

/* ------------------------------- sharing --------------------------------- */

export async function shareMemory(memoryId: string): Promise<{ url: string }> {
  return j(await fetch(`/api/memories/${memoryId}/share`, { method: "POST" }));
}

export async function unshareMemory(memoryId: string): Promise<void> {
  const res = await fetch(`/api/memories/${memoryId}/share`, { method: "DELETE" });
  if (!res.ok) throw new Error("Couldn't revoke the link.");
}

export async function pinMemory(memoryId: string): Promise<void> {
  const res = await fetch(`/api/memories/${memoryId}/pin`, { method: "POST" });
  if (!res.ok) throw new Error("Couldn't pin.");
}

export async function unpinMemory(memoryId: string): Promise<void> {
  const res = await fetch(`/api/memories/${memoryId}/pin`, { method: "DELETE" });
  if (!res.ok) throw new Error("Couldn't unpin.");
}

/* --------------------------- text correction ------------------------------ */

export async function correctMemoryText(memoryId: string, text: string): Promise<void> {
  await j(
    await fetch(`/api/memories/${memoryId}/correct`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  );
}

/* ----------------------------- notifications --------------------------- */

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export async function listNotifications(): Promise<{
  unread: number;
  items: AppNotification[];
}> {
  return j(await fetch("/api/notifications", { cache: "no-store" }));
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  await j(
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    }),
  );
}
