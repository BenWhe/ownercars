import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { LISTING_PRICE_AMOUNT_PENCE, LISTING_PRICE_GBP } from "@/lib/payments/config";

/**
 * POST /api/validate-promo
 * Body: { code: string }
 *
 * Read-only promo code check. Returns the discounted price for UI preview.
 * Does NOT increment uses — that only happens on confirmed Stripe payment.
 *
 * Requires the caller to be authenticated so anonymous users cannot brute-force
 * the code namespace.
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
  }

  // Auth check only.
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  let code: string;
  try {
    const body = await request.json();
    code = String(body.code || "").trim().toUpperCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "Enter a promo code first." }, { status: 400 });
  }

  // Service-role client for the read so RLS doesn't interfere.
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("promo_codes")
    .select("id, code, discount_type, discount_value, max_uses, uses, active")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("[validate-promo] DB error:", error.message);
    return NextResponse.json(
      { error: "Could not validate the promo code. Please try again." },
      { status: 500 }
    );
  }

  if (!data || !data.active) {
    return NextResponse.json(
      { error: "That promo code wasn't recognised." },
      { status: 400 }
    );
  }

  if (data.max_uses !== null && data.uses >= data.max_uses) {
    return NextResponse.json(
      { error: "This promo code has reached its usage limit." },
      { status: 400 }
    );
  }

  // Calculate discounted amount.
  const discountedPricePence = applyDiscount(
    LISTING_PRICE_AMOUNT_PENCE,
    data.discount_type,
    data.discount_value
  );

  const discountedPriceGbp = parseFloat((discountedPricePence / 100).toFixed(2));

  return NextResponse.json({
    applied: true,
    code: data.code,
    discountType: data.discount_type,
    discountedPricePence,
    discountedPriceGbp,
  });
}

/** Shared discount logic used by both validate-promo and create-checkout-session. */
export function applyDiscount(
  basePence: number,
  discountType: string,
  discountValue: number | null
): number {
  if (discountType === "free") {
    return 0;
  }
  if (discountType === "fixed" && discountValue != null) {
    return Math.max(0, basePence - Math.round(discountValue * 100));
  }
  if (discountType === "percentage" && discountValue != null) {
    return Math.max(0, Math.round(basePence * (1 - discountValue / 100)));
  }
  return basePence;
}
