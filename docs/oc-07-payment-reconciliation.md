# OC-07 — Payment ↔ advert state reconciliation

OwnerCars publishes paid Stripe adverts from the verified Stripe webhook only.
The browser return page (`/payment-success`) is only a status/checking UX: it can
show that Stripe says a checkout is paid, but it does not move an advert to
`published`.

## Source of truth

- Stripe sends `checkout.session.completed` to `/api/stripe-webhook`.
- The webhook verifies the Stripe signature with `STRIPE_WEBHOOK_SECRET` before
  touching Supabase.
- Only a paid Checkout Session with a matching `expectedAmount` can set:
  - `status = 'published'`
  - `payment_status = 'paid'`
  - `paid = true`
  - `published_at` / availability confirmation fields
- Failed, expired and cancelled sessions stay `pending_payment` and are safe to
  retry.

## Browser return behaviour

`/api/confirm-payment` retrieves the Checkout Session and returns one of:

- `published` — the webhook has already reconciled the advert.
- `awaiting_webhook` — Stripe reports payment complete, but the verified webhook
  has not processed yet.
- `not_paid` — payment did not complete and the seller should retry.

It deliberately does **not** publish adverts.

## Operational check

Use the reconciliation view after deploy, after Stripe incidents, or during
support investigations:

```sql
select *
from public.admin_payment_reconciliation
where reconciliation_status <> 'ok'
order by updated_at desc nulls last;
```

Important statuses:

- `paid_not_published` — Stripe/payment state says paid, but the advert is not
  live. Check webhook delivery, then replay the Stripe event if needed.
- `published_without_confirmed_payment` — should be blocked by the database
  constraint; if seen in legacy data, investigate immediately.
- `stale_pending_checkout` — seller started checkout but no terminal Stripe
  event was processed within 2 hours.
- `recoverable_unpaid_checkout` — expected failed/expired/cancelled state; seller
  can retry from the dashboard.

## Stripe-side fallback

If the database view shows `paid_not_published`, verify the Stripe event in the
Stripe dashboard:

1. Find the Checkout Session by `stripe_checkout_session_id`.
2. Confirm `payment_status = paid` and the amount matches `expectedAmount` in
   metadata.
3. Replay the `checkout.session.completed` webhook to the production endpoint.
4. Re-run the reconciliation query.
