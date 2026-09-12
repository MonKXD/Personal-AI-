-- ================================================================= --
-- MirrorMind 0012 — outbound webhooks                                --
-- Apply in the Supabase SQL editor after 0000..0011.                 --
-- ================================================================= --
--
-- "When X happens, POST to my URL." Deliveries are signed with
-- HMAC-SHA256 of the body using `secret` (X-MirrorMind-Signature header).
-- A hook is auto-disabled after 15 consecutive failures.

create table if not exists public.webhooks (
  id            text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  url           text not null,
  secret        text not null,
  events        jsonb not null default '[]'::jsonb,  -- ["memory.created", ...] or ["*"]
  active        boolean not null default true,
  failure_count integer not null default 0,
  last_status   integer,
  last_delivery_at timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists webhooks_user_idx on public.webhooks (user_id, created_at desc);

alter table public.webhooks enable row level security;
drop policy if exists "webhooks_own" on public.webhooks;
create policy "webhooks_own" on public.webhooks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
