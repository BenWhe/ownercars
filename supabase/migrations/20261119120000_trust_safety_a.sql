-- P1 trust & safety — Part A: additive only.
-- Safe to run on production at any time. Nothing here changes how existing
-- inserts/updates behave for the code currently live on main. Run this in
-- the Supabase SQL editor BEFORE the p1-trust-safety code branch is
-- merged/deployed.
--
-- Written defensively (if not exists / drop policy if exists) against the
-- actual production schema captured in docs/p1-trust-safety-step0-checks.sql
-- on 2026-11-19, not just supabase/migrations/.

-- ── 1. Evidence table ───────────────────────────────────────────────────────
-- Real IP/UA/geo per security-relevant event. user_id is nullable so a
-- deleted account doesn't take its evidence rows with it.
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in ('sign_up', 'sign_in', 'message_sent', 'message_held', 'draft_created')
  ),
  ip text,
  user_agent text,
  country text,
  region text,
  city text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.security_events enable row level security;
alter table public.security_events force row level security;
-- Deliberately no policies: RLS forced with zero policies means no role
-- using the authenticated/anon PostgREST path can read or write this table
-- at all. Only the service-role key (which bypasses RLS) can.

create index if not exists security_events_user_id_created_at_idx
  on public.security_events (user_id, created_at desc);
create index if not exists security_events_ip_idx
  on public.security_events (ip);

-- ── 2. Message screening columns ────────────────────────────────────────────
alter table public.messages
add column if not exists delivery_status text,
add column if not exists held_reasons text[],
add column if not exists reviewed_at timestamptz;

update public.messages set delivery_status = 'delivered' where delivery_status is null;

alter table public.messages
alter column delivery_status set default 'delivered',
alter column delivery_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_delivery_status_check'
  ) then
    alter table public.messages
    add constraint messages_delivery_status_check
    check (delivery_status in ('delivered', 'held', 'rejected'));
  end if;
end $$;

create index if not exists messages_held_idx
  on public.messages (delivery_status)
  where delivery_status = 'held';

-- ── 3. Read policy ───────────────────────────────────────────────────────────
-- Production also carries three permissive legacy policies from the
-- never-finished conversation_id design (confirmed unused by any code on
-- main — see report): two SELECT policies and one UPDATE policy. The SELECT
-- ones are OR'd with every other SELECT policy on the table, so leaving them
-- would let a recipient see a held message through this table's RLS even
-- after the policy below is tightened. Drop all three; conversation_id,
-- contact_details_redacted and genuine_buyer_declared are left untouched.
drop policy if exists "Users can read messages in their conversations" on public.messages;
drop policy if exists "Users can view messages in their conversations" on public.messages;
drop policy if exists "Users can mark messages in their conversations as read" on public.messages;

drop policy if exists "Users can read their own messages" on public.messages;
create policy "Users can read their own messages"
on public.messages
for select
to authenticated
using (
  sender_id = auth.uid()
  or (recipient_id = auth.uid() and delivery_status = 'delivered')
);

-- ── 4. Before-user-created auth hook (written, NOT enabled) ────────────────
-- Confirmed available on the Free plan (Supabase docs, auth-hooks guide,
-- checked 2026-11-19): "Before User Created" lists Free+Pro, unlike the MFA
-- and password-verification hooks which need Teams/Enterprise.
--
-- Rejects sign-ups whose metadata has no full_name/postcode. Matches the
-- metadata shape app/create-account/page.tsx already sends to signUp():
-- `data: { postcode, full_name }`, which Supabase exposes to the hook under
-- event->'user'->'user_metadata'.
--
-- This function is NOT wired up by this migration. Enabling a hook is a
-- dashboard action (Authentication > Hooks) or a config.toml change, not
-- SQL — see the report for exactly where to turn it on, once Ben decides
-- rejecting incomplete sign-ups outright (vs. the existing self-heal/soft
-- gate in the API routes) is the behaviour wanted.
create or replace function public.hook_require_name_and_postcode(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_full_name text;
  v_postcode text;
begin
  v_full_name := trim(coalesce(event -> 'user' -> 'user_metadata' ->> 'full_name', ''));
  v_postcode := trim(coalesce(event -> 'user' -> 'user_metadata' ->> 'postcode', ''));

  if v_full_name = '' or v_postcode = '' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'Please add your name and postcode before creating an account.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_require_name_and_postcode(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_require_name_and_postcode(jsonb) from authenticated, anon, public;
