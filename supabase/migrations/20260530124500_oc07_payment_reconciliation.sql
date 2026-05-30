-- OC-07: make the Stripe webhook the source of truth for paid publication
-- and provide an operational reconciliation view for payment/ad state drift.

-- Backfill existing published adverts so the invariant can be enforced without
-- breaking listings created by earlier Phase 0 payment work.
update public.adverts
set payment_status = 'paid',
    checkout_completed_at = coalesce(checkout_completed_at, published_at)
where status = 'published'
  and payment_status is distinct from 'paid';

alter table public.adverts
  drop constraint if exists adverts_published_requires_paid_payment_status;

alter table public.adverts
  add constraint adverts_published_requires_paid_payment_status
  check (status <> 'published' or payment_status = 'paid');

create index if not exists adverts_payment_reconciliation_idx
on public.adverts (status, paid, payment_status, stripe_checkout_session_id);

create or replace view public.admin_payment_reconciliation as
select
  id,
  seller_id,
  status,
  paid,
  payment_status,
  payment_failure_reason,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  checkout_started_at,
  checkout_completed_at,
  published_at,
  updated_at,
  case
    when status = 'published' and payment_status is distinct from 'paid'
      then 'published_without_confirmed_payment'
    when payment_status = 'paid' and status <> 'published'
      then 'paid_not_published'
    when status = 'pending_payment'
      and payment_status = 'pending'
      and checkout_started_at < now() - interval '2 hours'
      then 'stale_pending_checkout'
    when status = 'pending_payment'
      and payment_status in ('failed', 'expired', 'cancelled')
      then 'recoverable_unpaid_checkout'
    else 'ok'
  end as reconciliation_status
from public.adverts
where
  status = 'published'
  or payment_status is not null
  or stripe_checkout_session_id is not null;
