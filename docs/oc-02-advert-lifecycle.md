# OC-02 — Advert lifecycle states & reconfirmation

## State model

OwnerCars adverts now use these states:

- `draft` — created by the seller before payment/publishing.
- `pending_payment` — checkout has started, but payment has not yet been confirmed.
- `published` — public browse/detail pages may show the advert.
- `paused` — hidden from public pages, intact, and reactivatable by the seller.
- `sold` — hidden from public pages and removed from the reconfirmation cycle.

Transitions:

- `draft → pending_payment` when Stripe checkout starts.
- `pending_payment → published` when Stripe confirms payment, or immediately for a valid free promo.
- `published ↔ paused` from the seller dashboard or the reconfirmation cycle.
- `published/paused/draft/pending_payment → sold` from the seller dashboard.

Published adverts are edited in place at `/edit-advert/:id`; there is no moderation/approval step.

## Public visibility

Public listing queries and RLS policies only expose `status = 'published'` adverts/photos.
`paused`, `sold`, `draft`, and `pending_payment` adverts remain visible to their seller in the dashboard.

## Reconfirmation schedule

`vercel.json` registers a daily Vercel Cron job:

```json
{
  "path": "/api/cron/adverts/reconfirmation",
  "schedule": "0 8 * * *"
}
```

The cron route runs these checks:

1. If a published advert reaches `next_availability_check_at`, send the seller a one-click confirmation email and set a single-use `availability_confirmation_token`.
2. If the link has not been clicked after 7 days, send one reminder email.
3. If the reminder is still ignored after 3 more days, move the advert to `paused`.
4. Clicking the confirmation link clears the token and resets `next_availability_check_at` 30 days ahead.

## Required environment

Reconfirmation email sending uses Resend via `fetch` so no extra npm package is required.

Required production/preview env vars:

- `RESEND_API_KEY`
- `RECONFIRMATION_EMAIL_FROM` — e.g. `OwnerCars <noreply@ownercars.co.uk>`
- `CRON_SECRET` — optional locally, recommended in production. If set, call the cron route with `Authorization: Bearer <CRON_SECRET>`.

Existing required vars remain:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Safety

Confirmation links are single-purpose because the random token is stored on exactly one advert and cleared after use. The route only confirms adverts currently in `published` or `paused`; it cannot publish drafts, unpaid pending-payment adverts, sold adverts, or another seller's advert.
