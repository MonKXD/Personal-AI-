-- ================================================================= --
-- Personal AI 0009 — public share link for a single memory            --
-- Apply in the Supabase SQL editor after 0000..0008.                 --
-- ================================================================= --
--
-- When `share_id` is set, GET /m/<share_id> renders that one memory
-- read-only with no auth. Clearing the column revokes the link.

alter table public.memories
  add column if not exists share_id text;

create unique index if not exists memories_share_id_idx
  on public.memories (share_id)
  where share_id is not null;
