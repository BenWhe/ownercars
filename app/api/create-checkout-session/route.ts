import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ADVERT_STATUS, nextConfirmationDueDate } from "@/lib/adverts/lifecycle";
import { LISTING_PRICE_AMOUNT_PENCE } from "@/lib/payments/config";
import {
  calculatePromoAmountPence,
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
    .select("id, seller_id")
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

  // ── Promo code validation ────────────────────────────────────────────────────
  // Validate on every checkout request regardless of what the client showed.
  // NOTE: uses is NOT incremented here. For free codes it is incremented at
  // publication (below). For paid codes it is incremented by the Stripe webhook
  // on checkout.session.completed, so that abandoning the checkout does not
  // permanently consume a use.

  let finalAmount = LISTING_PRICE_AMOUNT_PENCE;
  let promo: PromoCodeRecord | null = null;

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
    if (promo) {
      await supabase
        .from("promo_codes")
        .update({ uses: (promo.uses ?? 0) + 1 })
        .eq("id", promo.id);
    }

    const { error } = await supabase
      .from("adverts")
      .update({
        status: ADVERT_STATUS.PUBLISHED,
        paid: false,
        promo_code: promoCode || null,
        published_at: new Date().toISOString(),
        last_availability_confirmed_at: new Date().toISOString(),
        next_availability_check_at: nextConfirmationDueDate(),
      })
      .eq("id", advertId)
      .eq("seller_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "Could not publish advert" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: "/dashboard" });
  }

  // ── Paid path ─────────────────────────────────────────────────────────────────
  // Move advert to PENDING_PAYMENT before sending the user to Stripe.
  const { error: pendingPaymentError } = await supabase
    .from("adverts")
    .update({ status: ADVERT_STATUS.PENDING_PAYMENT })
    .eq("id", advertId)
    .eq("seller_id", user.id);

  if (pendingPaymentError) {
    return NextResponse.json(
      { error: "Could not prepare advert for checkout" },
      { status: 500 }
    );
  }

  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecretKey);

  try {
    assertStripeKeyMatchesExpectedMode(stripeSecretKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe mode";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email,
      payment_intent_data: user.email
        ? { receipt_email: user.email }
        : undefined,
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
        advertId,
        sellerId: user.id,
        // promoCode stored so webhook can increment uses on confirmed payment.
        promoCode,
        expectedAmount: String(finalAmount),
        priceVersion: finalAmount === LISTING_PRICE_AMOUNT_PENCE ? "launch-250" : "promo",
      },
      success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      // On cancel, reset the advert back to draft so it is not stranded in
      // PENDING_PAYMENT. The redirect route handles the DB update.
      cancel_url: `${siteUrl}/api/cancel-checkout?advertId=${advertId}&sellerId=${user.id}&next=${encodeURIComponent(`/publish-advert/${advertId}`)}`,
    });

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
