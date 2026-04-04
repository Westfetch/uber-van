-- Add metadata column to messages for escalation context
-- Run in Supabase Dashboard > SQL Editor (uber-van project)

alter table messages add column if not exists metadata jsonb default '{}';

-- Index on source for filtering escalations vs contact messages
create index if not exists idx_messages_source on messages(source);

-- Index on metadata->escalation_type for filtered queries
create index if not exists idx_messages_escalation_type on messages((metadata->>'escalation_type'));
