import { createHash } from "node:crypto";
import type {
  AudioInput,
  AudioTranscriber,
  ChatAnswer,
  ChatInput,
  ChatModel,
  DeadlineExtraction,
  DeadlineExtractionInput,
  DeadlineExtractor,
  Embedder,
  Extraction,
  FinanceCategorization,
  FinanceCategorizer,
  FinanceRowInput,
  StatementParseRow,
  StatementTextParser,
  WhatsappCategorization,
  WhatsappCategorizer,
  WhatsappCategoryInput,
  TextDocumentInput,
  TextDocumentExtractor,
  VisionExtractor,
  VisionInput,
} from "./types";

/**
 * DRY_RUN implementations — zero external calls. Used automatically when the
 * relevant API key is missing or DRY_RUN=1, so the whole capture→memory→recall
 * flow is demoable offline. Output is deterministic per image (seeded by a hash).
 */

function hash32(s: string): number {
  const h = createHash("sha256").update(s).digest();
  return h.readUInt32BE(0);
}

const NOTICE: Extraction = {
  type: "notice",
  type_confidence: 0.94,
  title: "Robotics Club — Open House",
  summary:
    "The Robotics Club open house is on Sep 5 at 5 PM in the Main Auditorium. Register by Sep 4.",
  text: "ROBOTICS CLUB\nOpen House & Recruitment\n\nJoin us to see this year's projects and sign up for teams.\n\nWhen: Friday, Sep 5 — 5:00 PM\nWhere: Main Auditorium\nRegister by: Thursday, Sep 4, 5:00 PM\nContact: Aditi — robotics@college.edu",
  ocr_confidence: "high",
  language: "en",
  structured: {
    issuer: "Robotics Club",
    headline: "Open House & Recruitment",
    body: "Join us to see this year's projects and sign up for teams.",
    location: "Main Auditorium",
    dates: [{ label: "Event", value: "2026-09-05", time: "17:00" }],
    deadlines: [{ label: "Registration closes", value: "2026-09-04", time: "17:00" }],
    contacts: [{ name: "Aditi", email: "robotics@college.edu" }],
    links: [],
  },
  entities: [
    { kind: "organization", value_text: "Robotics Club" },
    { kind: "date", value_text: "Sep 5, 5:00 PM", value_norm: "2026-09-05T17:00:00+05:30", ts_value: "2026-09-05T17:00:00+05:30" },
    { kind: "deadline", value_text: "Sep 4, 5:00 PM", value_norm: "2026-09-04T17:00:00+05:30", ts_value: "2026-09-04T17:00:00+05:30" },
    { kind: "place", value_text: "Main Auditorium" },
    { kind: "contact_email", value_text: "robotics@college.edu", value_norm: "robotics@college.edu" },
    { kind: "person", value_text: "Aditi" },
  ],
};

const TIMETABLE: Extraction = {
  type: "timetable",
  type_confidence: 0.9,
  title: "Semester 3 — Section B timetable",
  summary: "Weekly class schedule for Sem 3 Section B, effective Aug 28.",
  text: "TIMETABLE — SEM 3, SEC B (w.e.f. 28 Aug)\nMon 09:00-10:00 Maths III (A-201)\nMon 10:00-11:00 Data Structures (A-201)\nWed 14:00-16:00 Physics Lab (Lab-3)\nThu 11:00-12:00 Electronics (B-104)\nFri 09:00-10:00 Maths III (A-201)",
  ocr_confidence: "high",
  language: "en",
  structured: {
    owner: "Sem 3 — Section B",
    valid_from: "2026-08-28",
    slots: [
      { day: "Mon", start: "09:00", end: "10:00", subject: "Maths III", room: "A-201" },
      { day: "Mon", start: "10:00", end: "11:00", subject: "Data Structures", room: "A-201" },
      { day: "Wed", start: "14:00", end: "16:00", subject: "Physics Lab", room: "Lab-3" },
      { day: "Thu", start: "11:00", end: "12:00", subject: "Electronics", room: "B-104" },
      { day: "Fri", start: "09:00", end: "10:00", subject: "Maths III", room: "A-201" },
    ],
  },
  entities: [
    { kind: "subject", value_text: "Maths III" },
    { kind: "subject", value_text: "Data Structures" },
    { kind: "subject", value_text: "Physics Lab" },
    { kind: "subject", value_text: "Electronics" },
    { kind: "place", value_text: "Lab-3" },
  ],
};

const TEXTBOOK: Extraction = {
  type: "textbook_page",
  type_confidence: 0.88,
  title: "Physics — RC Circuits (Ch. 27)",
  summary:
    "Textbook page on RC circuits: the time constant tau = RC and charging/discharging behaviour.",
  text: "Chapter 27 — Circuits\n27.4 RC Circuits\n\nWhen a capacitor charges through a resistor, the charge approaches its final value exponentially. The time constant is tau = RC. After one time constant the capacitor reaches about 63% of its final charge.\n\nKey terms: EMF, internal resistance, RC time constant.",
  ocr_confidence: "medium",
  language: "en",
  structured: {
    book: "Fundamentals of Physics",
    chapter: "Ch. 27 — Circuits",
    page: "742",
    key_terms: ["EMF", "internal resistance", "RC time constant"],
    definitions: [
      { term: "RC time constant", text: "tau = RC; time for a capacitor to reach ~63% of its final charge." },
    ],
    summary_points: [
      "Capacitor charge approaches its final value exponentially.",
      "One time constant tau = RC reaches ~63% of final charge.",
    ],
  },
  entities: [
    { kind: "term", value_text: "RC time constant" },
    { kind: "term", value_text: "EMF" },
    { kind: "term", value_text: "internal resistance" },
  ],
};

const SET = [NOTICE, TIMETABLE, TEXTBOOK];

export class FixtureVisionExtractor implements VisionExtractor {
  readonly name = "fixture";
  readonly model = "fixture";
  async extract(input: VisionInput): Promise<Extraction> {
    const pick = SET[hash32(input.seed) % SET.length];
    // deep clone so callers can mutate freely
    return JSON.parse(JSON.stringify(pick)) as Extraction;
  }
}

const VOICE_NOTE: Extraction = {
  type: "voice_note",
  type_confidence: 0.92,
  title: "Voice memo",
  summary: "A quick voice memo about picking up the physics lab report and calling Aditi back.",
  text: "Remember to pick up the physics lab report from the front office before Friday, and call Aditi back about the robotics meetup.",
  ocr_confidence: "high",
  language: "en",
  structured: {
    summary: "Two reminders: physics lab report pickup, and a call back.",
    points: ["Pick up physics lab report from the front office", "Call Aditi back about the robotics meetup"],
    dates: [],
  },
  entities: [
    { kind: "person", value_text: "Aditi" },
    { kind: "deadline", value_text: "Friday" },
    { kind: "term", value_text: "physics lab report" },
  ],
};

export class FixtureAudioTranscriber implements AudioTranscriber {
  readonly name = "fixture";
  readonly model = "fixture";
  async transcribe(input: AudioInput): Promise<Extraction> {
    void input;
    return JSON.parse(JSON.stringify(VOICE_NOTE)) as Extraction;
  }
}

const DOCUMENT_FIXTURE: Extraction = {
  type: "document",
  type_confidence: 0.9,
  title: "Lab Safety Guidelines",
  summary: "A short reference document covering lab safety rules and equipment checkout procedure.",
  text: "Lab Safety Guidelines\n\n1. Always wear safety goggles in the lab.\n2. Report any equipment damage to the lab assistant immediately.\n3. Equipment checkout closes at 5 PM on weekdays.",
  ocr_confidence: "high",
  language: "en",
  structured: {
    summary: "Lab safety rules and equipment checkout hours.",
    points: ["Wear safety goggles", "Report equipment damage immediately", "Checkout closes 5 PM weekdays"],
    dates: [],
  },
  entities: [{ kind: "term", value_text: "equipment checkout" }],
};

export class FixtureTextDocumentExtractor implements TextDocumentExtractor {
  readonly name = "fixture";
  readonly model = "fixture";
  async extractFromText(input: TextDocumentInput): Promise<Extraction> {
    void input;
    return JSON.parse(JSON.stringify(DOCUMENT_FIXTURE)) as Extraction;
  }
}

export class FixtureEmbedder implements Embedder {
  readonly name = "fixture";
  readonly model = "fixture-hash";
  readonly dims: number;
  constructor(dims: number) {
    this.dims = dims;
  }
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.vec(t));
  }
  private vec(text: string): number[] {
    // Deterministic pseudo-embedding: expand a sha256 stream, then L2-normalise.
    const out = new Array<number>(this.dims);
    let seed = createHash("sha256").update(text || " ").digest();
    let idx = 0;
    for (let i = 0; i < this.dims; i++) {
      if (idx + 4 > seed.length) {
        seed = createHash("sha256").update(seed).digest();
        idx = 0;
      }
      const u = seed.readUInt32BE(idx);
      idx += 4;
      out[i] = u / 0xffffffff - 0.5;
    }
    const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
    return out.map((v) => v / norm);
  }
}

export class FixtureChatModel implements ChatModel {
  readonly name = "fixture";

  async answer(input: ChatInput): Promise<ChatAnswer> {
    if (input.context.length === 0) {
      return {
        answer: "I don't have a memory of that yet. Capture it and ask me again.",
        citations: [],
        used_structured: false,
        no_memory: true,
      };
    }
    const top = input.context.slice(0, 3);
    return {
      answer:
        `Based on what you've captured: ${top[0].snippet.replace(/\s+/g, " ").slice(0, 220)}` +
        (top.length > 1 ? " …and related notes." : "") +
        `\n\n(DRY_RUN reply — configure a real AI provider for real answers.)`,
      citations: top.map((c) => c.memoryId),
      used_structured: false,
      no_memory: false,
    };
  }

  async *streamAnswer(input: ChatInput): AsyncGenerator<string, ChatAnswer, void> {
    const full = await this.answer(input);
    // chunk the canned answer into word-ish pieces so the client stream path
    // is exercised in DRY_RUN too.
    const parts = full.answer.match(/\S+\s*/g) ?? [full.answer];
    for (const p of parts) {
      await new Promise((r) => setTimeout(r, 12));
      yield p;
    }
    return full;
  }
}

const DATE_HINT = /\b(tomorrow|today|tonight|mon|tue|wed|thu|fri|sat|sun|deadline|due|by\s+\d|\d{1,2}[/-]\d{1,2})\b/i;

export class FixtureDeadlineExtractor implements DeadlineExtractor {
  readonly name = "fixture";

  async extract(input: DeadlineExtractionInput): Promise<DeadlineExtraction> {
    if (!DATE_HINT.test(input.text)) {
      return { found: false, title: null, dueDate: null, confidence: 0.1 };
    }
    const due = new Date(input.now);
    due.setDate(due.getDate() + 1);
    return {
      found: true,
      title: input.text.replace(/\s+/g, " ").trim().slice(0, 60) || "Deadline",
      dueDate: due.toISOString(),
      confidence: 0.75,
    };
  }
}

const FINANCE_KEYWORDS: [RegExp, string][] = [
  [/zomato|swiggy|restaurant|cafe|food/i, "Food"],
  [/uber|ola|rapido|irctc|indigo|flight|fuel|petrol/i, "Travel"],
  [/netflix|spotify|prime|hotstar|subscription/i, "Subscriptions"],
  [/udemy|coursera|tuition|college|exam fee/i, "Education"],
  [/amazon|flipkart|myntra|shopping/i, "Shopping"],
  [/rent|landlord|maintenance/i, "Rent/Housing"],
  [/pharmacy|hospital|clinic|doctor|apollo/i, "Health"],
  [/bookmyshow|movie|netflix|game/i, "Entertainment"],
  [/upi transfer|neft|imps|sent to|received from/i, "Transfers"],
  [/salary|payout|refund|interest credit/i, "Income"],
];

export class FixtureFinanceCategorizer implements FinanceCategorizer {
  readonly name = "fixture";

  async categorize(rows: FinanceRowInput[]): Promise<FinanceCategorization[]> {
    return rows.map((r) => {
      if (r.direction === "income") return { ref: r.ref, category: "Income", confidence: 0.6 };
      const haystack = `${r.merchant ?? ""} ${r.description ?? ""}`;
      const hit = FINANCE_KEYWORDS.find(([re]) => re.test(haystack));
      return { ref: r.ref, category: hit?.[1] ?? "Other", confidence: hit ? 0.7 : 0.3 };
    });
  }
}

export class FixtureStatementParser implements StatementTextParser {
  readonly name = "fixture";
  // No real parsing offline — a PDF's layout can't be guessed deterministically.
  // Returns empty so the upload flow still exercises end-to-end without a key.
  async parseText(): Promise<StatementParseRow[]> {
    return [];
  }
}

const PROMO_HINT = /unsubscribe|% off|sale|offer|limited time|buy now|discount code/i;

export class FixtureWhatsappCategorizer implements WhatsappCategorizer {
  readonly name = "fixture";

  async categorize(input: WhatsappCategoryInput): Promise<WhatsappCategorization> {
    if (PROMO_HINT.test(input.text)) {
      return { category: "promotional", reason: "Looks like a marketing/broadcast message." };
    }
    if (DATE_HINT.test(input.text)) {
      return { category: "deadline", reason: "Mentions a specific date or due time." };
    }
    return { category: "routine", reason: "No urgency or promotional signal detected." };
  }
}
