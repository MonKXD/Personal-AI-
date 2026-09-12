-- ================================================================= --
-- Personal AI 0001 — allowlist, prefs, reminder log                   --
-- Apply in the Supabase SQL editor after 0000_init.sql.              --
-- ================================================================= --

-- ---------- sign-up allowlist ----------
create table if not exists public.allowed_emails (
  email       text primary key,
  note        text,
  added_by    uuid,
  created_at  timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;
-- No policies: only the service role / direct Postgres connection may read it.
-- (The app checks the allowlist over the pooled connection, which bypasses RLS.)

-- Don't lock out anyone who already has an account.
insert into public.allowed_emails (email, note)
select lower(email), 'existing user (auto-added by 0001)'
from auth.users
where email is not null
on conflict (email) do nothing;

-- ---------- per-user preferences ----------
create table if not exists public.profile_prefs (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  tz              text not null default 'Asia/Kolkata',
  email_reminders boolean not null default true,
  weekly_digest   boolean not null default true,
  updated_at      timestamptz not null default now()
);
alter table public.profile_prefs enable row level security;
drop policy if exists "profile_prefs_own" on public.profile_prefs;
create policy "profile_prefs_own" on public.profile_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists t_profile_prefs_touch on public.profile_prefs;
create trigger t_profile_prefs_touch before update on public.profile_prefs
  for each row execute function public.touch_updated_at();

-- ---------- reminder dedupe log ----------
create table if not exists public.reminder_log (
  action_item_id text not null,
  kind           text not null,
  sent_at        timestamptz not null default now(),
  primary key (action_item_id, kind)
);
alter table public.reminder_log enable row level security;
-- service-role only.

-- ---------- helpful index for the daily cap + recovery ----------
create index if not exists captures_user_created_idx on public.captures (user_id, created_at desc);
create index if not exists captures_status_updated_idx on public.captures (status, updated_at)
  where status <> 'ready' and status <> 'failed';
