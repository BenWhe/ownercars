import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  escapePostgrestLikePattern,
  normalizePromoCode,
  PromoCodeRecord,
  validatePromoRecord,
} from "@/lib/payments/promos";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
  }

  // Auth required — this is the live route called by /publish-advert/[id],
  // an authenticated page. Prevents anonymous brute-forcing of the promo
  // code namespace (M-1).
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

  let normalizedCode = "";

  try {
    const body = await req.json();
    normalizedCode = normalizePromoCode(body.promoCode);
  } catch {
    return NextResponse.json({ error: "Invalid promo code request" }, { status: 400 });
  }

  if (!normalizedCode) {
    return NextResponse.json({ error: "Enter a promo code first." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .ilike("code", escapePostgrestLikePattern(normalizedCode))
    .eq("active", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "We couldn't check that promo code. Please try again." },
      { status: 500 }
    );
  }

  const validation = validatePromoRecord(data as PromoCodeRecord | null, normalizedCode);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  return NextResponse.json({
    code: validation.normalizedCode,
    finalAmountPence: validation.finalAmountPence,
    finalAmountGbp: validation.finalAmountPence / 100,
    message: "Promo applied. Final validation happens securely when you publish.",
  });
}
