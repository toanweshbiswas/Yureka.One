-- Yureka Goldback schema (project sfdqxpybtmsfbjppoydh)

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

-- Service role / Express backend uses service key (bypasses RLS).
-- Anon can read active offers.
drop policy if exists offers_public_read on public.offers;
create policy offers_public_read on public.offers
  for select using (active = true);

-- Seed offers (safe to re-run: only inserts when table empty)
insert into public.offers (title, merchant, category, description, url, reward_paise, reward_label, active)
select * from (values
  (
    'Nykaa Beauty Haul',
    'Nykaa',
    'beauty',
    'Shop beauty essentials via Yureka and earn Goldback on eligible orders.',
    'https://www.nykaa.com',
    2500,
    '₹25 Goldback',
    true
  ),
  (
    'Amazon Fashion',
    'Amazon',
    'shopping',
    'Track your Amazon fashion spend and earn face-value Goldback.',
    'https://www.amazon.in',
    5000,
    '₹50 Goldback',
    true
  ),
  (
    'Swiggy Weekend',
    'Swiggy',
    'food',
    'Order food this weekend through the tracked link to earn Goldback.',
    'https://www.swiggy.com',
    1500,
    '₹15 Goldback',
    true
  ),
  (
    'Myntra Style Drop',
    'Myntra',
    'fashion',
    'Fashion drops with Goldback credited after confirmed conversion.',
    'https://www.myntra.com',
    4000,
    '₹40 Goldback',
    true
  ),
  (
    'Flipkart Electronics',
    'Flipkart',
    'electronics',
    'Electronics deals that pay Goldback you can redeem at face value later.',
    'https://www.flipkart.com',
    7500,
    '₹75 Goldback',
    true
  )
) as v(title, merchant, category, description, url, reward_paise, reward_label, active)
where not exists (select 1 from public.offers limit 1);
