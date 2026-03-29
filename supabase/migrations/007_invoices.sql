-- Weekly invoice payment system: invoices, invoice_lines, driver bank details
-- Replaces Stripe Connect payouts with BACS bank transfer model

-- ── 1. invoices table ─────────────────────────────────────────────────────────
create table if not exists invoices (
  id               uuid primary key default gen_random_uuid(),
  driver_id        uuid references drivers(id) not null,
  invoice_number   text unique not null,
  week_start       date not null,
  week_end         date not null,
  job_count        int not null default 0,
  gross_gbp        numeric not null default 0,
  platform_fee_gbp numeric not null default 0,
  net_gbp          numeric not null default 0,
  status           text not null default 'draft'
    check (status in ('draft','issued','paid','failed')),
  issued_at        timestamptz,
  paid_at          timestamptz,
  paid_by          text,
  payment_ref      text,
  created_at       timestamptz default now()
);

create index idx_invoices_driver_id  on invoices(driver_id);
create index idx_invoices_status     on invoices(status);
create index idx_invoices_week_start on invoices(week_start);

alter table invoices enable row level security;

-- ── 2. invoice_lines table ────────────────────────────────────────────────────
create table if not exists invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid references invoices(id) not null,
  payout_id   uuid references payouts(id) not null,
  job_id      uuid references jobs(id) not null,
  move_date   date,
  description text not null,
  gross_gbp   numeric not null,
  fee_gbp     numeric not null,
  net_gbp     numeric not null
);

create index idx_invoice_lines_invoice_id on invoice_lines(invoice_id);

alter table invoice_lines enable row level security;

-- ── 3. Extend payouts with invoice reference and new status ───────────────────
alter table payouts add column if not exists invoice_id uuid references invoices(id);
create index if not exists idx_payouts_invoice_id on payouts(invoice_id);

-- Update status constraint to include 'invoiced'
alter table payouts drop constraint if exists payouts_status_check;
alter table payouts add constraint payouts_status_check
  check (status in ('pending','invoiced','transferred','failed'));

-- ── 4. Add bank details to drivers ───────────────────────────────────────────
alter table drivers add column if not exists bank_sort_code    text;
alter table drivers add column if not exists bank_account_no   text;
alter table drivers add column if not exists bank_account_name text;
