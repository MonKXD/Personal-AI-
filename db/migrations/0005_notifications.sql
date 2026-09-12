-- ================================================================= --
-- MirrorMind 0005 — in-app notifications                             --
-- Apply in the Supabase SQL editor after 0000..0004.                 --
-- ================================================================= --
--
-- A lightweight per-user feed. The digest / reminder crons and the
-- capture pipeline write rows; the app shows a bell with an unread count
-- and a dropdown. `dedupe_key` lets a writer skip re-inserting the same
-- notification (e.g. the same due-soon action item across cron runs).

create table if not exists public.notifications (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,              -- 'due_soon' | 'weekly_digest' | 'needs_review' | ...
  title       text not null,
  body        text,
  href        text,                       -- in-app link, e.g. /memory/<id>
  dedupe_key  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create unique index if not exists notifications_dedupe_idx
  on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

alter table public.notifications enable row level security;
drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
