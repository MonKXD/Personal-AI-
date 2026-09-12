-- ================================================================= --
-- Personal AI 0008 — per-user calendar feed token                     --
-- Apply in the Supabase SQL editor after 0000..0007.                 --
-- ================================================================= --
--
-- An unguessable token that lets a calendar app subscribe to the
-- user's deadlines at /api/calendar/<token> without auth (calendar
-- clients can't do OAuth). Rotatable by clearing the column.

alter table public.profile_prefs
  add column if not exists calendar_token text;

create unique index if not exists profile_prefs_calendar_token_idx
  on public.profile_prefs (calendar_token)
  where calendar_token is not null;
