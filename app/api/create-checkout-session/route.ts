import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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
    promoCode = String(body.promoCode || "").trim().toUpperCase();
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

  let finalAmount = 999;

  if (promoCode) {
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", promoCode)
      .eq("active", true)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Invalid promo code" }, { status: 400 });
    }

    if (data.max_uses && data.uses >= data.max_uses) {
      return NextResponse.json({ error: "Promo code expired" }, { status: 400 });
    }

    if (data.discount_type === "free") {
      finalAmount = 0;
    }

    if (data.discount_type === "fixed" && data.discount_value) {
      finalAmount = Math.max(0, finalAmount - Math.round(data.discount_value * 100));
    }

    await supabase
      .from("promo_codes")
      .update({ uses: data.uses + 1 })
      .eq("id", data.id);
  }

  if (finalAmount === 0) {
    const { error } = await supabase
      .from("adverts")
      .update({
        status: "live",
        paid: false,
        promo_code: promoCode || null,
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

  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecretKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
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
        promoCode,
      },
      success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/dashboard`,
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
