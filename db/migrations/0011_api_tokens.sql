-- ================================================================= --
-- MirrorMind 0011 — personal API tokens                              --
-- Apply in the Supabase SQL editor after 0000..0010.                 --
-- ================================================================= --
--
-- Bearer tokens for the public REST API (/api/v1/*). Only the SHA-256
-- hash is stored; the raw token (mm_...) is shown once at creation.

create table if not exists public.api_tokens (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null default 'API token',
  token_hash   text not null unique,
  prefix       text not null,               -- first 11 chars, for display
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists api_tokens_user_idx on public.api_tokens (user_id, created_at desc);

alter table public.api_tokens enable row level security;
drop policy if exists "api_tokens_own" on public.api_tokens;
create policy "api_tokens_own" on public.api_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
