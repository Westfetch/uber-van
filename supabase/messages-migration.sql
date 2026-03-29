-- Contact messages migration
-- Run in Supabase Dashboard → SQL Editor (uber-van project)

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,          -- 'par-wizard', 'psb-wizard', 'par-site', 'psb-site'
  name        text,
  email       text,
  phone       text,
  message     text not null,
  read        boolean not null default false,
  created_at  timestamptz default now()
);

alter table messages enable row level security;
-- No public RLS policies — all access via service-role key

create index if not exists idx_messages_read on messages(read);
create index if not exists idx_messages_created on messages(created_at desc);
