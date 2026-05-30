import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";

/**
 * GET /api/cancel-checkout?advertId=...&sellerId=...&next=/publish-advert/...
 *
 * Stripe's cancel_url lands here when a user abandons the hosted checkout.
 * Resets the advert from PENDING_PAYMENT back to draft so it is not stranded,
 * then redirects to `next` (default: /dashboard).
 *
 * Uses sellerId from the query string (set by create-checkout-session, which
 * already verified ownership before creating the Stripe session) rather than
 * re-reading cookies, because the cancel redirect may arrive in a new tab or
 * after the session cookie has been refreshed.
 */
export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  const { searchParams } = new URL(req.url);
  const advertId = searchParams.get("advertId");
  const sellerId = searchParams.get("sellerId");
  const next = searchParams.get("next") || "/dashboard";

  const redirectUrl = siteUrl ? `${siteUrl}${next}` : next;

  if (!supabaseUrl || !serviceRoleKey) {
    // Env missing — still redirect the user rather than leaving them on a
    // blank page; the advert may stay in PENDING_PAYMENT until a subsequent
    // webhook or manual cleanup.
    return NextResponse.redirect(redirectUrl);
  }

  if (advertId && sellerId) {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    await supabase
      .from("adverts")
      .update({ status: ADVERT_STATUS.DRAFT })
      .eq("id", advertId)
      .eq("seller_id", sellerId)
      .eq("status", ADVERT_STATUS.PENDING_PAYMENT);
    // Errors are silently swallowed — a failed reset does not block the
    // redirect. A scheduled cleanup job can catch stale PENDING_PAYMENT rows.
  }

  return NextResponse.redirect(redirectUrl);
}
