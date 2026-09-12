-- ================================================================= --
-- MirrorMind 0006 — shared daily AI-call budget                       --
-- Apply in the Supabase SQL editor after 0000..0005.                  --
-- ================================================================= --
--
-- A single counter row per IST day, incremented once per successful
-- Gemini HTTP call (extraction, each embedding, chat answer, folder
-- suggest). The app checks it before starting a new capture or chat and
-- shows a friendly "shared daily budget used up — back tomorrow" instead
-- of failing mid-request when the free tier's ~1k req/day ceiling is hit.
--
-- Only the service-role connection (which bypasses RLS) ever touches this
-- table, so RLS is enabled with no policy = deny-all for end users.

create table if not exists public.ai_call_log (
  bucket_start  timestamptz primary key,   -- start of the IST day (startOfUtcDayForTz)
  calls         integer not null default 0,
  updated_at    timestamptz not null default now()
);

alter table public.ai_call_log enable row level security;
