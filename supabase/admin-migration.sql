-- Admin dashboard migration
-- Run in Supabase Dashboard → SQL Editor AFTER the main schema.sql

-- ── admins table ────────────────────────────────────────────────────────────
create table if not exists admins (
  id             uuid primary key default gen_random_uuid(),
  email          text unique not null,
  password_hash  text not null,
  name           text not null,
  created_at     timestamptz default now()
);
alter table admins enable row level security;

-- ── Seed admin ──────────────────────────────────────────────────────────────
-- Password: changeme123 (bcryptjs hash, cost 10)
-- CHANGE THIS immediately after first login by updating the row directly.
insert into admins (email, password_hash, name)
values (
  'admin@ubervan.co.uk',
  '$2b$10$5e7Rg5loQJUnqisz9KDpmOOnVJaHXWAu0VKUyGacRTywcVm/Sjb6C',
  'Admin'
) on conflict (email) do nothing;

-- ── WebAuthn columns ────────────────────────────────────────────────────────
alter table admins add column if not exists webauthn_credentials jsonb;
alter table admins add column if not exists webauthn_challenge text;

-- ── Performance indexes ─────────────────────────────────────────────────────
create index if not exists idx_jobs_move_date     on jobs(move_date);
create index if not exists idx_payouts_status     on payouts(status);
create index if not exists idx_payouts_driver_id  on payouts(driver_id);
