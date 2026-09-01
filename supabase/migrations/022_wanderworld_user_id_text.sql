-- WanderWorld registrations.user_id is a product id (uuid, email, or group:CODE) — not always a Postgres uuid.
alter table public.wanderworld_registrations
  alter column user_id type text using user_id::text;

alter table public.wanderworld_members
  alter column user_id type text using user_id::text;
