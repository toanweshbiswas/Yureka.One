-- Hubble gift-card orders + vouchers (run in Supabase SQL editor)

create extension if not exists "pgcrypto";

create table if not exists public.hubble_orders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  reference_id text not null unique,
  hubble_order_id text,
  product_id text not null,
  product_title text not null default '',
  amount_inr numeric(12, 2) not null check (amount_inr > 0),
  denomination numeric(12, 2) not null check (denomination > 0),
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REVERSED')),
  failure_reason text,
  customer_name text,
  customer_email text,
  customer_phone text,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hubble_vouchers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.hubble_orders(id) on delete cascade,
  hubble_voucher_id text,
  card_type text,
  card_number text,
  card_pin text,
  amount numeric(12, 2),
  valid_till date,
  created_at timestamptz not null default now()
);

create table if not exists public.hubble_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hubble_orders_user_created_idx
  on public.hubble_orders (user_id, created_at desc);

create index if not exists hubble_orders_hubble_id_idx
  on public.hubble_orders (hubble_order_id);

create index if not exists hubble_vouchers_order_idx
  on public.hubble_vouchers (order_id);

alter table public.hubble_orders enable row level security;
alter table public.hubble_vouchers enable row level security;
alter table public.hubble_webhook_events enable row level security;
