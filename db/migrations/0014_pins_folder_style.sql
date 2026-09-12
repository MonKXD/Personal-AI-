-- ================================================================= --
-- MirrorMind 0014 — pinned memories + folder colour/emoji            --
-- Apply in the Supabase SQL editor after 0000..0013.                 --
-- ================================================================= --

-- Pin a memory to the top of the Timeline.
alter table public.memories
  add column if not exists pinned_at timestamptz;

create index if not exists memories_pinned_idx
  on public.memories (user_id, pinned_at desc)
  where pinned_at is not null;

-- "Make it yours": a colour + emoji per folder.
alter table public.folders
  add column if not exists color text,
  add column if not exists emoji text;
