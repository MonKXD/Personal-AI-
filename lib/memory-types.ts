import {
  Megaphone,
  CalendarDays,
  BookOpen,
  Presentation,
  Cpu,
  Pencil,
  Monitor,
  FileText,
  Mic,
  type LucideIcon,
} from "lucide-react";

/** Capture/memory types — mirrors the `memory_type` enum in docs/05-SCHEMA.md. */
export const MEMORY_TYPES = [
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
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_TYPE_META: Record<
  MemoryType,
  { label: string; icon: LucideIcon; blurb: string }
> = {
  notice: { label: "Notice", icon: Megaphone, blurb: "Boards, circulars, memos" },
  timetable: {
    label: "Timetable",
    icon: CalendarDays,
    blurb: "Schedules & routines",
  },
  textbook_page: {
    label: "Textbook page",
    icon: BookOpen,
    blurb: "Book & article pages",
  },
  whiteboard: {
    label: "Whiteboard",
    icon: Presentation,
    blurb: "Meeting & lecture boards",
  },
  circuit: { label: "Circuit", icon: Cpu, blurb: "Schematics & diagrams" },
  handwritten_note: {
    label: "Note",
    icon: Pencil,
    blurb: "Handwritten notes",
  },
  slide: { label: "Slide", icon: Monitor, blurb: "Decks & projections" },
  document: { label: "Document", icon: FileText, blurb: "Printed documents" },
  other: { label: "Other", icon: FileText, blurb: "Anything else" },
  voice_note: { label: "Voice note", icon: Mic, blurb: "Recorded memos" },
};

export type ConfidenceBand = "high" | "medium" | "low";

export const CAPTURE_STATUSES = [
  "queued",
  "extracting",
  "embedding",
  "ready",
  "failed",
] as const;
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number];

export const PIPELINE_STEPS: {
  key: CaptureStatus;
  label: string;
}[] = [
  { key: "queued", label: "Queued" },
  { key: "extracting", label: "Reading" },
  { key: "embedding", label: "Remembering" },
  { key: "ready", label: "Ready" },
];
