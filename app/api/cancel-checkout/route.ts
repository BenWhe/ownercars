import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";
import { safeNextPath } from "@/lib/auth/routes";

/**
 * GET /api/cancel-checkout?advertId=...&next=/publish-advert/...
 *
 * Resets the advert from PENDING_PAYMENT back to draft when a user abandons
 * checkout, then redirects to `next`. Requires an authenticated session —
 * ownership is verified server-side rather than trusting a query param.
 */
export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // Validate the next param before use — prevents open-redirect attacks.
  // safeNextPath returns null for external URLs and // paths.
  const rawNext = new URL(req.url).searchParams.get("next");
  const safePath = safeNextPath(rawNext) ?? "/dashboard";
  const redirectUrl = `${siteUrl}${safePath}`;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    // Env missing — still redirect rather than leaving user on a blank page.
    return NextResponse.redirect(redirectUrl);
  }

  const advertId = new URL(req.url).searchParams.get("advertId");

  // Auth: caller must be the logged-in seller. If no session, redirect without
  // resetting — a stale PENDING_PAYMENT row can be cleaned up by a scheduled job.
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (user && advertId) {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Ownership verified via DB seller_id — never trust a client-supplied
    // sellerId param.
    await supabase
      .from("adverts")
      .update({ status: ADVERT_STATUS.DRAFT })
      .eq("id", advertId)
      .eq("seller_id", user.id)
      .eq("status", ADVERT_STATUS.PENDING_PAYMENT);
    // Errors are silently swallowed — a failed reset does not block the
    // redirect. A scheduled cleanup job can catch stale PENDING_PAYMENT rows.
  }

  return NextResponse.redirect(redirectUrl);
}
