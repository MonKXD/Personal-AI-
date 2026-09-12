-- ================================================================= --
-- MirrorMind 0013 — in-app feedback                                  --
-- Apply in the Supabase SQL editor after 0000..0012.                 --
-- ================================================================= --
--
-- "Report a problem" messages from beta users. The owner sees them at
-- /settings/feedback and gets a notification in the bell.

create table if not exists public.feedback (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  message    text not null,
  page       text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback for insert
  with check (user_id = auth.uid());
