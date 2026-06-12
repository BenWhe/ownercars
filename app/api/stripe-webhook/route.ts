import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ADVERT_STATUS, nextConfirmationDueDate } from "@/lib/adverts/lifecycle";
import { assertStripeKeyMatchesExpectedMode } from "@/lib/payments/stripe";
import { notifyAdvertPublished } from "@/lib/admin/notifyPublished";

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cap(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function advertMatchesFilters(advert: any, filters: any): boolean {
  if (filters.make && advert.make?.toLowerCase() !== filters.make.toLowerCase()) return false;
  if (filters.model && advert.model?.toLowerCase() !== filters.model.toLowerCase()) return false;
  if (filters.bodyType && advert.body_type?.toLowerCase() !== filters.bodyType.toLowerCase()) return false;
  if (filters.fuelType && advert.fuel_type?.toLowerCase() !== filters.fuelType.toLowerCase()) return false;
  if (filters.colour && advert.colour?.toLowerCase() !== filters.colour.toLowerCase()) return false;
  if (filters.minYear != null && Number(advert.year) < Number(filters.minYear)) return false;
  if (filters.maxMileage != null && Number(advert.mileage) > Number(filters.maxMileage)) return false;
  if (filters.minPrice != null && Number(advert.price) < Number(filters.minPrice)) return false;
  if (filters.maxPrice != null && Number(advert.price) > Number(filters.maxPrice)) return false;
  return true;
}

async function matchAndNotifyAlerts(supabaseAdmin: SupabaseClient, advertId: string) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.RECONFIRMATION_EMAIL_FROM;
  if (!resendApiKey || !from) return;

  const { data: advert } = await supabaseAdmin
    .from("adverts")
    .select("id, seller_id, year, make, model, price, mileage, body_type, fuel_type, colour, nearest_town, latitude, longitude")
    .eq("id", advertId)
    .maybeSingle();

  if (!advert) return;

  // Fetch seller email to exclude them from their own alert notifications
  let sellerEmail: string | null = null;
  if (advert.seller_id) {
    try {
      const { data: { user: sellerUser } } = await supabaseAdmin.auth.admin.getUserById(advert.seller_id);
      sellerEmail = sellerUser?.email?.toLowerCase() ?? null;
    } catch {
      // Non-blocking — proceed without exclusion if lookup fails
    }
  }

  const { data: alerts } = await supabaseAdmin
    .from("search_alerts")
    .select("id, email, filters, token, latitude, longitude");

  if (!alerts || alerts.length === 0) return;

  const advertTitle = [advert.year, cap(advert.make), cap(advert.model)].filter(Boolean).join(" ");
  const advertUrl = `https://www.ownercars.co.uk/advert/${advert.id}`;
  const priceStr = advert.price ? `£${Number(advert.price).toLocaleString("en-GB")}` : "";

  const sends: Promise<void>[] = [];

  for (const alert of alerts) {
    if (sellerEmail && alert.email.toLowerCase() === sellerEmail) continue;
    if (!advertMatchesFilters(advert, alert.filters ?? {})) continue;

    const unsubscribeUrl = `https://www.ownercars.co.uk/api/alerts/unsubscribe?token=${encodeURIComponent(alert.token)}`;

    let distanceLine = "";
    if (alert.latitude && alert.longitude && advert.latitude && advert.longitude) {
      const dist = Math.round(haversineDistance(alert.latitude, alert.longitude, advert.latitude, advert.longitude));
      distanceLine = `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;">~${dist} miles from your location</p>`;
    }

    const locationLine = advert.nearest_town
      ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Near ${advert.nearest_town}</p>`
      : "";

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
              <tr>
                <td style="background:#1c2030;padding:24px 32px;">
                  <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Owner<span style="color:#2563EB;">Cars</span></span>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">A car matching your alert has been listed</p>
                  <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">A private seller just listed a car that matches your saved search.</p>
                  <div style="background:#f9fafb;border-left:4px solid #2563EB;border-radius:4px;padding:16px 20px;margin-bottom:28px;">
                    <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#111827;">${advertTitle}</p>
                    ${priceStr ? `<p style="margin:0 0 4px;font-size:14px;color:#111827;font-weight:600;">${priceStr}</p>` : ""}
                    ${locationLine}
                    ${distanceLine}
                  </div>
                  <a href="${advertUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">View advert</a>
                </td>
              </tr>
              <tr>
                <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because you set up a search alert on <a href="https://www.ownercars.co.uk" style="color:#2563EB;text-decoration:none;">OwnerCars</a>. <a href="${unsubscribeUrl}" style="color:#9ca3af;">Unsubscribe</a></p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    const text = `A car matching your alert has been listed on OwnerCars.\n\n${advertTitle}${priceStr ? ` — ${priceStr}` : ""}${advert.nearest_town ? `\nNear ${advert.nearest_town}` : ""}\n\nView it here: ${advertUrl}\n\nUnsubscribe: ${unsubscribeUrl}`;

    sends.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: alert.email,
          subject: `New match: ${advertTitle} on OwnerCars`,
          html,
          text,
        }),
      })
        .then(() => {})
        .catch((e) => console.error("Alert email send failed:", e))
    );
  }

  await Promise.all(sends);
}

async function publishPaidAdvert(
  supabaseAdmin: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  const advertId = session.metadata?.advertId;
  const expectedAmount = Number(session.metadata?.expectedAmount || NaN);

  if (!Number.isFinite(expectedAmount) || session.amount_total !== expectedAmount) {
    return "Paid checkout amount did not match the expected listing price";
  }

  if (!advertId) return null;

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
      promo_code: session.metadata?.promoCode || null,
      published_at: publishedAt.toISOString(),
      checkout_completed_at: publishedAt.toISOString(),
      last_availability_confirmed_at: publishedAt.toISOString(),
      next_availability_check_at: nextConfirmationDueDate(publishedAt),
    })
    .eq("id", advertId)
    .neq("status", ADVERT_STATUS.PUBLISHED);

  if (error) return error.message;

  // Increment promo code uses now that payment is confirmed.
  // Kept here (not at checkout session creation) so abandoned checkouts
  // don't permanently consume a use.
  const promoCode = session.metadata?.promoCode;
  if (promoCode) {
    const { data: promoData } = await supabaseAdmin
      .from("promo_codes")
      .select("id, uses")
      .eq("code", promoCode)
      .maybeSingle();

    if (promoData) {
      await supabaseAdmin
        .from("promo_codes")
        .update({ uses: promoData.uses + 1 })
        .eq("id", promoData.id);
    }
  }

  return null;
}

async function markCheckoutNotPaid(
  supabaseAdmin: SupabaseClient,
  session: Stripe.Checkout.Session,
  paymentStatus: "cancelled" | "failed" | "expired",
  reason: string
) {
  const advertId = session.metadata?.advertId;

  if (!advertId) return null;

  const { error } = await supabaseAdmin
    .from("adverts")
    .update({
      status: ADVERT_STATUS.PENDING_PAYMENT,
      paid: false,
      payment_status: paymentStatus,
      payment_failure_reason: reason,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    })
    .eq("id", advertId)
    .neq("status", ADVERT_STATUS.PUBLISHED);

  return error?.message || null;
}

async function markPaymentIntentFailed(
  supabaseAdmin: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent
) {
  const advertId = paymentIntent.metadata?.advertId;

  if (!advertId) return null;

  const reason =
    paymentIntent.last_payment_error?.message ||
    paymentIntent.last_payment_error?.decline_code ||
    "Payment failed. Please try another card or payment method.";

  const { error } = await supabaseAdmin
    .from("adverts")
    .update({
      status: ADVERT_STATUS.PENDING_PAYMENT,
      paid: false,
      payment_status: "failed",
      payment_failure_reason: reason,
      stripe_payment_intent_id: paymentIntent.id,
    })
    .eq("id", advertId)
    .neq("status", ADVERT_STATUS.PUBLISHED);

  return error?.message || null;
}

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 }
    );
  }

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
  }

  try {
    assertStripeKeyMatchesExpectedMode(stripeSecretKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe mode";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe webhook error";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  let processingError: string | null = null;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status === "paid") {
      processingError = await publishPaidAdvert(supabaseAdmin, session);
      if (!processingError && session.metadata?.advertId) {
        // Non-blocking — must never break payment processing
        try {
          await matchAndNotifyAlerts(supabaseAdmin, session.metadata.advertId);
        } catch (alertErr) {
          console.error("Alert matching failed:", alertErr);
        }
        try {
          const amountGbp =
            session.amount_total != null
              ? `£${(session.amount_total / 100).toFixed(2)}`
              : "unknown";
          await notifyAdvertPublished(supabaseAdmin, session.metadata.advertId, amountGbp);
        } catch (e) {
          console.error("Admin publish notification failed:", e);
        }
      }
    }
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    processingError = await markCheckoutNotPaid(
      supabaseAdmin,
      session,
      "failed",
      "Stripe could not complete this payment. Please try again."
    );
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    processingError = await markCheckoutNotPaid(
      supabaseAdmin,
      session,
      "expired",
      "Checkout expired before payment was completed."
    );
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    processingError = await markPaymentIntentFailed(supabaseAdmin, paymentIntent);
  }

  if (processingError) {
    return NextResponse.json({ error: processingError }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
