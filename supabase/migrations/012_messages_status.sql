-- Add resolution status to messages
-- Run in Supabase Dashboard > SQL Editor (uber-van project)

alter table messages add column if not exists status text not null default 'open';
create index if not exists idx_messages_status on messages(status);
