-- Message security, step 2 of 2. Run AFTER the security-pr1 code is live on
-- production. From then on every send path inserts with the service role and
-- no route selects "*" from messages.
--
-- Check first: this should return exactly one INSERT policy, named
-- "Users can create valid advert messages", plus the SELECT and UPDATE
-- policies. If it shows anything else, stop and send the output before
-- running the rest.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'messages'
order by cmd, policyname;

-- 1. No direct inserts by signed-in users. The RLS insert policy let anyone
--    with a session write messages straight through the Supabase API,
--    bypassing the server-side checks (contact-detail filter, and the review
--    hold coming next).
drop policy if exists "Users can create valid advert messages" on public.messages;
revoke insert on public.messages from anon, authenticated;

-- 2. Buyers and sellers can read only the conversation columns, never the
--    sender_* evidence columns (IP, location, device). Matches
--    lib/messages/columns.ts.
revoke select on public.messages from anon, authenticated;
grant select (
  id, advert_id, sender_id, recipient_id, body, read_at, created_at,
  event_type, document_type, signed_url, url_expires_at
) on public.messages to authenticated;

-- Verify: policies should now be SELECT and UPDATE only, and the column
-- grants for "authenticated" should be the SELECT list above plus UPDATE on
-- read_at.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'messages'
order by cmd, policyname;

select privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'messages' and grantee = 'authenticated'
order by privilege_type, column_name;
