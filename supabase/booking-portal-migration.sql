-- Customer booking portal migration
-- Run in Supabase Dashboard → SQL Editor

-- Token for customer booking page access (SHA-256 hash of UUID token)
alter table jobs add column if not exists customer_token_hash varchar(64);

-- Index for token lookups (only on rows that have a token)
create index if not exists idx_jobs_customer_token_hash
  on jobs(customer_token_hash) where customer_token_hash is not null;

-- Customer notification preferences (email can be toggled, SMS mandatory on job day)
alter table jobs add column if not exists customer_notifications jsonb
  default '{"email": true, "sms": true}'::jsonb;

-- Enable realtime on job_items and job_events for live inventory updates
alter publication supabase_realtime add table job_items;
alter publication supabase_realtime add table job_events;
