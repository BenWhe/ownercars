-- OC-06: Track Stripe checkout/payment state so failed, cancelled and
-- duplicate payment attempts stay recoverable and never publish unpaid adverts.

alter table public.adverts
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists payment_status text,
  add column if not exists payment_failure_reason text,
  add column if not exists checkout_started_at timestamptz,
  add column if not exists checkout_completed_at timestamptz;

alter table public.adverts
  drop constraint if exists adverts_payment_status_check;

alter table public.adverts
  add constraint adverts_payment_status_check
  check (
    payment_status is null
    or payment_status in ('pending', 'paid', 'cancelled', 'failed', 'expired')
  );

create unique index if not exists adverts_stripe_checkout_session_id_key
on public.adverts (stripe_checkout_session_id)
where stripe_checkout_session_id is not null;

create index if not exists adverts_pending_payment_status_idx
on public.adverts (status, payment_status)
where status = 'pending_payment';
