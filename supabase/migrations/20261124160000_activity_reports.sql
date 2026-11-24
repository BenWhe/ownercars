-- Security PR 4: IP history for every account, and seller message reports.
-- Run BEFORE merging the security-pr4 PR. Additive only.

-- 1. Where signed-in accounts use the site from. One row per account per IP
--    address, updated at most hourly (recorded when the site checks for
--    unread messages on each page). Country/region/city come from Vercel's
--    IP geolocation. Service role only.
create table if not exists public.account_ip_history (
  user_id uuid not null,
  ip text not null,
  country text,
  region text,
  city text,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seen_count integer not null default 1,
  primary key (user_id, ip)
);
create index if not exists account_ip_history_last_seen_idx on public.account_ip_history (last_seen_at desc);
create index if not exists account_ip_history_ip_idx on public.account_ip_history (ip);
alter table public.account_ip_history enable row level security;
alter table public.account_ip_history force row level security;
revoke all on public.account_ip_history from anon, authenticated;

-- 2. Sign-up and sign-in IPs as recorded by Supabase Auth itself (the
--    browser signs in directly with Supabase, so our server never sees
--    these). The auth schema isn't exposed through the API, so this
--    function reads it on the server's behalf. Callable by the service role
--    only.
create or replace function public.admin_auth_ip_history(p_user_ids uuid[] default null)
returns table (user_id uuid, ip text, user_agent text, seen_at timestamptz, source text)
language sql
security definer
set search_path = ''
stable
as $$
  select s.user_id, host(s.ip), s.user_agent, s.created_at, 'session'::text
  from auth.sessions s
  where s.ip is not null
    and (p_user_ids is null or s.user_id = any (p_user_ids))
  union all
  -- actor_id is compared as text and only cast when it looks like a uuid,
  -- so an unexpected value can never make the whole query fail.
  select case when (a.payload ->> 'actor_id') ~ '^[0-9a-f-]{36}$' then (a.payload ->> 'actor_id')::uuid end,
         a.ip_address, null::text, a.created_at, coalesce(a.payload ->> 'action', 'auth')
  from auth.audit_log_entries a
  where a.ip_address is not null and a.ip_address <> ''
    and (a.payload ->> 'actor_id') ~ '^[0-9a-f-]{36}$'
    and (p_user_ids is null or (a.payload ->> 'actor_id') = any (p_user_ids::text[]))
$$;
revoke all on function public.admin_auth_ip_history(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_auth_ip_history(uuid[]) to service_role;

-- 3. Messages reported by the person who received them.
create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message_id uuid not null,
  reporter_id uuid not null,
  reported_user_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_at timestamptz,
  resolved_by uuid,
  unique (message_id, reporter_id)
);
create index if not exists message_reports_open_idx on public.message_reports (created_at desc) where status = 'open';
alter table public.message_reports enable row level security;
alter table public.message_reports force row level security;
revoke all on public.message_reports from anon, authenticated;

-- Check: should return rows (sign-in IPs Supabase already holds). If it
-- errors, send the message: the auth tables may differ on this project.
select count(*) as auth_ip_rows from public.admin_auth_ip_history(null);
