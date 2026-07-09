import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ADVERT_STATUS, nextConfirmationDueDate } from "@/lib/adverts/lifecycle";
import { notifyAdvertPublished } from "@/lib/admin/notifyPublished";
import { matchAndNotifyAlerts } from "@/lib/alerts/matchAndNotify";
import {
  advertDisplayTitle,
  fetchProfileFullName,
  sendAdvertPublishedWelcomeEmail,
} from "@/lib/email/welcomePublished";

// Best-effort refund of one credit. Used only on the edge case where a
// credit was spent but the advert did not actually transition to
// published (e.g. a concurrent request already published it). Logged
// loudly — this path should not normally be hit.
async function refundCredit(supabase: SupabaseClient, userId: string) {
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("publish_credits")
    .eq("id", userId)
    .maybeSingle();

  const current = profileRow?.publish_credits ?? 0;

  const { error } = await supabase
    .from("profiles")
    .update({ publish_credits: current + 1 })
    .eq("id", userId);

  if (error) {
    console.error(
      `CRITICAL: failed to refund publish credit for user ${userId} after a failed publish:`,
      error
    );
  }
}

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

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // This endpoint only needs to read the existing browser session.
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

  try {
    const body = await req.json();
    advertId = body.advertId;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!advertId) {
    return NextResponse.json({ error: "Missing advertId" }, { status: 400 });
  }

  // ── Ownership + state checks — same as the free/promo path ──────────────────
  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id, seller_id, status, paid, postcode, nearest_town")
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

  if (!advert.postcode || !advert.nearest_town) {
    return NextResponse.json(
      { error: "Please add the car's location before publishing. Edit your advert to add a postcode." },
      { status: 422 }
    );
  }

  // ── Step 1: atomically decrement the credit, gated on availability ──────────
  // NOTE: PostgREST's .update() only accepts literal values, not a SQL
  // expression like "publish_credits - 1" evaluated against the current row.
  // So this uses the same compare-and-swap pattern already used in this
  // codebase for promo_codes.uses (see consumePromoForCheckout in
  // create-checkout-session/route.ts): read the current balance, then update
  // guarded by .eq("publish_credits", currentCredits) AND .gt(0). If a
  // concurrent request already spent the credit, the row's value has
  // changed by the time this UPDATE runs, the .eq guard no longer matches,
  // zero rows come back, and this request is correctly rejected — giving the
  // same "exactly one of two concurrent requests wins" guarantee as the raw
  // `update ... set publish_credits = publish_credits - 1 where ... > 0`
  // this task originally specified.
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("publish_credits")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Could not check your credit balance." },
      { status: 500 }
    );
  }

  const currentCredits = profileRow?.publish_credits ?? 0;

  if (currentCredits <= 0) {
    return NextResponse.json({ error: "No credits available." }, { status: 400 });
  }

  const { data: decrementedRows, error: decrementError } = await supabase
    .from("profiles")
    .update({ publish_credits: currentCredits - 1 })
    .eq("id", user.id)
    .eq("publish_credits", currentCredits)
    .gt("publish_credits", 0)
    .select("publish_credits");

  if (decrementError) {
    return NextResponse.json(
      { error: "Could not spend a publish credit. Please try again." },
      { status: 500 }
    );
  }

  const decremented = (decrementedRows && decrementedRows[0]) || null;

  if (!decremented) {
    // Balance changed between the read above and this update — a concurrent
    // request already spent the last credit. Publish nothing.
    return NextResponse.json({ error: "No credits available." }, { status: 400 });
  }

  // ── Step 2: publish the advert — identical gated update to the free path ────
  const publishedAt = new Date();
  const { data: publishedRows, error: publishError } = await supabase
    .from("adverts")
    .update({
      status: ADVERT_STATUS.PUBLISHED,
      paid: false,
      payment_status: "paid",
      payment_failure_reason: null,
      stripe_checkout_session_id: null,
      stripe_payment_intent_id: null,
      promo_code: null,
      published_at: publishedAt.toISOString(),
      checkout_completed_at: publishedAt.toISOString(),
      last_availability_confirmed_at: publishedAt.toISOString(),
      next_availability_check_at: nextConfirmationDueDate(publishedAt),
    })
    .eq("id", advertId)
    .eq("seller_id", user.id)
    .neq("status", ADVERT_STATUS.PUBLISHED)
    .select("year, make, model");

  // Only true on the invocation that actually transitioned the advert.
  const publishedAdvert = (publishedRows && publishedRows[0]) || null;

  // ── Step 3: compensating refund — a spent credit must always correspond to
  // a publish. If the update errored, or matched zero rows (e.g. the advert
  // was already published by a concurrent request), give the credit back.
  if (publishError || !publishedAdvert) {
    console.error(
      `Publish-with-credit: credit spent for advert ${advertId} (user ${user.id}) but the ` +
        `publish did not occur (${publishError ? `error: ${publishError.message}` : "zero rows matched"}) — refunding credit.`
    );
    await refundCredit(supabase, user.id);

    return NextResponse.json(
      {
        error: publishError
          ? "Could not publish advert"
          : "This advert could not be published — it may already be live.",
      },
      { status: publishError ? 500 : 409 }
    );
  }

  // ── Step 4: side-effects — gated on publishedAdvert, each in its own
  // try/catch, matching the free path exactly.
  if (publishedAdvert) {
    try {
      await matchAndNotifyAlerts(supabase, advertId);
    } catch (alertErr) {
      console.error("Alert matching failed:", alertErr);
    }
  }

  // Non-blocking — must never affect the publish response
  try {
    await notifyAdvertPublished(supabase, advertId, "free (credit)");
  } catch (e) {
    console.error("Admin publish notification failed:", e);
  }

  // Customer-facing welcome email to the seller. Non-blocking, sent exactly
  // once — only when this request actually published the advert.
  if (publishedAdvert && user.email) {
    try {
      // profiles.full_name is the primary name source; metadata is the fallback.
      const profileName = await fetchProfileFullName(supabase, user.id).catch(
        () => null
      );
      const meta = user.user_metadata ?? {};
      await sendAdvertPublishedWelcomeEmail({
        to: user.email,
        fullName: profileName ?? meta.full_name ?? meta.name ?? null,
        advertId,
        advertTitle: advertDisplayTitle(publishedAdvert),
      });
    } catch (e) {
      console.error("Seller welcome email failed:", e);
    }
  }

  return NextResponse.json({ url: "/dashboard" });
}
