-- Widen planning categories for the personal-finance tracker (isolated from ledger/score).
-- Adds investment + health/entertainment/housing/education, tx category overrides, and entry edits.

alter table public.planning_budgets drop constraint if exists planning_budgets_category_check;
alter table public.planning_entries drop constraint if exists planning_entries_category_check;

alter table public.planning_budgets
  add constraint planning_budgets_category_check
  check (category in (
    'food', 'shopping', 'travel', 'bills', 'health',
    'entertainment', 'housing', 'education', 'investment', 'other'
  ));

alter table public.planning_entries
  add constraint planning_entries_category_check
  check (category in (
    'food', 'shopping', 'travel', 'bills', 'health',
    'entertainment', 'housing', 'education', 'investment', 'other'
  ));

create table if not exists public.planning_tx_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  dedupe_hash text not null,
  category text not null check (category in (
    'food', 'shopping', 'travel', 'bills', 'health',
    'entertainment', 'housing', 'education', 'investment', 'other'
  )),
  needs_review boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_hash)
);

create index if not exists planning_tx_overrides_user_idx
  on public.planning_tx_overrides (user_id);

alter table public.planning_tx_overrides enable row level security;
