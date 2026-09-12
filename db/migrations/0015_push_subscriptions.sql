-- ================================================================= --
-- Personal AI 0015 — Web Push subscriptions                           --
-- Apply in the Supabase SQL editor after 0000..0014.                 --
-- ================================================================= --
--
-- One row per browser/device that opted in to push. Endpoints that come
-- back 404/410 (unsubscribed) are deleted on the next send.

create table if not exists public.push_subscriptions (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
