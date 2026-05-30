import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ADVERT_STATUS, nextConfirmationDueDate } from "@/lib/adverts/lifecycle";
import { LISTING_PRICE_AMOUNT_PENCE } from "@/lib/payments/config";
import {
  escapePostgrestLikePattern,
  normalizePromoCode,
  PromoCodeRecord,
  validatePromoRecord,
} from "@/lib/payments/promos";
import { assertStripeKeyMatchesExpectedMode } from "@/lib/payments/stripe";

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
  }

  if (!siteUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SITE_URL" },
      { status: 500 }
    );
  }

  // Validate Stripe key before doing any async work — fails fast and keeps the
  // error path away from auth/DB code.
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 }
    );
  }

  try {
    assertStripeKeyMatchesExpectedMode(stripeSecretKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe mode";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Checkout creation only needs to read the existing browser session.
      },
    },
  });

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const stripe = new Stripe(stripeSecretKey);

  let advertId: string | undefined;
  let promoCode = "";

  try {
    const body = await req.json();
    advertId = body.advertId;
    promoCode = normalizePromoCode(body.promoCode);
  } catch {
    return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
  }

  if (!advertId) {
    return NextResponse.json({ error: "Missing advertId" }, { status: 400 });
  }

  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select(
      "id, seller_id, status, paid, stripe_checkout_session_id, payment_status"
    )
    .eq("id", advertId)
    .maybeSingle();

  if (advertError) {
    return NextResponse.json(
      { error: "Could not verify advert ownership" },
      { status: 500 }
    );
  }

  if (!advert || advert.seller_id !== user.id) {
    return NextResponse.json(
      { error: "Not authorised to manage this advert." },
      { status: 403 }
    );
  }

  if (advert.paid || advert.status === ADVERT_STATUS.PUBLISHED) {
    return NextResponse.json(
      { error: "This advert is already published." },
      { status: 409 }
    );
  }

  // ── Promo code validation ────────────────────────────────────────────────────
  // Validate on every checkout request regardless of what the client showed.
  // NOTE: uses is NOT incremented here for paid codes. For free codes it is
  // incremented at publication (below). For paid codes it is incremented by the
  // Stripe webhook on checkout.session.completed, so that abandoning the checkout
  // does not permanently consume a use.

  let finalAmount = LISTING_PRICE_AMOUNT_PENCE;
  let promo: PromoCodeRecord | null = null;

  // Optimistic-locking helper used only by the free path (paid path defers
  // to the webhook so abandoned checkouts don't burn a use).
  async function consumePromoForCheckout() {
    if (!promo) return null;

    const { data: consumedPromo, error: consumePromoError } = await supabase
      .from("promo_codes")
      .update({ uses: (promo.uses ?? 0) + 1 })
      .eq("id", promo.id)
      .eq("uses", promo.uses ?? 0)
      .select("id")
      .maybeSingle();

    if (!consumePromoError && consumedPromo) return null;

    const { data: latestPromo } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("id", promo.id)
      .maybeSingle();

    const retryable = latestPromo
      ? validatePromoRecord(latestPromo as PromoCodeRecord, promoCode)
      : { ok: false, message: "That promo code wasn't recognised." };

    return NextResponse.json(
      {
        error: retryable.ok
          ? "Promo code was updated by another checkout. Please try again."
          : retryable.message,
      },
      { status: retryable.ok ? 409 : 400 }
    );
  }

  if (promoCode) {
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .ilike("code", escapePostgrestLikePattern(promoCode))
      .eq("active", true)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "We couldn't check that promo code. Please try again." },
        { status: 500 }
      );
    }

    const validation = validatePromoRecord(data as PromoCodeRecord | null, promoCode);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    promo = validation.promo;
    finalAmount = validation.finalAmountPence;
  }

  // ── Free / fully-discounted path ─────────────────────────────────────────────
  // No Stripe session needed. Increment uses immediately (no webhook will fire).
  if (finalAmount === 0) {
    const promoError = await consumePromoForCheckout();
    if (promoError) return promoError;

    const publishedAt = new Date();
    const { error } = await supabase
      .from("adverts")
      .update({
        status: ADVERT_STATUS.PUBLISHED,
        paid: false,
        payment_status: "paid",
        payment_failure_reason: null,
        stripe_checkout_session_id: null,
        stripe_payment_intent_id: null,
        promo_code: promoCode || null,
        published_at: publishedAt.toISOString(),
        checkout_completed_at: publishedAt.toISOString(),
        last_availability_confirmed_at: publishedAt.toISOString(),
        next_availability_check_at: nextConfirmationDueDate(publishedAt),
      })
      .eq("id", advertId)
      .eq("seller_id", user.id)
      .neq("status", ADVERT_STATUS.PUBLISHED);

    if (error) {
      return NextResponse.json(
        { error: "Could not publish advert" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: "/dashboard" });
  }

  // ── Paid path ─────────────────────────────────────────────────────────────────
  // Create (or reuse) a Stripe Checkout session, then mark the advert as
  // PENDING_PAYMENT. Promo uses are incremented by the webhook on confirmed
  // payment — NOT here — so abandoned checkouts don't burn a use.

  try {
    if (advert.stripe_checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        advert.stripe_checkout_session_id
      );

      if (
        existingSession.status === "open" &&
        existingSession.payment_status === "unpaid" &&
        existingSession.amount_total === finalAmount &&
        existingSession.url
      ) {
        return NextResponse.json({ url: existingSession.url });
      }
    }

    const paymentMetadata = {
      advertId,
      sellerId: user.id,
      promoCode,
      expectedAmount: String(finalAmount),
    };

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: user.email,
        payment_intent_data: {
          receipt_email: user.email || undefined,
          metadata: paymentMetadata,
        },
        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: {
                name: "OwnerCars advert",
                description: "Advertise until sold",
              },
              unit_amount: finalAmount,
            },
            quantity: 1,
          },
        ],
        metadata: {
          ...paymentMetadata,
          priceVersion:
            finalAmount === LISTING_PRICE_AMOUNT_PENCE ? "launch-250" : "promo",
          promoId: promo?.id || "",
        },
        success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/payment-cancelled?advert_id=${encodeURIComponent(
          advertId
        )}`,
      },
      {
        idempotencyKey: `advert:${advertId}:amount:${finalAmount}:promo:${
          promoCode || "none"
        }`,
      }
    );

    const { error: pendingPaymentError } = await supabase
      .from("adverts")
      .update({
        status: ADVERT_STATUS.PENDING_PAYMENT,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        payment_status: "pending",
        payment_failure_reason: null,
        checkout_started_at: new Date().toISOString(),
      })
      .eq("id", advertId)
      .eq("seller_id", user.id)
      .neq("status", ADVERT_STATUS.PUBLISHED);

    if (pendingPaymentError) {
      return NextResponse.json(
        { error: "Could not prepare advert for checkout" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not create Stripe checkout session";

    return NextResponse.json(
      { error: `Could not start Stripe checkout: ${message}` },
      { status: 500 }
    );
  }
}
