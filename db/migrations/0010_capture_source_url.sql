-- ================================================================= --
-- Personal AI 0010 — URL capture                                      --
-- Apply in the Supabase SQL editor after 0000..0009.                 --
-- ================================================================= --
--
-- A capture whose `source` is 'url' stores the page's readable text as a
-- text/plain object; `source_url` keeps the original link so the memory
-- can point back to it.

alter table public.captures
  add column if not exists source_url text;
