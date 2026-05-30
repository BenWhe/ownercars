import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";
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

  const expectedAmount = Number(session.metadata?.expectedAmount || NaN);

  if (!Number.isFinite(expectedAmount) || session.amount_total !== expectedAmount) {
    return NextResponse.json(
      { error: "Paid checkout amount did not match the expected listing price" },
      { status: 400 }
    );
  }

  const advertId = session.metadata?.advertId;
  const sellerId = session.metadata?.sellerId;

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
    .select("seller_id, paid, payment_status, status, published_at")
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

  if (advert.status === ADVERT_STATUS.PUBLISHED) {
    return NextResponse.json({
      success: true,
      status: "published",
      advertStatus: advert.status,
      publishedAt: advert.published_at,
    });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      {
        error: "Payment was not completed. Please retry checkout from your advert.",
        status: "not_paid",
        advertStatus: advert.status,
      },
      { status: 402 }
    );
  }

  // OC-07: do not publish from the browser return path. A verified Stripe
  // webhook is the single writer that moves paid adverts to Published.
  return NextResponse.json(
    {
      success: true,
      status: "awaiting_webhook",
      advertStatus: advert.status,
      message:
        "Payment is complete in Stripe. Your advert will publish as soon as the verified Stripe webhook is processed.",
    },
    { status: 202 }
  );
}
