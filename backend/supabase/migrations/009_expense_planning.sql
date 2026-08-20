-- Isolated expense-planning tables. Does not touch waitlist, ledger cache, or score.

create extension if not exists "pgcrypto";

create table if not exists public.planning_inboxes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  gmail text not null,
  connected_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  last_error text,
  unique (user_id, gmail)
);

create table if not exists public.planning_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  category text not null check (category in ('food', 'shopping', 'travel', 'bills', 'other')),
  monthly_limit_inr numeric not null default 0 check (monthly_limit_inr >= 0),
  month text not null,
  unique (user_id, category, month)
);

create index if not exists planning_inboxes_user_idx
  on public.planning_inboxes (user_id, connected_at);

create index if not exists planning_budgets_user_month_idx
  on public.planning_budgets (user_id, month);

alter table public.planning_inboxes enable row level security;
alter table public.planning_budgets enable row level security;
