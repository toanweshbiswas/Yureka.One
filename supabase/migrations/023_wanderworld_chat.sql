-- WanderWorld trip group chat (one thread per published trip).

create table if not exists wanderworld_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references wanderworld_orgs(id) on delete cascade,
  trip_id uuid not null references wanderworld_trips(id) on delete cascade,
  author_user_id text not null,
  author_email text,
  author_name text not null default '',
  author_role text not null default 'traveler'
    check (author_role in ('traveler', 'promoter', 'admin', 'owner', 'system')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists wanderworld_messages_trip_created_idx
  on wanderworld_messages (trip_id, created_at desc);

alter table wanderworld_messages enable row level security;
