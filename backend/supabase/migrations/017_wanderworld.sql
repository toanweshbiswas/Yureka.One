-- WanderWorld trips platform (run in Supabase SQL editor when ready).
-- API v1 uses file store (data/wanderworld_store.json); this schema is for future cutover.

create extension if not exists "pgcrypto";

create table if not exists wanderworld_orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists wanderworld_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references wanderworld_orgs(id) on delete cascade,
  email text not null,
  user_id uuid,
  role text not null check (role in ('owner', 'admin', 'promoter')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (org_id, email)
);

create table if not exists wanderworld_trips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references wanderworld_orgs(id) on delete cascade,
  title text not null,
  slug text not null,
  description text not null default '',
  itinerary text not null default '',
  price_inr numeric not null default 0,
  seats int not null default 1,
  seats_taken int not null default 0,
  start_date date,
  end_date date,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  payment_plans_enabled boolean not null default false,
  plan_template jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

create table if not exists wanderworld_promoter_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references wanderworld_orgs(id) on delete cascade,
  member_id uuid not null references wanderworld_members(id) on delete cascade,
  code text not null unique,
  trip_id uuid references wanderworld_trips(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists wanderworld_registrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references wanderworld_orgs(id) on delete cascade,
  trip_id uuid not null references wanderworld_trips(id) on delete cascade,
  user_id uuid not null,
  buyer_email text not null,
  buyer_name text not null,
  buyer_phone text,
  promoter_code text,
  payment_mode text not null check (payment_mode in ('full', 'plan')),
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid', 'cancelled')),
  amount_due_inr numeric not null default 0,
  amount_paid_inr numeric not null default 0,
  notes text,
  city text,
  group_size int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wanderworld_installments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references wanderworld_registrations(id) on delete cascade,
  sequence int not null,
  label text not null,
  amount_inr numeric not null,
  due_at timestamptz not null,
  status text not null default 'due' check (status in ('due', 'paid', 'overdue', 'cancelled')),
  razorpay_order_id text,
  razorpay_payment_id text,
  paid_at timestamptz
);

create index if not exists wanderworld_trips_status_idx on wanderworld_trips (status);
create index if not exists wanderworld_regs_user_idx on wanderworld_registrations (user_id);
create index if not exists wanderworld_regs_trip_idx on wanderworld_registrations (trip_id);
create unique index if not exists wanderworld_regs_user_trip_active_idx
  on wanderworld_registrations (user_id, trip_id)
  where status <> 'cancelled';
create index if not exists wanderworld_installments_rzp_idx on wanderworld_installments (razorpay_order_id);

alter table wanderworld_orgs enable row level security;
alter table wanderworld_members enable row level security;
alter table wanderworld_trips enable row level security;
alter table wanderworld_promoter_links enable row level security;
alter table wanderworld_registrations enable row level security;
alter table wanderworld_installments enable row level security;
