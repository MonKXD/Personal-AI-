/**
 * Seed / re-seed the public read-only demo account.
 *
 *   npm run seed:demo
 *
 * Needs DATABASE_URL(_UNPOOLED), NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, GOOGLE_API_KEY, and DEMO_USER_EMAIL +
 * DEMO_USER_PASSWORD in .env.local.
 *
 * It creates the demo auth user if missing, wipes its existing memories /
 * folders / chats, then inserts a handful of realistic student memories with
 * folders, entities, action items, chunks and REAL Gemini embeddings so chat
 * and search work. Idempotent — safe to run again any time.
 *
 * After the first run, copy the printed DEMO_USER_ID into .env.local (and
 * Vercel) so the read-only guards and the "open the demo" button switch on.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { ulid } from "ulid";
import type { Extraction } from "../lib/ai/types";

/* ------------------------------------------------------------ content -- */

type Seed = {
  folder: string; // path like "College/Physics"
  daysAgo: number;
  mime: string;
  x: Omit<Extraction, "type_confidence" | "language"> & {
    type_confidence?: number;
    language?: string;
  };
};

const FOLDERS = ["College", "College/Physics", "Exams"];

const SEEDS: Seed[] = [
  {
    folder: "College",
    daysAgo: 2,
    mime: "image/jpeg",
    x: {
      type: "timetable",
      title: "Thadomal Shahani — Time Table (revised)",
      summary:
        "SE EXTC Semester IV revised weekly timetable, effective 20 Aug. Physics lab moved to Monday 15:00–17:00 in Lab-5.",
      text: [
        "THADOMAL SHAHANI ENGINEERING COLLEGE",
        "SE EXTC — SEMESTER IV — TIME TABLE (REVISED)  w.e.f. 20 Aug",
        "",
        "MON  09:00-10:00  Signals & Systems  (Room 312)",
        "MON  10:00-11:00  Microcontrollers  (Room 312)",
        "MON  15:00-17:00  Physics Lab  (Lab-5)   << revised, was 14:00-16:00 Lab-3",
        "TUE  09:00-11:00  Engineering Maths IV  (Room 305)",
        "WED  11:00-13:00  Microcontrollers Lab  (Lab-2)",
        "THU  09:00-10:00  Physics  (Room 312)",
        "FRI  09:00-11:00  DSA Tutorial  (Room 210)",
      ].join("\n"),
      ocr_confidence: "high",
      structured: {
        owner: "SE EXTC Sem IV",
        valid_from: "2026-08-20",
        slots: [
          { day: "Mon", start: "15:00", end: "17:00", subject: "Physics Lab", room: "Lab-5" },
          { day: "Wed", start: "11:00", end: "13:00", subject: "Microcontrollers Lab", room: "Lab-2" },
        ],
      },
      entities: [
        { kind: "time", value_text: "Mon 15:00-17:00", value_norm: null, ts_value: null, confidence: 0.9 },
        { kind: "place", value_text: "Lab-5", value_norm: null, ts_value: null, confidence: 0.9 },
        { kind: "subject", value_text: "Physics Lab", value_norm: null, ts_value: null, confidence: 0.9 },
      ],
    },
  },
  {
    folder: "College/Physics",
    daysAgo: 4,
    mime: "image/jpeg",
    x: {
      type: "textbook_page",
      title: "Physics — RC Circuits (Ch. 27)",
      summary:
        "Textbook page on RC circuits: charging/discharging, the time constant τ = RC, and the 63% rule.",
      text: [
        "CHAPTER 27 — RC CIRCUITS  (p. 742)",
        "",
        "When a capacitor charges through a resistor, q(t) = Cε (1 − e^(−t/RC)).",
        "The time constant τ = RC is the time to reach ~63.2% of the final charge.",
        "After 5τ the capacitor is >99% charged and treated as fully charged.",
        "Discharging: q(t) = q0 · e^(−t/RC); current i = −(q0/RC) e^(−t/RC).",
        "Key terms: time constant, transient, steady state, RC delay.",
      ].join("\n"),
      ocr_confidence: "high",
      structured: {
        book: "University Physics",
        chapter: "27",
        page: "742",
        key_terms: ["time constant", "transient", "steady state"],
      },
      entities: [
        { kind: "term", value_text: "time constant", value_norm: null, ts_value: null, confidence: 0.9 },
        { kind: "term", value_text: "RC = τ", value_norm: null, ts_value: null, confidence: 0.8 },
      ],
    },
  },
  {
    folder: "Exams",
    daysAgo: 5,
    mime: "application/pdf",
    x: {
      type: "notice",
      title: "SE EXTC Sem IV Microcontrollers — Exam Form",
      summary:
        "Exam form notice for the SE EXTC Sem IV Microcontrollers paper. Subject code 40822. Forms due Wednesday 5:00 PM at the exam cell.",
      text: [
        "EXAMINATION SECTION — NOTICE",
        "",
        "Subject: Microcontrollers & Applications",
        "Class: SE EXTC — Semester IV",
        "Paper / Subject Code: 40822",
        "",
        "All students must submit the examination form to the Exam Cell by",
        "WEDNESDAY, 5:00 PM. Late forms attract a fine of Rs. 200.",
        "Hall tickets will be issued the following Monday.",
      ].join("\n"),
      ocr_confidence: "high",
      structured: {
        issuer: "Examination Section",
        headline: "Microcontrollers exam form — code 40822",
        deadlines: [{ label: "Exam form submission", value: "Wednesday", time: "17:00" }],
      },
      entities: [
        { kind: "term", value_text: "code 40822", value_norm: "40822", ts_value: null, confidence: 0.95 },
        {
          kind: "deadline",
          value_text: "Wednesday 5:00 PM",
          value_norm: null,
          ts_value: isoDaysFromNow(3, 17),
          confidence: 0.85,
        },
      ],
    },
  },
  {
    folder: "College",
    daysAgo: 6,
    mime: "image/jpeg",
    x: {
      type: "notice",
      title: "Library — Revised Timings for Exam Weeks",
      summary:
        "During exam weeks the college library will stay open 8:00 AM to 11:00 PM on all days including Sundays.",
      text: [
        "CENTRAL LIBRARY — NOTICE",
        "",
        "During the examination period the library will remain open:",
        "  8:00 AM – 11:00 PM   (Monday to Sunday)",
        "",
        "Reference section closes at 10:30 PM. Bring your ID card.",
      ].join("\n"),
      ocr_confidence: "high",
      structured: {
        issuer: "Central Library",
        headline: "Extended hours 8 AM – 11 PM during exams",
      },
      entities: [
        { kind: "time", value_text: "8:00 AM - 11:00 PM", value_norm: null, ts_value: null, confidence: 0.9 },
        { kind: "place", value_text: "Central Library", value_norm: null, ts_value: null, confidence: 0.9 },
      ],
    },
  },
  {
    folder: "College",
    daysAgo: 7,
    mime: "image/jpeg",
    x: {
      type: "whiteboard",
      title: "DSA Tutorial — Dijkstra walkthrough",
      summary:
        "Whiteboard from the DSA tutorial: Dijkstra's shortest-path algorithm steps and the priority-queue based complexity.",
      text: [
        "DIJKSTRA — single-source shortest path (non-negative weights)",
        "",
        "1. dist[src] = 0, dist[everything else] = ∞",
        "2. push (0, src) to a min-priority-queue",
        "3. pop the smallest; for each neighbour, relax: if dist[u]+w < dist[v], update + push",
        "4. repeat until the queue is empty",
        "",
        "With a binary heap: O((V + E) log V).",
        "Fails with negative edges — use Bellman-Ford there.",
      ].join("\n"),
      ocr_confidence: "medium",
      structured: {
        summary: "Dijkstra's algorithm steps and complexity",
        points: ["relaxation", "min-priority-queue", "O((V+E) log V)"],
      },
      entities: [
        { kind: "term", value_text: "Dijkstra", value_norm: null, ts_value: null, confidence: 0.9 },
        { kind: "term", value_text: "Bellman-Ford", value_norm: null, ts_value: null, confidence: 0.8 },
      ],
    },
  },
  {
    folder: "College",
    daysAgo: 9,
    mime: "image/jpeg",
    x: {
      type: "handwritten_note",
      title: "Microcontrollers — 8051 interrupt vectors",
      summary:
        "Handwritten revision note: the 8051 interrupt sources, their vector addresses and priority order.",
      text: [
        "8051 INTERRUPTS",
        "",
        "External 0  (INT0)   vector 0003H",
        "Timer 0     (TF0)    vector 000BH",
        "External 1  (INT1)   vector 0013H",
        "Timer 1     (TF1)    vector 001BH",
        "Serial      (RI/TI)  vector 0023H",
        "",
        "IE register enables them; IP register sets high/low priority.",
        "On reset all interrupts are disabled.",
      ].join("\n"),
      ocr_confidence: "medium",
      structured: { summary: "8051 interrupt vector table", points: ["IE register", "IP register"] },
      entities: [
        { kind: "term", value_text: "8051 interrupts", value_norm: null, ts_value: null, confidence: 0.9 },
        { kind: "term", value_text: "vector 0003H", value_norm: null, ts_value: null, confidence: 0.8 },
      ],
    },
  },
  {
    folder: "College",
    daysAgo: 11,
    mime: "application/pdf",
    x: {
      type: "slide",
      title: "Signals & Systems — Fourier Series (Lec 12)",
      summary:
        "Lecture slide on the Fourier series: the analysis/synthesis equations and the idea that any periodic signal is a sum of harmonics.",
      text: [
        "SIGNALS & SYSTEMS — LECTURE 12",
        "FOURIER SERIES",
        "",
        "Any periodic x(t) with period T0 can be written as a sum of harmonically",
        "related sinusoids at f0 = 1/T0.",
        "",
        "Synthesis:  x(t) = Σ  a_k e^(j k ω0 t)",
        "Analysis:   a_k = (1/T0) ∫_{T0} x(t) e^(−j k ω0 t) dt",
        "",
        "Even signal → cosine terms only. Odd signal → sine terms only.",
      ].join("\n"),
      ocr_confidence: "high",
      structured: { summary: "Fourier series analysis and synthesis", points: ["harmonics", "a_k coefficients"] },
      entities: [
        { kind: "term", value_text: "Fourier series", value_norm: null, ts_value: null, confidence: 0.9 },
        { kind: "subject", value_text: "Signals & Systems", value_norm: null, ts_value: null, confidence: 0.9 },
      ],
    },
  },
  {
    folder: "College",
    daysAgo: 1,
    mime: "audio/mp4",
    x: {
      type: "voice_note",
      title: "Reminder: mini-project abstract due Friday",
      summary:
        "Voice memo reminding myself to email the mini-project abstract (one page, PDF) to the project guide before Friday.",
      text: "Note to self — the mini-project abstract is due Friday. One page, PDF, email it to the project guide. Need to add the block diagram and the list of components before sending.",
      ocr_confidence: "high",
      structured: {
        summary: "Mini-project abstract due Friday",
        points: ["one page PDF", "email to project guide", "add block diagram"],
        dates: [],
      },
      entities: [
        {
          kind: "deadline",
          value_text: "Friday",
          value_norm: null,
          ts_value: isoNextWeekday(5, 18),
          confidence: 0.7,
        },
        { kind: "term", value_text: "mini-project abstract", value_norm: null, ts_value: null, confidence: 0.9 },
      ],
    },
  },
];

/* -------------------------------------------------------------- helpers -- */

function isoDaysFromNow(days: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function isoNextWeekday(weekday: number, hour = 18): string {
  const d = new Date();
  const delta = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/* ---------------------------------------------------------------- main -- */

async function main() {
  const dbUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.DEMO_USER_EMAIL?.trim();
  const password = process.env.DEMO_USER_PASSWORD;

  if (!dbUrl || !supaUrl || !serviceKey) {
    console.error("Need DATABASE_URL(_UNPOOLED), NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  if (!email || !password) {
    console.error("Set DEMO_USER_EMAIL and DEMO_USER_PASSWORD in .env.local first.");
    process.exit(1);
  }
  if (!process.env.GOOGLE_API_KEY) {
    console.error("Set GOOGLE_API_KEY — the seed makes real embedding calls so chat/search work.");
    process.exit(1);
  }

  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  const supabase = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // 1. find or create the demo auth user
  let userId: string | undefined;
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  userId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "MirrorMind Demo" },
    });
    if (error || !data.user) {
      console.error("Couldn't create the demo user:", error?.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log(`Created demo user ${email} (${userId})`);
  } else {
    // keep the password in sync with .env.local
    await supabase.auth.admin.updateUserById(userId, { password });
    console.log(`Found demo user ${email} (${userId})`);
  }
  const uid: string = userId;

  // 2. wipe existing demo data (captures cascade to memories/chunks/…)
  await sql`delete from captures where user_id = ${uid}`;
  await sql`delete from chat_sessions where user_id = ${uid}`;
  await sql`delete from folders where user_id = ${uid}`;
  await sql`delete from notifications where user_id = ${uid}`;
  console.log("Cleared previous demo data");

  // 3. app modules (env is loaded; the tsx shim neutralises `server-only`)
  const { getEmbedder } = await import("../lib/ai");
  const { chunkMemory } = await import("../lib/pipeline/chunk");
  const { insertMemoryGraph, createFolder, setMemoryFolder } = await import("../lib/db/queries");
  const { extractionSchema } = await import("../lib/ai/types");
  const embedder = getEmbedder();

  // 4. folders
  const folderId = new Map<string, string>();
  for (const path of FOLDERS) {
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const parentId = parts.length > 1 ? folderId.get(parts.slice(0, -1).join("/")) ?? null : null;
    const res = await createFolder(uid, { name, parentId });
    if ("error" in res) {
      console.error(`folder "${path}":`, res.error);
      process.exit(1);
    }
    folderId.set(path, res.id);
  }
  console.log(`Created ${FOLDERS.length} folders`);

  // 5. memories
  for (const seed of SEEDS) {
    const capturedAt = new Date();
    capturedAt.setDate(capturedAt.getDate() - seed.daysAgo);

    const extraction: Extraction = extractionSchema.parse({
      type_confidence: 0.9,
      language: "en",
      ...seed.x,
    });

    const captureId = ulid();
    const key = `${uid}/${captureId}/demo`;
    await sql`
      insert into captures
        (id, user_id, status, original_key, display_key, thumb_key, mime, bytes, sha256, source, captured_at)
      values
        (${captureId}, ${uid}, 'ready', ${key}, ${key}, ${key}, ${seed.mime}, 0,
         ${"demo-" + captureId}, 'upload', ${capturedAt.toISOString()})
    `;

    const chunkList = chunkMemory({
      title: extraction.title,
      summary: extraction.summary,
      text: extraction.text,
    });
    const vectors = chunkList.length
      ? await embedder.embed(chunkList.map((c) => c.content))
      : [];

    const { memoryId } = await insertMemoryGraph({
      userId: uid,
      captureId,
      capturedAt,
      extraction,
      chunkList,
      vectors,
      embeddingModel: embedder.model,
      embeddingDims: embedder.dims,
      extractor: "demo-seed",
      modelMeta: { provider: "demo", prompt_version: "demo" },
    });

    await setMemoryFolder(uid, [memoryId], folderId.get(seed.folder) ?? null);
    console.log(`  ✓ ${extraction.title}  (${chunkList.length} chunks)`);
  }

  await sql.end();

  console.log(`\nDone — ${SEEDS.length} demo memories seeded for ${email}.`);
  console.log(`\nAdd this to .env.local and Vercel:\n  DEMO_USER_ID=${uid}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
