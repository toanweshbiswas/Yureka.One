-- Idempotent: create Goldback tables if 001 was never applied on this project.
-- Fixes admin offer delete: "Could not find the table 'public.offers' in the schema cache"

create extension if not exists "pgcrypto";

create table if not exists public.goldback_accounts (
  user_id text primary key,
  balance_paise bigint not null default 0 check (balance_paise >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  merchant text not null,
  category text not null default 'general',
  description text not null default '',
  url text not null,
  image_url text,
  reward_paise integer not null default 0 check (reward_paise >= 0),
  reward_label text not null default '',
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.offers add column if not exists image_url text;

create table if not exists public.goldback_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null check (type in ('earn', 'redeem', 'adjust')),
  amount_paise bigint not null,
  offer_id uuid references public.offers(id) on delete set null,
  status text not null default 'earned' check (status in ('pending', 'earned', 'failed', 'redeemed')),
  idempotency_key text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.offer_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  offer_id uuid not null references public.offers(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists goldback_ledger_user_created_idx
  on public.goldback_ledger (user_id, created_at desc);

create index if not exists offers_active_idx on public.offers (active) where active = true;

alter table public.goldback_accounts enable row level security;
alter table public.offers enable row level security;
alter table public.goldback_ledger enable row level security;
alter table public.offer_clicks enable row level security;

drop policy if exists offers_public_read on public.offers;
create policy offers_public_read on public.offers
  for select using (active = true);

-- Per-user in-app notification inbox (from 006)
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  email text,
  title text not null,
  body text not null default '',
  type text not null default 'info',
  href text,
  image_url text,
  dedupe_key text,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

create unique index if not exists user_notifications_user_dedupe_idx
  on public.user_notifications (user_id, dedupe_key)
  where dedupe_key is not null;

alter table public.user_notifications enable row level security;
