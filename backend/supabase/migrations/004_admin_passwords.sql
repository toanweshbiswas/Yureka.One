-- Per-admin passwords and invite tokens (service-role only; RLS already enabled)

alter table public.admin_users
  add column if not exists password_hash text,
  add column if not exists invite_token_hash text,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists password_set_at timestamptz;
