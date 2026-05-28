# OC-05 — Stripe success path

## Runtime configuration

Use the same environment variable names locally, in Vercel preview, and in Vercel production:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_MODE` — set to `test` for local/preview test transactions and `live` for production. The app refuses to create or confirm checkout sessions if this does not match the `sk_test_` / `sk_live_` key prefix.
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

For OC-05 verification, use the non-production Supabase project and Stripe test mode. Do not use production data for test transactions.

## Current listing price

The live listing price configured in code is the launch price: **£2.50** (`250` pence, GBP).

The standard post-launch price remains documented in UI copy as **£9.99**, but checkout currently charges the launch price unless a separate valid promo reduces it further.

## Success path

1. Seller starts checkout from `/publish-advert/:id`.
2. `/api/create-checkout-session` creates a Stripe Checkout Session with:
   - `unit_amount` set from the shared listing price constant,
   - `customer_email` and PaymentIntent `receipt_email` set from the logged-in seller email,
   - metadata containing `advertId`, `sellerId`, `expectedAmount`, and `priceVersion`.
3. Stripe sends a receipt/confirmation email to the seller email when payment succeeds and Stripe receipt emails are enabled for the account.
4. On return to `/payment-success`, the browser calls `/api/confirm-payment` so the advert is published immediately after Stripe reports `paid`.
5. The Stripe webhook `/api/stripe-webhook` also publishes the advert from `checkout.session.completed`, so successful payments still publish if the seller closes the browser after payment.
6. Both confirmation paths verify the paid Stripe `amount_total` matches the expected amount metadata before publishing.
