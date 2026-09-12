-- ================================================================= --
-- MirrorMind 0002 — voice notes, collections                         --
-- Apply in the Supabase SQL editor after 0000_init.sql + 0001.       --
-- ================================================================= --

-- ---------- voice notes ----------
-- New memory type for transcribed audio captures. Added as its own statement
-- (not referenced elsewhere in this file) so it's safe regardless of how the
-- SQL editor batches transactions.
alter type memory_type add value if not exists 'voice_note';

-- ---------- collections ----------
create table if not exists public.collections (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.collection_memories (
  collection_id text not null references public.collections(id) on delete cascade,
  memory_id     text not null references public.memories(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (collection_id, memory_id)
);
create index if not exists collection_memories_memory_idx on public.collection_memories (memory_id);

alter table public.collections          enable row level security;
alter table public.collection_memories  enable row level security;

drop policy if exists "collections_own" on public.collections;
create policy "collections_own" on public.collections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- collection_memories: ownership via parent collection (mirrors memory_tags_own)
drop policy if exists "collection_memories_own" on public.collection_memories;
create policy "collection_memories_own" on public.collection_memories for all
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));
