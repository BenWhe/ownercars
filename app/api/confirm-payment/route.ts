import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ADVERT_STATUS, nextConfirmationDueDate } from "@/lib/adverts/lifecycle";
import { assertStripeKeyMatchesExpectedMode } from "@/lib/payments/stripe";

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 }
    );
  }

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
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
        // Payment confirmation only needs to read the existing browser session.
      },
    },
  });

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  try {
    assertStripeKeyMatchesExpectedMode(stripeSecretKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe mode";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { sessionId } = await req.json();

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.status === "expired") {
    return NextResponse.json(
      { error: "This checkout session expired. Please start payment again." },
      { status: 409 }
    );
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Payment was not completed. Please retry checkout from your advert." },
      { status: 402 }
    );
  }

  const expectedAmount = Number(session.metadata?.expectedAmount || NaN);

  if (!Number.isFinite(expectedAmount) || session.amount_total !== expectedAmount) {
    return NextResponse.json(
      { error: "Paid checkout amount did not match the expected listing price" },
      { status: 400 }
    );
  }

  const advertId = session.metadata?.advertId;
  const sellerId = session.metadata?.sellerId;
  const promoCode = session.metadata?.promoCode || null;

  if (!advertId) {
    return NextResponse.json({ error: "Missing advertId" }, { status: 400 });
  }

  if (sellerId && sellerId !== user.id) {
    return NextResponse.json(
      { error: "Not authorised to manage this advert." },
      { status: 403 }
    );
  }

  const { data: advert, error: advertLookupError } = await supabaseAdmin
    .from("adverts")
    .select("seller_id, payment_status, status")
    .eq("id", advertId)
    .maybeSingle();

  if (advertLookupError) {
    return NextResponse.json({ error: advertLookupError.message }, { status: 500 });
  }

  if (!advert || advert.seller_id !== user.id) {
    return NextResponse.json(
      { error: "Not authorised to manage this advert." },
      { status: 403 }
    );
  }

  const publishedAt = new Date();

  const { error } = await supabaseAdmin
    .from("adverts")
    .update({
      paid: true,
      status: ADVERT_STATUS.PUBLISHED,
      payment_status: "paid",
      payment_failure_reason: null,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      promo_code: promoCode,
      published_at: publishedAt.toISOString(),
      checkout_completed_at: publishedAt.toISOString(),
      last_availability_confirmed_at: publishedAt.toISOString(),
      next_availability_check_at: nextConfirmationDueDate(publishedAt),
    })
    .eq("id", advertId)
    .eq("seller_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
