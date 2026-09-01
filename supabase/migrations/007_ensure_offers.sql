-- Idempotent patch: older 001 deployments lacked offers.image_url.
-- Goldback + offers tables come from 001; notifications from 006.
alter table public.offers add column if not exists image_url text;
