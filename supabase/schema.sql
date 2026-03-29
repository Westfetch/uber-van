-- uber-van platform schema
-- Run in Supabase Dashboard → SQL Editor
-- Tables: funnels, drivers, jobs, job_offers, job_items, job_events, payouts

-- ── 1. funnels ───────────────────────────────────────────────────────────────
-- One row per operator (VDM, future white-label firms, packing service, etc.)
create table if not exists funnels (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,              -- "Van Dem Massive"
  slug             text unique not null,       -- "vdm"
  depot_postcode   text not null,              -- "BS1 1AA" — quote origin point
  platform_fee_pct numeric not null default 5, -- platform cut %
  webhook_secret   text not null,              -- HMAC-SHA256 key for inbound webhooks
  created_at       timestamptz default now()
);

-- ── 2. drivers ───────────────────────────────────────────────────────────────
create table if not exists drivers (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  phone                  text,
  email                  text,
  depot_postcode         text not null,
  van_size               text not null check (van_size in ('swb','mwb','lwb','luton','7.5t')),
  stripe_account_id      text,                 -- Stripe Connect express account ID
  online                 boolean not null default false,
  setup_code_hash        varchar(64),          -- SHA-256 of one-time setup code, cleared on use
  setup_code_expires_at  timestamptz,
  push_subscription      text,                 -- VAPID push JSON (future)
  created_at             timestamptz default now()
);

-- ── 3. jobs ──────────────────────────────────────────────────────────────────
create table if not exists jobs (
  id                        uuid primary key default gen_random_uuid(),
  funnel_id                 uuid references funnels(id) not null,
  funnel_job_ref            text,              -- chatbot session or booking ref from funnel

  -- Customer details (server-side only, not exposed raw to drivers)
  customer_name             text,
  customer_phone            text,
  customer_email            text,

  -- Locations
  pickup_postcode           text not null,
  destination_postcode      text not null,
  move_date                 date not null,
  start_time                time,

  -- Quote data from chatbot
  context_block             jsonb,             -- precomputed: miles, CAZ, bank_holiday, ULEZ flags
  quote_data                jsonb,             -- full matched_items, access, running_totals
  effective_volume_cuft     numeric,
  van_loads                 int,
  crew_required             int,
  van_size                  text default 'luton',  -- van category quoted for this job

  -- Financials
  customer_quote_gbp        numeric not null,
  deposit_gbp               numeric not null,
  balance_gbp               numeric not null,
  stripe_payment_intent_id  text,
  stripe_deposit_charge_id  text,

  -- Status lifecycle
  status text not null default 'pending_payment'
    check (status in (
      'pending_payment',    -- awaiting deposit
      'pending_acceptance', -- deposit paid, awaiting driver
      'accepted',           -- driver has accepted
      'in_progress',        -- job underway
      'completed',          -- signed off, balance charged
      'cancelled',          -- no driver found / customer cancelled
      'refunded'            -- deposit returned
    )),

  -- Assignment
  driver_id                 uuid references drivers(id),
  accepted_at               timestamptz,
  completed_at              timestamptz,

  -- Day-of adjustments
  actual_miles              numeric,
  final_total_gbp           numeric,

  created_at                timestamptz default now()
);

-- ── 4. job_offers ────────────────────────────────────────────────────────────
-- Each time a job is offered to a driver, a row is created.
-- Joe gets first dibs (30 min window). Future: broadcast to nearest eligible driver.
create table if not exists job_offers (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid references jobs(id) not null,
  driver_id         uuid references drivers(id) not null,
  offered_at        timestamptz not null default now(),
  expires_at        timestamptz not null,      -- offered_at + 30 min

  -- Driver-specific pricing (distance recalculated from driver's depot)
  driver_road_miles numeric,                   -- OSRM: driver depot → pickup → dest → driver depot
  driver_payout_gbp numeric,                   -- customer_quote × (1 - fee_pct/100), adjusted for driver miles

  status text not null default 'pending'
    check (status in ('pending','accepted','declined','expired')),

  unique (job_id, driver_id)                   -- one offer per driver per job
);

-- ── 5. job_items ─────────────────────────────────────────────────────────────
-- Items on a job — both booked (from chatbot) and added on the day (by driver).
create table if not exists job_items (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references jobs(id) not null,
  canonical_name  text not null,
  quantity        int not null default 1,
  volume_cuft     numeric,
  added_by        text not null check (added_by in ('customer','driver')),
  added_at        timestamptz not null default now(),
  active          boolean not null default true,  -- false = removed on the day
  price_delta_gbp numeric not null default 0      -- effect on final total
);

-- ── 6. job_events ────────────────────────────────────────────────────────────
-- Immutable audit trail. Every meaningful action on a job gets a row.
-- Used for dispute resolution and the customer-facing transparency log.
create table if not exists job_events (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid references jobs(id) not null,
  event_type   text not null,
  -- Valid event_type values:
  --   deposit_charged | offer_sent | offer_accepted | offer_declined | offer_expired
  --   item_added | item_removed | miles_adjusted
  --   customer_notified | customer_signed_off
  --   balance_charged | driver_paid_out
  --   cancelled | refunded
  payload      jsonb,           -- event-specific data
  created_by   text,            -- 'customer' | 'driver' | 'system'
  created_at   timestamptz not null default now()
);

-- ── 7. payouts ───────────────────────────────────────────────────────────────
create table if not exists payouts (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid references jobs(id) not null,
  driver_id           uuid references drivers(id) not null,
  gross_gbp           numeric not null,
  platform_fee_gbp    numeric not null,
  net_gbp             numeric not null,
  stripe_transfer_id  text,
  status              text not null default 'pending'
    check (status in ('pending','transferred','failed')),
  created_at          timestamptz default now()
);

-- ── 8. platform_config ──────────────────────────────────────────────────────
-- Singleton table for runtime-editable pricing constants.
-- The wizard reads this instead of hardcoded values.
create table if not exists platform_config (
  id         int primary key default 1 check (id = 1),
  pricing    jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Enable realtime on tables drivers poll / customers track
alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table job_offers;

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table funnels     enable row level security;
alter table drivers     enable row level security;
alter table jobs        enable row level security;
alter table job_offers  enable row level security;
alter table job_items   enable row level security;
alter table job_events  enable row level security;
alter table payouts     enable row level security;

-- All data access goes through service-role API routes (serverless functions).
-- No public client access. All policies deny by default — only service role bypasses RLS.

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_jobs_status         on jobs(status);
create index if not exists idx_jobs_driver_id      on jobs(driver_id);
create index if not exists idx_jobs_funnel_id      on jobs(funnel_id);
create index if not exists idx_job_offers_job_id   on job_offers(job_id);
create index if not exists idx_job_offers_driver_id on job_offers(driver_id);
create index if not exists idx_job_items_job_id    on job_items(job_id);
create index if not exists idx_job_events_job_id   on job_events(job_id);
create index if not exists idx_payouts_job_id      on payouts(job_id);
