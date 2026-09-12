-- ================================================================= --
-- MirrorMind 0017 — deadline engine, finance, calling, WhatsApp      --
-- Apply in the Supabase SQL editor after 0000..0016.                 --
-- ================================================================= --
--
-- Adds four new modules, adapted from a Firebase/Firestore spec onto this
-- app's actual Postgres + Drizzle + RLS stack (docs/modules/*.md):
--
--  - deadlines: a source-agnostic deadline list. The existing action_items
--    table (capture-derived only) is left untouched; `deadlines` sits
--    alongside it for manual entries and future sources (whatsapp, call).
--    `status` only ever stores 'pending' | 'done' — "missed" is computed at
--    read time from due_at, same as action_items' overdue flag.
--  - finance_transactions / finance_statement_batches: statement-upload +
--    manual expense tracking with AI categorization.
--  - calls: log for the Twilio ConversationRelay calling assistant.
--  - whatsapp_messages / whatsapp_filter_rules: passive WhatsApp triage
--    (Baileys listener runs outside this app — see docs/modules/whatsapp-triage.md).

create type public.deadline_status as enum ('pending', 'done');
create type public.deadline_source as enum ('manual', 'whatsapp', 'call');
create type public.finance_direction as enum ('income', 'expense');
create type public.finance_source as enum ('manual', 'statement_upload');
create type public.statement_batch_status as enum ('processing', 'done', 'failed');
create type public.call_direction as enum ('inbound', 'outbound');
create type public.call_status as enum ('in_progress', 'completed', 'missed', 'voicemail', 'failed');
create type public.whatsapp_category as enum ('important', 'deadline', 'routine', 'promotional', 'filtered');
create type public.whatsapp_filter_action as enum ('mute', 'always_flag');

-- ---------- deadlines ----------
create table if not exists public.deadlines (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  due_at       timestamptz,
  status       public.deadline_status not null default 'pending',
  source       public.deadline_source not null default 'manual',
  source_ref_id text,
  confidence   real,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists deadlines_user_status_due_idx
  on public.deadlines (user_id, status, due_at);
drop trigger if exists t_deadlines_touch on public.deadlines;
create trigger t_deadlines_touch before update on public.deadlines
  for each row execute function public.touch_updated_at();

-- ---------- finance_statement_batches ----------
create table if not exists public.finance_statement_batches (
  id            text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  account_label text not null,
  file_name     text not null,
  status        public.statement_batch_status not null default 'processing',
  row_count     integer not null default 0,
  error_detail  text,
  created_at    timestamptz not null default now()
);
create index if not exists finance_statement_batches_user_idx
  on public.finance_statement_batches (user_id, created_at desc);

-- ---------- finance_transactions ----------
create table if not exists public.finance_transactions (
  id                  text primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  occurred_on         date not null,
  amount              numeric(12, 2) not null,
  direction           public.finance_direction not null,
  category            text not null,
  category_confidence real,
  merchant            text,
  note                text,
  source              public.finance_source not null default 'manual',
  statement_batch_id  text references public.finance_statement_batches(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists finance_transactions_user_date_idx
  on public.finance_transactions (user_id, occurred_on desc);
create index if not exists finance_transactions_user_category_idx
  on public.finance_transactions (user_id, category);
-- Dedupe guard for re-uploaded statements (same account, date, amount, merchant).
create unique index if not exists finance_transactions_dedupe_idx
  on public.finance_transactions (user_id, occurred_on, amount, direction, coalesce(merchant, ''), coalesce(statement_batch_id, ''));

-- ---------- calls ----------
create table if not exists public.calls (
  id               text primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  direction        public.call_direction not null,
  counterpart      text not null,
  status           public.call_status not null default 'in_progress',
  purpose          text,
  instructions     text,
  transcript       jsonb not null default '[]',
  summary          text,
  extracted_tasks  jsonb not null default '[]',
  duration_sec     integer,
  provider_call_sid text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists calls_user_time_idx on public.calls (user_id, created_at desc);
drop trigger if exists t_calls_touch on public.calls;
create trigger t_calls_touch before update on public.calls
  for each row execute function public.touch_updated_at();

-- ---------- whatsapp_filter_rules ----------
create table if not exists public.whatsapp_filter_rules (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  chat_id    text not null,
  action     public.whatsapp_filter_action not null,
  created_at timestamptz not null default now()
);
create unique index if not exists whatsapp_filter_rules_user_chat_idx
  on public.whatsapp_filter_rules (user_id, chat_id);

-- ---------- whatsapp_messages ----------
create table if not exists public.whatsapp_messages (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  chat_id      text not null,
  chat_name    text,
  sender       text,
  direction    text not null default 'in', -- 'in' | 'out' (out is logged, never sent by us)
  text         text not null,
  category     public.whatsapp_category not null default 'routine',
  reason       text,
  is_deadline  boolean not null default false,
  deadline_id  text references public.deadlines(id) on delete set null,
  occurred_at  timestamptz not null,
  created_at   timestamptz not null default now()
);
create index if not exists whatsapp_messages_user_time_idx
  on public.whatsapp_messages (user_id, occurred_at desc);
create index if not exists whatsapp_messages_user_category_idx
  on public.whatsapp_messages (user_id, category, occurred_at desc);
create index if not exists whatsapp_messages_user_chat_idx
  on public.whatsapp_messages (user_id, chat_id);

-- ---------- RLS ----------
alter table public.deadlines               enable row level security;
alter table public.finance_statement_batches enable row level security;
alter table public.finance_transactions    enable row level security;
alter table public.calls                   enable row level security;
alter table public.whatsapp_filter_rules   enable row level security;
alter table public.whatsapp_messages       enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'deadlines', 'finance_statement_batches', 'finance_transactions',
    'calls', 'whatsapp_filter_rules', 'whatsapp_messages'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t||'_own', t);
    execute format(
      'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t||'_own', t
    );
  end loop;
end $$;
