-- ================================================================= --
-- MirrorMind 0004 — folders (single-home, nestable)                  --
-- Apply in the Supabase SQL editor after 0000..0003.                 --
-- ================================================================= --
--
-- Supersedes the many-to-many `collections` from 0002/0003. A memory now
-- has at most ONE folder (folder_id NULL = "Unfiled"). Folders nest via
-- parent_id. Deleting a folder never destroys anything: its memories fall
-- back to Unfiled and its subfolders become top-level (ON DELETE SET NULL).
--
-- The collections/collection_memories tables are intentionally left in
-- place (unused) — a later migration can drop them once nothing references
-- them. There is no data migration: the collections tables were empty.

create table if not exists public.folders (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  parent_id   text references public.folders(id) on delete set null,
  name        text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Case-insensitive unique name per (user, parent). Two expressions so
-- top-level folders (parent_id IS NULL) are also de-duped.
create unique index if not exists folders_user_parent_name_idx
  on public.folders (user_id, coalesce(parent_id, ''), lower(name));
create index if not exists folders_user_parent_idx
  on public.folders (user_id, parent_id);

alter table public.folders enable row level security;
drop policy if exists "folders_own" on public.folders;
create policy "folders_own" on public.folders for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The memory's home folder (source of truth for browsing) + an unapplied
-- AI suggestion the user can accept.
alter table public.memories
  add column if not exists folder_id           text references public.folders(id) on delete set null,
  add column if not exists suggested_folder_id text references public.folders(id) on delete set null;
create index if not exists memories_user_folder_idx
  on public.memories (user_id, folder_id);

-- Folder picked at capture time; the pipeline copies it onto the memory.
alter table public.captures
  add column if not exists folder_id text references public.folders(id) on delete set null;
