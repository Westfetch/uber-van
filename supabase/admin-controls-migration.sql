-- Admin controls migration
-- Run in Supabase Dashboard → SQL Editor

-- Message replies — audit trail for admin responses
create table if not exists message_replies (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid references messages(id) not null,
  reply_text  text not null,
  sent_via    text not null check (sent_via in ('email', 'sms', 'both')),
  admin_id    uuid references admins(id),
  created_at  timestamptz default now()
);

alter table message_replies enable row level security;
create index if not exists idx_message_replies_message_id on message_replies(message_id);
