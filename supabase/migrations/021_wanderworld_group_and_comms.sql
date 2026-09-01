-- WanderWorld: group booking columns, installment extras, webhook idempotency

alter table public.wanderworld_trips
  add column if not exists group_booking_enabled boolean not null default false,
  add column if not exists group_seats int not null default 0,
  add column if not exists group_seats_taken int not null default 0,
  add column if not exists group_discount_type text not null default 'percent',
  add column if not exists group_discount_value numeric not null default 0,
  add column if not exists group_min_size int not null default 2,
  add column if not exists group_max_size int not null default 20;

alter table public.wanderworld_members
  add column if not exists display_name text,
  add column if not exists phone text,
  add column if not exists city text,
  add column if not exists bio text,
  add column if not exists instagram text,
  add column if not exists assigned_trip_ids jsonb not null default '[]'::jsonb;

alter table public.wanderworld_registrations
  add column if not exists is_group boolean not null default false,
  add column if not exists join_code text,
  add column if not exists per_seat_inr numeric,
  add column if not exists list_price_inr numeric,
  add column if not exists discount_inr numeric,
  add column if not exists booked_by_member_id uuid;

create unique index if not exists wanderworld_regs_join_code_idx
  on public.wanderworld_registrations (join_code)
  where join_code is not null;

alter table public.wanderworld_installments
  add column if not exists payment_method text,
  add column if not exists collected_by_member_id uuid,
  add column if not exists cash_note text,
  add column if not exists claimed_by_user_id text,
  add column if not exists claimed_by_email text,
  add column if not exists claimed_by_name text,
  add column if not exists claimed_at timestamptz;

alter table public.wanderworld_promoter_links
  add column if not exists previous_codes jsonb not null default '[]'::jsonb,
  add column if not exists click_count int not null default 0,
  add column if not exists last_clicked_at timestamptz;

create table if not exists public.wanderworld_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  kind text not null default 'razorpay',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wanderworld_webhook_events_created_idx
  on public.wanderworld_webhook_events (created_at desc);

alter table public.wanderworld_webhook_events enable row level security;
