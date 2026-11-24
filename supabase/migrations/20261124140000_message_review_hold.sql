-- Message review hold + security dashboard. Run AFTER both message security
-- steps (20261124130000 and 20261124130100), and BEFORE merging the
-- security-pr2 PR. Additive apart from replacing the messages SELECT policy
-- (step 3), which the current code is unaffected by.

-- 1. Message status. Existing messages are all "delivered".
alter table public.messages
  add column if not exists status text not null default 'delivered',
  add column if not exists hold_reasons text[] not null default '{}',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'messages_status_check') then
    alter table public.messages
      add constraint messages_status_check check (status in ('delivered', 'pending', 'rejected'));
  end if;
end $$;

create index if not exists messages_pending_idx on public.messages (created_at desc) where status = 'pending';

-- Senders can see that their own message is awaiting review.
grant select (status) on public.messages to authenticated;

-- 2. Account trust: "new" until a message is approved, then "trusted";
--    "suspended" stops all messaging. Service role only, so users can't
--    promote themselves.
create table if not exists public.account_trust (
  user_id uuid primary key,
  status text not null default 'new' check (status in ('new', 'trusted', 'suspended')),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  note text
);
alter table public.account_trust enable row level security;
alter table public.account_trust force row level security;
revoke all on public.account_trust from anon, authenticated;

-- 3. Recipients only ever see delivered messages. Senders see their own
--    messages whatever their status.
--
--    Production also had four older policies that aren't in any migration
--    (from an earlier hand-built version of messaging). Policies of the same
--    kind are OR'd together, so an older SELECT policy could let a seller
--    read held messages. They are removed; the two versioned policies below
--    cover everything the app does (read own messages, mark as read).
drop policy if exists "Users can send messages in their conversations" on public.messages;
drop policy if exists "Users can read messages in their conversations" on public.messages;
drop policy if exists "Users can view messages in their conversations" on public.messages;
drop policy if exists "Users can mark messages in their conversations as read" on public.messages;

drop policy if exists "Users can read their own messages" on public.messages;
create policy "Users can read their own messages"
on public.messages
for select
to authenticated
using (sender_id = auth.uid() or (recipient_id = auth.uid() and status = 'delivered'));

-- 4. Who can open /admin/security. Service role only.
create table if not exists public.admin_users (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
alter table public.admin_users force row level security;
revoke all on public.admin_users from anon, authenticated;

-- 5. Make yourself an admin: put the email address you log in to OwnerCars
--    with between the quotes, then run this statement.
insert into public.admin_users (user_id)
select id from auth.users where lower(email) = lower('YOUR-LOGIN-EMAIL@example.com')
on conflict do nothing;

-- Check: the policies should now be exactly "Users can read their own
-- messages" (SELECT) and "Recipients can mark messages read" (UPDATE), and
-- admin_users should contain your account (checked in the next statement).
select u.email as admin_email from public.admin_users a join auth.users u on u.id = a.user_id;

select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'messages'
order by cmd, policyname;
