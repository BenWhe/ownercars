-- Fix Security Advisor warning: recreate admin_payment_reconciliation with
-- security_invoker = true so the view respects the querying user's RLS instead
-- of running with the creator's privileges (SECURITY DEFINER default).
-- SELECT definition is unchanged from 20260530124500_oc07_payment_reconciliation.sql.

create or replace view public.admin_payment_reconciliation
with (security_invoker = true) as
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
