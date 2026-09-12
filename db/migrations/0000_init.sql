-- ================================================================= --
-- MirrorMind — initial schema                                        --
-- Target: Supabase Postgres (with the `auth` schema present).        --
-- Apply by pasting into the Supabase SQL editor, or via the CLI.     --
-- Mirrors docs/05-SCHEMA.md; adds Supabase auth wiring + RLS.        --
-- Embedding vector dimension: 1024 (keep in sync with EMBEDDING_DIMS)--
-- ================================================================= --

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------- enums ----------
do $$ begin
  create type capture_status as enum ('queued','extracting','embedding','ready','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type memory_type as enum
    ('notice','timetable','textbook_page','whiteboard','circuit','handwritten_note','slide','document','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type confidence_band as enum ('high','medium','low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entity_kind as enum
    ('date','time','deadline','person','place','organization','contact_email','contact_phone','subject','term','url','amount');
exception when duplicate_object then null; end $$;

do $$ begin
  create type action_status as enum ('open','done','dismissed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type chat_role as enum ('user','assistant','system');
exception when duplicate_object then null; end $$;

-- ---------- shared trigger: touch updated_at ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- profiles (public mirror of auth.users) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  tz           text not null default 'Asia/Kolkata',
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- captures ----------
create table if not exists public.captures (
  id            text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        capture_status not null default 'queued',
  error_code    text,
  error_detail  text,
  original_key  text not null,
  display_key   text not null,
  thumb_key     text not null,
  mime          text not null,
  bytes         integer not null,
  width         integer,
  height        integer,
  sha256        text not null,
  source        text not null default 'upload',
  captured_at   timestamptz not null,
  received_at   timestamptz not null default now(),
  latitude      double precision,
  longitude     double precision,
  device_hint   text,
  timings       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists captures_user_time_idx on public.captures (user_id, captured_at desc);
create unique index if not exists captures_user_sha_idx on public.captures (user_id, sha256);
drop trigger if exists t_captures_touch on public.captures;
create trigger t_captures_touch before update on public.captures
  for each row execute function public.touch_updated_at();

-- ---------- memories ----------
create table if not exists public.memories (
  id              text primary key,
  capture_id      text not null unique references public.captures(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            memory_type not null default 'other',
  type_confidence real,
  title           text not null default '',
  summary         text not null default '',
  text            text not null default '',
  corrected_text  text,
  ocr_confidence  confidence_band not null default 'medium',
  language        text not null default 'en',
  structured      jsonb,
  extractor       text not null default 'vision',
  model_meta      jsonb not null default '{}'::jsonb,
  captured_at     timestamptz not null,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists memories_user_time_idx on public.memories (user_id, captured_at desc) where deleted_at is null;
create index if not exists memories_type_idx on public.memories (user_id, type) where deleted_at is null;
create index if not exists memories_title_trgm on public.memories using gin (title gin_trgm_ops);
create index if not exists memories_structured_gin on public.memories using gin (structured jsonb_path_ops);
drop trigger if exists t_memories_touch on public.memories;
create trigger t_memories_touch before update on public.memories
  for each row execute function public.touch_updated_at();

-- ---------- chunks ----------
create table if not exists public.chunks (
  id          text primary key,
  memory_id   text not null references public.memories(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  ord         integer not null,
  kind        text not null default 'body',
  content     text not null,
  token_count integer not null default 0,
  captured_at timestamptz not null,
  type        memory_type not null,
  created_at  timestamptz not null default now(),
  unique (memory_id, ord)
);
create index if not exists chunks_memory_idx on public.chunks (memory_id);
create index if not exists chunks_filter_idx on public.chunks (user_id, captured_at desc, type);

-- ---------- embeddings ----------
create table if not exists public.embeddings (
  chunk_id    text primary key references public.chunks(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  model       text not null,
  dims        integer not null,
  embedding   vector(1024) not null,
  created_at  timestamptz not null default now()
);
create index if not exists embeddings_hnsw_cos on public.embeddings
  using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);
create index if not exists embeddings_user_idx on public.embeddings (user_id);

-- ---------- entities ----------
create table if not exists public.entities (
  id          text primary key,
  memory_id   text not null references public.memories(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        entity_kind not null,
  value_text  text not null,
  value_norm  text,
  ts_value    timestamptz,
  span_start  integer,
  span_end    integer,
  confidence  real,
  created_at  timestamptz not null default now()
);
create index if not exists entities_memory_idx on public.entities (memory_id);
create index if not exists entities_kind_ts_idx on public.entities (user_id, kind, ts_value);

-- ---------- tags ----------
create table if not exists public.tags (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  source      text not null default 'derived',
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);
create table if not exists public.memory_tags (
  memory_id text not null references public.memories(id) on delete cascade,
  tag_id    text not null references public.tags(id) on delete cascade,
  primary key (memory_id, tag_id)
);
create index if not exists memory_tags_tag_idx on public.memory_tags (tag_id);

-- ---------- action_items ----------
create table if not exists public.action_items (
  id               text primary key,
  memory_id        text not null references public.memories(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null,
  due_at           timestamptz,
  status           action_status not null default 'open',
  source_entity_id text references public.entities(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists action_items_due_idx on public.action_items (user_id, status, due_at);
drop trigger if exists t_action_items_touch on public.action_items;
create trigger t_action_items_touch before update on public.action_items
  for each row execute function public.touch_updated_at();

-- ---------- memory_links ----------
create table if not exists public.memory_links (
  src_memory_id text not null references public.memories(id) on delete cascade,
  dst_memory_id text not null references public.memories(id) on delete cascade,
  relation      text not null default 'related',
  score         real,
  created_at    timestamptz not null default now(),
  primary key (src_memory_id, dst_memory_id, relation),
  check (src_memory_id <> dst_memory_id)
);

-- ---------- chat ----------
create table if not exists public.chat_sessions (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists t_chat_sessions_touch on public.chat_sessions;
create trigger t_chat_sessions_touch before update on public.chat_sessions
  for each row execute function public.touch_updated_at();

create table if not exists public.chat_messages (
  id              text primary key,
  session_id      text not null references public.chat_sessions(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            chat_role not null,
  content         text not null,
  citations       jsonb not null default '[]'::jsonb,
  used_filters    jsonb not null default '{}'::jsonb,
  retrieval_debug jsonb not null default '{}'::jsonb,
  model_meta      jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists chat_messages_session_idx on public.chat_messages (session_id, created_at);

-- ---------- idempotency ----------
create table if not exists public.idempotency_keys (
  key         text primary key,
  user_id     uuid not null,
  capture_id  text not null references public.captures(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ================================================================= --
-- Row-Level Security                                                 --
-- Every table is private to its owner. Join tables inherit ownership --
-- from their parent memory.                                          --
-- ================================================================= --

alter table public.profiles        enable row level security;
alter table public.captures        enable row level security;
alter table public.memories        enable row level security;
alter table public.chunks          enable row level security;
alter table public.embeddings      enable row level security;
alter table public.entities        enable row level security;
alter table public.tags            enable row level security;
alter table public.memory_tags     enable row level security;
alter table public.action_items    enable row level security;
alter table public.memory_links    enable row level security;
alter table public.chat_sessions   enable row level security;
alter table public.chat_messages   enable row level security;
alter table public.idempotency_keys enable row level security;

-- profiles: user can see/update only their own row
drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- helper: simple owner policy for tables with a user_id column
do $$
declare t text;
begin
  foreach t in array array[
    'captures','memories','chunks','embeddings','entities','tags',
    'action_items','chat_sessions','chat_messages','idempotency_keys'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t||'_own', t);
    execute format(
      'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t||'_own', t
    );
  end loop;
end $$;

-- memory_tags: ownership via parent memory
drop policy if exists "memory_tags_own" on public.memory_tags;
create policy "memory_tags_own" on public.memory_tags for all
  using (exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid()));

-- memory_links: ownership via source memory
drop policy if exists "memory_links_own" on public.memory_links;
create policy "memory_links_own" on public.memory_links for all
  using (exists (select 1 from public.memories m where m.id = src_memory_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.memories m where m.id = src_memory_id and m.user_id = auth.uid()));

-- ================================================================= --
-- Storage: private bucket for capture images                         --
-- Object path convention: {user_id}/{capture_id}/{original|display|thumb}.jpg
-- ================================================================= --
insert into storage.buckets (id, name, public)
values ('captures', 'captures', false)
on conflict (id) do nothing;

drop policy if exists "captures_objects_read" on storage.objects;
create policy "captures_objects_read" on storage.objects for select
  using (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "captures_objects_write" on storage.objects;
create policy "captures_objects_write" on storage.objects for insert
  with check (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "captures_objects_delete" on storage.objects;
create policy "captures_objects_delete" on storage.objects for delete
  using (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);
