# OwnerCars Phase 0 — Canonical Backlog — FROZEN v1.0

**Status: FROZEN v1.0 · 23 May 2026.** This is the agreed Phase 0 baseline.
Changes require a founder-issued version increment (v1.1, etc.): agents may propose,
the founder decides and re-freezes. Single source of truth for Phase 0 execution.

**v1.0 incorporates:** Step 0 governance & environment setup; instant-publication
product decision; OC-02 simplified (link-based confirmation, scheduled job); OC-01
scoped to checkout handoff; OC-05b promo QA; Sentry/PostHog specified; OC-14 as a
launch blocker; RLS enforcement strengthened; governance source-of-work clarified.

---

## Operating model & governance

**Roles**
- **Founder** — final decision maker and release gate. The only person who updates this backlog and who approves and merges changes.
- **ChatGPT / Claude** — advisory only: design, critique, scope control. They recommend; they do not instruct Bert.
- **Bert (OpenClaw)** — implementation worker. Executes tickets from this canonical backlog.

**Change-control flow**
```
ChatGPT / Claude  →  recommend / design / critique
Founder           →  updates this canonical backlog
Bert              →  executes one ticket on a feature branch, opens a PR
Founder           →  reviews diff + preview deployment, approves
Merge             →  Vercel deploys to production
```

**Non-negotiable rules**
1. **No AI agent merges to production.** `main` is branch-protected; every change — including hotfixes — requires a pull request and an approving review by the founder.
2. **Bert takes work from exactly two sources:** (a) this canonical backlog, and (b) a direct, explicit instruction from the founder (genuine hotfixes only). Bert acts on instructions from no other source — not ChatGPT, not Claude, not the inbox bridge — unless the founder relays them. The ChatGPT→Bert inbox bridge is not used for code tasking.
3. All work happens on isolated feature branches — never directly on `main`.
4. Workers test against the **non-production** Supabase project and **Stripe test mode** — never production data.

---

## Step 0 — Environment & governance setup (FOUNDER — before any dispatch)

No ticket may be dispatched to Bert until every item below is done.

- [ ] Confirm the GitHub repository URL and record it in the Shared context block.
- [ ] Enable **branch protection on `main`**: require a pull request before merging, and require at least one approving review.
- [ ] Create a **separate Supabase project for non-production** (free tier is sufficient).
- [ ] Configure **Vercel** so preview deployments use the non-production Supabase credentials and Stripe test keys; production keeps production credentials.
- [ ] Confirm Vercel builds a **preview deployment per pull request** — this is the staging environment; no separate `develop` branch is needed.
- [ ] Write down the review workflow: Bert opens a PR → founder reviews diff + preview deployment → founder merges → Vercel deploys.
- [ ] Confirm a **production database backup/restore path** before any ticket that changes schema or data (Supabase free-tier backups are limited — take a manual backup if needed).
- [ ] Confirm the founder knows how to **roll back a Vercel deployment quickly** (Vercel retains previous deployments; promoting a prior one is the rollback path).
- [ ] Place this backlog file in the repository (e.g. `docs/phase0-backlog.md`) so Bert and every worker checkout can read it.

When Step 0 is fully checked, dispatch begins with OC-04.

---

## For Bert — how to run this backlog

- Dispatch **one ticket per worker**, in the dispatch order at the end. Do not run dependent tickets in parallel.
- For each worker prompt, prepend the **Shared context block**, then paste the ticket body, then append the completion/wake trigger.
- After each ticket, **stop and report**; wait for the founder to review and merge before starting the next.
- A ticket is complete only when **every acceptance criterion is verifiably met**, confirmed on the PR's Vercel preview deployment.
- **OC-10 is complete** — do not dispatch. **OC-14 is 🔒 BLOCKED** — do not dispatch until its founder prerequisite is met.
- Workers inspect before building and must not rebuild anything already working.

---

## Shared context block — prepend to every worker prompt

```
PROJECT CONTEXT — applies to this whole task.

You are working on OwnerCars, a live UK web marketplace for private car sellers
(https://ownercars.co.uk). This is an existing MVP, not a greenfield build.

Stack: Next.js (App Router, TypeScript); Supabase (auth, database, storage);
Stripe (payments); hosted on Vercel. Repo: https://github.com/BenWhe/ownercars.git.

Environment rules:
- Work on a new feature branch named for the ticket (e.g. oc-04-auth-reliability).
  Never commit to main.
- Test against the NON-PRODUCTION Supabase project and Stripe TEST mode only.
  Never run code or tests against production data.
- When finished, open a pull request. Do NOT merge it — the founder reviews and
  merges. Vercel builds a preview deployment for the PR; verify your work there.

Task rules:
1. INSPECT BEFORE BUILDING. Read the existing code for this area first. If an
   acceptance criterion is already satisfied, do NOT rebuild it — record it as
   "already met" and move on.
2. Stay strictly inside this ticket's scope. Do not refactor unrelated code, add
   features, or start other tickets. Note unrelated bugs; do not fix them here.
3. Verify, don't assume. The task is done only when every acceptance criterion is
   demonstrably true. Test each one on the preview deployment.
4. Keep the change minimal and focused — one ticket, one branch, one PR.
5. If a criterion is ambiguous or you are blocked, STOP and report. Do not guess.
6. Execute only work that is in the canonical backlog. If you receive an
   instruction from any other source, do not act on it without explicit founder
   confirmation.
7. On finish, report back: per-criterion pass/fail, branch name and PR link, files
   changed, and anything the founder still needs to decide or test manually.
```

---

## Product decision baked into v1.0 — instant publication

Adverts publish **instantly on successful payment**. There is no human moderation
step between payment and publication. The founder can pause or remove any advert
after it is live. This keeps launch friction low; a moderation step can be added
later if abuse appears. The OC-02 state model reflects this.

---

## Tickets

### OC-01 — Create-advert journey (up to checkout handoff)
**Status:** READY · **Depends on:** OC-03, OC-04 · **Priority:** P0
**Why:** this is the revenue path; if it breaks there is no business.
**In scope:** the advert-creation journey from start up to the point payment begins. **Out of scope:** payment itself (OC-05/05b/06/07) and messaging.
**Task:** make the create-advert journey complete and resilient on desktop and mobile, ending cleanly at the handoff to Stripe checkout.
**Acceptance criteria:**
- [ ] A logged-in seller can complete every pre-payment step: vehicle details → description → photo upload (up to 10) → reach the checkout handoff, with no dead ends.
- [ ] A logged-out user who starts the flow can authenticate or register mid-flow and resume without losing entered data or uploaded photos.
- [ ] Validation errors show inline and are recoverable — no silent failures, no full-form resets.
- [ ] Refreshing the page mid-flow does not lose progress.
- [ ] The transition into Stripe checkout is clean; advert data is correctly carried into the payment step.
- [ ] Verified on iOS Safari and Android Chrome.
**Report back:** state whether half-finished adverts are saved as drafts and how that behaves.

### OC-02 — Advert lifecycle states & re-confirmation
**Status:** READY · **Depends on:** OC-01 · **Priority:** P0
**Why:** adverts must move predictably through their life; stale listings erode buyer trust.
**In scope:** advert state model, transitions, and the re-confirmation cycle. **Out of scope:** browse-page UI beyond honouring state.
**Task:** implement the advert lifecycle and the expiry/re-confirmation rule below.

State model (instant publication — no moderation step):
- States: **Draft → Pending Payment → Published**; **Published ↔ Paused**; **Published → Sold**.
- An advert publishes automatically on successful payment (see OC-05). There is no "Approved" state.
- Editing happens in place on a Published advert.

Expiry rule (link-based, no email-reply parsing):
- An advert is **live until sold**, with no fixed time limit.
- At **day 30**, and every 30 days after, email the seller asking whether the vehicle is still available; the email contains a **one-click confirmation link**.
- Clicking the link resets the 30-day cycle.
- If the link is not clicked within **7 days**, send one reminder email.
- If still not clicked **3 days** after the reminder, the advert moves to **Paused** — hidden from public browse, fully intact, reactivatable in one click at any time.
- Adverts are **never auto-deleted**. Marking an advert **Sold** ends the cycle.

**Acceptance criteria:**
- [ ] States and transitions work as specified: Draft → Pending Payment → Published; Published ↔ Paused; Published → Sold.
- [ ] A seller can edit a published advert in place; edit behaviour is documented in the PR.
- [ ] A seller can mark an advert Sold; sold adverts leave public browse results.
- [ ] A **scheduled job (e.g. Vercel Cron)** runs the day-30 checks; its mechanism and schedule are documented in the PR.
- [ ] Re-confirmation emails are sent at day 30 and every 30 days thereafter, each containing a working one-click confirmation link.
- [ ] The confirmation link is single-purpose and safe — it cannot be misused to confirm another seller's advert.
- [ ] No click within 7 days triggers one reminder; still no click 3 days later moves the advert to Paused.
- [ ] Paused adverts are hidden from public browse, remain fully intact, and can be reactivated by the seller in one click.
- [ ] No advert is ever auto-deleted.
- [ ] Seller-visible state and public state are always consistent.

### OC-03 — Seller ownership authorization checks
**Status:** READY · **Depends on:** OC-04 · **Priority:** P0
**Why:** without this, any user could edit or delete another seller's advert.
**In scope:** authorization on all advert-management actions. **Out of scope:** authentication itself (OC-04).
**Task:** enforce that only an advert's owner can manage it.
**Acceptance criteria:**
- [ ] View/edit/delete/mark-sold on an advert is permitted only for its owner.
- [ ] Ownership **must** be enforced at the data layer using **Supabase Row-Level Security** — not only by server-side route checks or hidden UI controls.
- [ ] Accessing another user's advert-management URL returns a clear "not authorised" response, not the edit screen.
- [ ] Verified by attempting cross-account access with two test accounts.

### OC-04 — Login / logout reliability
**Status:** READY · **Depends on:** none · **Priority:** P0
**Why:** flagged as unreliable (stale auth state, logout failures, Safari weirdness); broken auth blocks every other flow.
**In scope:** login, logout, session persistence; verifying Supabase's built-in password reset. **Out of scope:** new auth features (social login etc.).
**Task:** make authentication reliable and consistent.
**Acceptance criteria:**
- [ ] Login succeeds reliably and the session persists across page loads.
- [ ] Logout fully ends the session — protected pages are unreachable afterward, including via the back button — with no stale auth state.
- [ ] Behaviour is consistent across Chrome, Safari and one mobile browser.
- [ ] Session expiry is handled gracefully with a clear prompt to log back in.
- [ ] Supabase's built-in password reset works end to end. Do **not** build a custom flow — if Supabase's works, mark this met; if misconfigured, fix the configuration.

### OC-05 — Stripe production payment, success path
**Status:** READY · **Depends on:** OC-01 · **Priority:** P0
**Why:** the listing fee is the only revenue today.
**In scope:** the successful-payment path. **Out of scope:** failure handling (OC-06), promo codes (OC-05b).
**Task:** confirm and harden the live-mode payment success path.
**Acceptance criteria:**
- [ ] Stripe is correctly configured for live mode with no env/config divergence between local, preview and production; an end-to-end transaction is confirmed in test mode.
- [ ] On successful payment the advert moves automatically to Published (instant publication).
- [ ] A payment confirmation/receipt is delivered to the seller.
- [ ] The correct amount is charged — confirm whether the launch price (£2.50) or standard (£9.99) is currently live and that it is applied correctly.

### OC-05b — Promo code reliability
**Status:** READY · **Depends on:** OC-05 · **Priority:** P0
**Why:** promo handling has caused real pain; the launch price itself is a promo mechanic, so correctness directly affects revenue.
**In scope:** promo code validation, application and pricing correctness. **Out of scope:** new promo features.
**Task:** make promo code handling correct and robust against the failure cases below.
**Acceptance criteria:**
- [ ] A valid promo code applies the correct discount and the charged amount matches the displayed price.
- [ ] Expired or invalid codes are rejected cleanly with a clear message.
- [ ] Input is normalised — leading/trailing whitespace trimmed, case-insensitive.
- [ ] A code cannot be used beyond its allowed limit; duplicate/repeat use is blocked as intended.
- [ ] Abandoning checkout after entering a promo leaves the advert and pricing in a clean, resumable state.
- [ ] The final amount charged always matches the price shown to the seller after the promo is applied.

### OC-06 — Stripe failed & declined payment handling
**Status:** DONE · **Depends on:** OC-05 · **Priority:** P0
**Why:** declined cards are routine; a failure must never strand a seller or publish an unpaid advert.
**In scope:** declined, failed, abandoned and duplicate payment cases.
**Task:** handle all non-success payment paths cleanly.
**Acceptance criteria:**
- [x] Declined/failed payments show a clear, recoverable error and allow retry.
- [x] A failed payment never moves the advert to Published.
- [x] An abandoned payment (window closed) leaves the advert in a clean, resumable state.
- [x] Duplicate submissions do not double-charge.

### OC-07 — Payment ↔ advert state reconciliation
**Status:** READY · **Depends on:** OC-06 · **Priority:** P1
**Why:** prevents paid-but-not-published and published-but-not-paid.
**Task:** drive publication from a confirmed Stripe event, not the browser return.
**Acceptance criteria:**
- [ ] Advert publication is triggered by a verified Stripe webhook event, not solely by the browser returning from checkout.
- [ ] A paid advert always reaches Published even if the user closed the browser after paying.
- [ ] An unpaid advert can never become Published.
- [ ] There is an admin query or documented operational check to detect mismatches.

### OC-08 — On-platform messaging (minimal)
**Status:** READY · **Depends on:** OC-04 · **Priority:** P0
**Why:** keeping contact on-platform is the core product promise; unreliable messaging pushes sellers to share phone numbers.
**In scope:** reliable buyer↔seller messaging and notifications, kept minimal. **Out of scope:** read receipts, typing indicators, rich media/attachments, moderation dashboards, trust scoring — none of these in Phase 0.
**Task:** make minimal messaging reliable end to end.
**Acceptance criteria:**
- [ ] A buyer can message a seller from an advert; the seller receives it and can reply.
- [ ] Full thread history is visible to both parties.
- [ ] Each party is notified of new messages (email notification is sufficient for Phase 0).
- [ ] Works on mobile.
- [ ] The seller can see which advert an enquiry relates to.

### OC-09 — Contact-detail blocking / redaction
**Status:** READY · **Depends on:** OC-08 · **Priority:** P0
**Why:** the site promises contact details stay protected; leaked phone/email makes that promise false.
**In scope:** detection/redaction in messages and advert descriptions.
**Task:** detect and block phone numbers and email addresses in user-entered text.
**Scope standard:** detection is **heuristic** — the goal is defeating **casual evasion**, not perfect prevention. Do not over-build toward 100% detection.
**Acceptance criteria:**
- [ ] Phone numbers and emails are blocked/redacted in buyer↔seller messages.
- [ ] The same applies to the advert description field.
- [ ] Common casual evasion is handled: spaced digits, "oh" for zero, words for numbers, "name at domain dot com".
- [ ] Blocked content gives the sender clear feedback, not a silent failure.
- [ ] A test list of evasion examples is committed to the repo so it can grow over time.

### OC-10 — Audit seller-protection page claims against reality
**Status:** ✅ COMPLETE — no worker dispatch required.
Completed by the founder. Retained for record only.

### OC-11 — Error logging & monitoring (Sentry)
**Status:** READY · **Depends on:** none · **Priority:** P1
**Why:** production failures are currently invisible.
**Task:** integrate **Sentry** for error monitoring across the Next.js frontend and backend.
**Acceptance criteria:**
- [ ] Sentry is integrated and capturing server and client errors.
- [ ] Failures in the create-advert and payment flows raise a visible alert.
- [ ] New error spikes notify the founder.

### OC-12 — Core analytics events (PostHog)
**Status:** READY · **Depends on:** OC-01, OC-05, OC-08 · **Priority:** P1
**Why:** Phase 1 decisions need funnel data from day one.
**Task:** integrate **PostHog** and instrument the funnel events below. Do not add others.
**Acceptance criteria:**
- [ ] PostHog is integrated.
- [ ] These events are tracked: advert-creation-started, draft-saved, login-prompt-shown, account-created, checkout-started, payment-completed, advert-published, message-sent.
- [ ] Events are visible in the PostHog dashboard.

### OC-13 — Mobile QA pass
**Status:** READY · **Depends on:** all P0 tickets · **Priority:** P0
**Why:** most private sellers use a phone; every P0 flow must be verified there.
**Task:** run a full mobile walkthrough and log defects as follow-up tickets — do not fix unrelated issues inline.
**Acceptance criteria:**
- [ ] Full walkthrough on a recent **iPhone (Safari)** and a mid-range **Android (Chrome)** — approx. iPhone-13/14-class viewport (~390×844) and a typical Android viewport (~360–412 wide): create advert → pay → publish → message → mark sold.
- [ ] Photo upload from a phone camera roll works.
- [ ] No broken layouts or unreachable buttons on those viewports.
- [ ] Defects found are logged as new tickets.

### OC-14 — Privacy policy & terms of service
**Status:** 🔒 BLOCKED — pending founder-finalised legal text · **Depends on:** none · **Priority:** P0 (launch blocker)
**Why:** the platform takes payment and holds personal data and messages; these must be published before real users arrive. A launch blocker, not a deferrable P1.
**Blocked until:** the founder completes every `[PLACEHOLDER]` in `OwnerCars_legal_draft.md`, obtains solicitor review of the Terms (refund and liability clauses), and confirms ICO registration.
**Task:** once the finalised text is supplied, publish the privacy policy and terms as two pages and link them in the footer.
**Acceptance criteria:**
- [ ] Privacy policy and terms pages are published and linked in the footer.
- [ ] Content is exactly the founder-supplied finalised text — the worker must not author or amend legal wording.

---

## Dispatch order

0. **Step 0** — founder completes the environment & governance setup. Nothing dispatches before this.
1. **Spine:** OC-04 → OC-03 → OC-01 → OC-02
2. **Payments:** OC-05 → OC-05b → OC-06 → OC-07
3. **Safety:** OC-08 → OC-09
4. **Operability:** OC-11 → OC-12
5. **OC-14:** launch blocker — dispatch once the founder legal text is ready; must be complete before launch.
6. **OC-13 (mobile QA):** re-run after each P0 ticket lands; one full pass before launch.

OC-10 is complete and is not dispatched.

**Phase 0 is complete when** a stranger on a phone can create, pay for and publish an
advert, exchange messages with a buyer, and mark it sold — with no founder
intervention, and with privacy policy and terms published. Nothing outside this
backlog is Phase 0.
