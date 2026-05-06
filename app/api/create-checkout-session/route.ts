import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ⚠️ Use SERVICE ROLE KEY (server-side only)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { advertId, promoCode } = await req.json();

  if (!advertId) {
    return NextResponse.json({ error: "Missing advertId" }, { status: 400 });
  }

  let finalAmount = 999; // always start from £9.99

  // =========================
  // PROMO CODE VALIDATION
  // =========================
  if (promoCode) {
    const code = promoCode.toUpperCase();

    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: "Invalid promo code" },
        { status: 400 }
      );
    }

    // Check usage limit
    if (data.max_uses && data.uses >= data.max_uses) {
      return NextResponse.json(
        { error: "Promo code expired" },
        { status: 400 }
      );
    }

    // Apply discount
    if (data.discount_type === "free") {
      finalAmount = 0;
    }

    if (data.discount_type === "fixed" && data.discount_value) {
      finalAmount = Math.max(0, finalAmount - Math.round(data.discount_value * 100));
    }

    // ✅ Track usage immediately (simple version for launch)
    await supabase
      .from("promo_codes")
      .update({ uses: data.uses + 1 })
      .eq("id", data.id);
  }

  // =========================
  // FREE FLOW (no Stripe)
  // =========================
  if (finalAmount === 0) {
    const { error } = await supabase
      .from("adverts")
      .update({
        status: "live",
        paid: false,
        promo_code: promoCode || null,
      })
      .eq("id", advertId);

    if (error) {
      return NextResponse.json(
        { error: "Could not publish advert" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: "/dashboard" });
  }

  // =========================
  // STRIPE PAYMENT
  // =========================
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
      promoCode: promoCode || "",
    },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}