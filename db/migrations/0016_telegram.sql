-- ================================================================= --
-- Personal AI 0016 — Telegram bot linking                             --
-- Apply in the Supabase SQL editor after 0000..0015.                 --
-- ================================================================= --
--
-- Links one Telegram chat to one Personal AI account. `link_code` is a
-- short-lived one-time code shown in Settings; the bot's /start <code>
-- handler swaps it for the chat id.

create table if not exists public.telegram_links (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  chat_id          text unique,
  link_code        text unique,
  link_code_expires timestamptz,
  linked_at        timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.telegram_links enable row level security;
drop policy if exists "telegram_links_own" on public.telegram_links;
create policy "telegram_links_own" on public.telegram_links for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
