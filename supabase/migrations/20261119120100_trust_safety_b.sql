-- P1 trust & safety — Part B: lock-down.
-- RUN ONLY AFTER p1-trust-safety IS DEPLOYED
--
-- Removes direct authenticated/anon write access to messages and profiles.
-- After this runs, every insert/update on these two tables must go through
-- the service-role client in the API routes. Running this before
-- p1-trust-safety is live and tested will break messaging and account
-- editing, because the code on main still inserts/updates both tables with
-- the user-scoped client.

-- ── 1. Messages: drop the insert policies ───────────────────────────────────
-- All inserts then come through the service-role client in the API routes.
drop policy if exists "Users can create valid advert messages" on public.messages;
drop policy if exists "Users can send messages in their conversations" on public.messages;

-- ── 2. Messages: authenticated/anon lose direct write access ───────────────
-- SELECT is left alone (Part A's policy already restricts it to
-- sender-sees-all / recipient-sees-delivered). Only read_at stays directly
-- writable, so "Recipients can mark messages read" still works — that
-- policy plus this column grant together mean a recipient can still only
-- ever move read_at on a message addressed to them.
revoke insert, update, delete, truncate, references, trigger
  on public.messages from authenticated, anon;

grant update (read_at) on public.messages to authenticated;

-- ── 3. Profiles: authenticated/anon lose direct write access ───────────────
-- Every current write site (app/api/account, app/api/messages's postcode
-- self-heal, app/api/publish-with-credit) already writes through the
-- service role — confirmed by grep across app/ and lib/, see report. No
-- code path on main depends on a direct authenticated/anon write to
-- profiles.
revoke insert, update, delete, truncate
  on public.profiles from authenticated, anon;
