-- Primary ledger cache: survives restarts and multi-instance hosts (mirrors planning_inbox_cache).
create table if not exists public.financial_ledger_cache (
  user_id text not null,
  gmail text not null,
  scanned_at timestamptz not null default now(),
  profile jsonb not null default '{}'::jsonb,
  transactions jsonb not null default '[]'::jsonb,
  score jsonb,
  scan_version int not null default 1,
  primary key (user_id, gmail)
);

create index if not exists financial_ledger_cache_user_idx
  on public.financial_ledger_cache (user_id);

create index if not exists financial_ledger_cache_gmail_idx
  on public.financial_ledger_cache (gmail);

alter table public.financial_ledger_cache enable row level security;
