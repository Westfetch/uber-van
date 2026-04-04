-- The Pipe diagnostic log table
-- Receives events from the Android app via /api/pipe-log

create table if not exists pipe_logs (
  id          bigint generated always as identity primary key,
  device_id   text not null default 'unknown',
  shift_id    text,
  event_type  text not null default 'log',
  message     text not null default '',
  data        jsonb,
  client_timestamp timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- Index for querying by shift or time range
create index if not exists idx_pipe_logs_shift on pipe_logs (shift_id, created_at desc);
create index if not exists idx_pipe_logs_type on pipe_logs (event_type, created_at desc);

-- RLS: service key only (no client-side reads needed)
alter table pipe_logs enable row level security;

-- Allow inserts from service key (api route uses getSupabaseAdmin)
create policy "service_insert" on pipe_logs for insert
  with check (true);

create policy "service_select" on pipe_logs for select
  using (true);
