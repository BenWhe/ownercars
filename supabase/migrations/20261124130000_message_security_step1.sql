-- Message security, step 1 of 2. ADDITIVE ONLY: safe to run before the code
-- deploys (the current code ignores the new columns and table).
--
-- Run in the Supabase SQL editor BEFORE merging the security-pr1 PR.

-- 1. Where each message came from (filled in by the server on send).
alter table public.messages
  add column if not exists sender_ip text,
  add column if not exists sender_country text,
  add column if not exists sender_region text,
  add column if not exists sender_city text,
  add column if not exists sender_user_agent text;

-- 2. Log of messages that were blocked because they contained contact
--    details. Kept as evidence: no foreign keys, so rows survive if the
--    advert or the sender's account is later deleted.
create table if not exists public.message_blocks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  advert_id uuid,
  sender_id uuid not null,
  recipient_id uuid,
  body text not null,
  reasons text[] not null default '{}',
  sender_ip text,
  sender_country text,
  sender_region text,
  sender_city text,
  sender_user_agent text
);

create index if not exists message_blocks_sender_idx on public.message_blocks (sender_id, created_at desc);
create index if not exists message_blocks_created_idx on public.message_blocks (created_at desc);

-- Service role only: RLS on with no policies.
alter table public.message_blocks enable row level security;
alter table public.message_blocks force row level security;
revoke all on public.message_blocks from anon, authenticated;

-- 3. Recipients may only change read_at. The existing "Recipients can mark
--    messages read" policy allowed a recipient to update any column of a
--    message sent to them (including its text); column privileges now limit
--    signed-in users to read_at.
revoke update on public.messages from anon, authenticated;
grant update (read_at) on public.messages to authenticated;
