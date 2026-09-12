import "server-only";

import { getStatementParser } from "@/lib/ai";
import type { StatementParseRow } from "@/lib/ai/types";

/**
 * Statement upload parsing (docs/modules/finance-tracking.md). CSV is
 * straightforward column parsing (no AI needed); a PDF's layout varies too
 * much for regex, so its extracted text goes through a single Gemini call
 * (lib/ai/index.ts getStatementParser()).
 */

export type ParsedStatementRow = {
  date: string; // YYYY-MM-DD, best-effort
  amount: number;
  direction: "income" | "expense";
  merchant: string | null;
};

const DATE_KEYS = /date/i;
const DEBIT_KEYS = /^(debit|withdrawal|dr)\b/i;
const CREDIT_KEYS = /^(credit|deposit|cr)\b/i;
const AMOUNT_KEYS = /amount/i;
const TYPE_KEYS = /^(type|dr\/cr|direction|txn type)/i;
const DESC_KEYS = /narration|description|particulars|details|remarks|merchant|payee/i;

/** Minimal RFC4180-ish CSV line splitter: handles quoted fields with commas
 * and doubled-quote escapes. Good enough for bank/UPI exports. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toNumber(raw: string): number {
  const cleaned = raw.replace(/[,₹$\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(raw: string): string {
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  // DD/MM/YYYY or DD-MM-YYYY, common in Indian bank exports.
  const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const [, dd, mm, yyRaw] = m;
    const yyyy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return raw.slice(0, 10);
}

export function parseStatementCsv(csv: string): ParsedStatementRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());

  const idx = (re: RegExp) => headers.findIndex((h) => re.test(h));
  const dateIdx = idx(DATE_KEYS);
  const debitIdx = idx(DEBIT_KEYS);
  const creditIdx = idx(CREDIT_KEYS);
  const amountIdx = idx(AMOUNT_KEYS);
  const typeIdx = idx(TYPE_KEYS);
  const descIdx = idx(DESC_KEYS);

  const rows: ParsedStatementRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    if (cells.every((c) => !c)) continue;
    const date = dateIdx >= 0 ? normalizeDate(cells[dateIdx] ?? "") : "";
    const merchant = descIdx >= 0 ? cells[descIdx] || null : null;

    let amount = 0;
    let direction: "income" | "expense" = "expense";

    if (debitIdx >= 0 || creditIdx >= 0) {
      const debit = debitIdx >= 0 ? toNumber(cells[debitIdx] ?? "") : 0;
      const credit = creditIdx >= 0 ? toNumber(cells[creditIdx] ?? "") : 0;
      if (credit > 0) {
        amount = credit;
        direction = "income";
      } else {
        amount = debit;
        direction = "expense";
      }
    } else if (amountIdx >= 0) {
      const raw = toNumber(cells[amountIdx] ?? "");
      amount = Math.abs(raw);
      const typeVal = typeIdx >= 0 ? (cells[typeIdx] ?? "").toLowerCase() : "";
      direction =
        raw < 0 || /^(dr|debit|d)$/i.test(typeVal)
          ? "expense"
          : /^(cr|credit|c)$/i.test(typeVal)
            ? "income"
            : raw >= 0
              ? "income"
              : "expense";
    } else {
      continue; // no usable amount column
    }

    if (!date || amount === 0) continue;
    rows.push({ date, amount, direction, merchant });
  }
  return rows;
}

function toParsedRow(r: StatementParseRow): ParsedStatementRow {
  return {
    date: normalizeDate(r.date),
    amount: Math.abs(r.amount),
    direction: r.direction,
    merchant: r.merchant ?? null,
  };
}

export async function parseStatementPdfText(text: string): Promise<ParsedStatementRow[]> {
  const rows = await getStatementParser().parseText(text, new Date().toISOString());
  return rows.map(toParsedRow).filter((r) => r.date && r.amount > 0);
}

export async function extractPdfText(pdf: Buffer): Promise<string> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(new Uint8Array(pdf), "application/pdf");
  try {
    const pageCount = doc.countPages();
    const parts: string[] = [];
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      try {
        parts.push(page.toStructuredText("preserve-whitespace").asText());
      } finally {
        page.destroy();
      }
    }
    return parts.join("\n\n");
  } finally {
    doc.destroy();
  }
}
