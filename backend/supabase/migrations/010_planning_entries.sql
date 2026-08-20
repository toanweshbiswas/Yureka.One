-- Manual expenses for planning. Isolated from waitlist score and ledger resync.

create table if not exists public.planning_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  merchant text not null,
  amount_inr numeric not null check (amount_inr > 0),
  category text not null check (category in ('food', 'shopping', 'travel', 'bills', 'other')),
  date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists planning_entries_user_date_idx
  on public.planning_entries (user_id, date desc);

alter table public.planning_entries enable row level security;
