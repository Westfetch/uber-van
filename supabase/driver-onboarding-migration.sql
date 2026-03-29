-- Driver onboarding / verification fields
-- Run in Supabase Dashboard → SQL Editor

-- Approval status: pending (new), approved (can receive jobs), suspended (blocked)
alter table drivers add column if not exists approval_status text not null default 'pending';
alter table drivers drop constraint if exists drivers_approval_status_check;
alter table drivers add constraint drivers_approval_status_check
  check (approval_status in ('pending', 'approved', 'suspended'));

-- Document verification flags
alter table drivers add column if not exists insurance_verified boolean not null default false;
alter table drivers add column if not exists insurance_expiry date;
alter table drivers add column if not exists license_verified boolean not null default false;
alter table drivers add column if not exists dbs_verified boolean not null default false;

-- Admin notes
alter table drivers add column if not exists notes text;

-- Driver rating (rolling average from customer reviews)
alter table drivers add column if not exists rating numeric;         -- e.g. 4.7
alter table drivers add column if not exists rating_count int not null default 0;
