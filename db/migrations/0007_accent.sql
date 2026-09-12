-- ================================================================= --
-- MirrorMind 0007 — per-user accent colour                           --
-- Apply in the Supabase SQL editor after 0000..0006.                 --
-- ================================================================= --
--
-- One of six curated hues (see lib/accent.ts). NULL / absent = the
-- default "grape", which matches the base tokens, so no override.

alter table public.profile_prefs
  add column if not exists accent text;
