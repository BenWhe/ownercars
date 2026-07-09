import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ADVERT_STATUS, nextConfirmationDueDate } from "@/lib/adverts/lifecycle";
import { assertStripeKeyMatchesExpectedMode } from "@/lib/payments/stripe";
import { notifyAdvertPublished } from "@/lib/admin/notifyPublished";
import {
  advertDisplayTitle,
  fetchSellerContact,
  sendAdvertPublishedWelcomeEmail,
} from "@/lib/email/welcomePublished";
import { matchAndNotifyAlerts } from "@/lib/alerts/matchAndNotify";

type PublishedAdvert = {
  seller_id: string | null;
  year: number | string | null;
  make: string | null;
  model: string | null;
};

type PublishResult = {
  error: string | null;
  // The advert row IFF this invocation actually transitioned it to published.
  // Null on a no-op (e.g. webhook retry where the advert is already live), which
  // is the signal used to fire publish side-effects exactly once.
  published: PublishedAdvert | null;
};

async function publishPaidAdvert(
  supabaseAdmin: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<PublishResult> {
  const advertId = session.metadata?.advertId;
  const expectedAmount = Number(session.metadata?.expectedAmount || NaN);

  if (!Number.isFinite(expectedAmount) || session.amount_total !== expectedAmount) {
    return {
      error: "Paid checkout amount did not match the expected listing price",
      published: null,
    };
  }

  if (!advertId) return { error: null, published: null };

  const publishedAt = new Date();
  const { data: updatedRows, error } = await supabaseAdmin
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
    .neq("status", ADVERT_STATUS.PUBLISHED)
    .select("seller_id, year, make, model");

  if (error) return { error: error.message, published: null };

  // Exactly one row transitions on first publish; a retry matches 0 rows.
  const published = (updatedRows && updatedRows[0]) || null;

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

  return { error: null, published };
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
      const publishResult = await publishPaidAdvert(supabaseAdmin, session);
      processingError = publishResult.error;

      // Side-effects fire only when THIS invocation actually published the
      // advert. publishResult.published is null on webhook retries (the advert
      // is already live), so nothing here double-fires.
      if (!processingError && publishResult.published && session.metadata?.advertId) {
        const advertId = session.metadata.advertId;
        const publishedAdvert = publishResult.published;

        // Non-blocking — must never break payment processing
        try {
          await matchAndNotifyAlerts(supabaseAdmin, advertId);
        } catch (alertErr) {
          console.error("Alert matching failed:", alertErr);
        }
        try {
          const amountGbp =
            session.amount_total != null
              ? `£${(session.amount_total / 100).toFixed(2)}`
              : "unknown";
          await notifyAdvertPublished(supabaseAdmin, advertId, amountGbp);
        } catch (e) {
          console.error("Admin publish notification failed:", e);
        }
        // Customer-facing welcome email to the seller. Non-blocking.
        try {
          if (publishedAdvert.seller_id) {
            const contact = await fetchSellerContact(supabaseAdmin, publishedAdvert.seller_id);
            if (contact) {
              await sendAdvertPublishedWelcomeEmail({
                to: contact.email,
                fullName: contact.fullName,
                advertId,
                advertTitle: advertDisplayTitle(publishedAdvert),
              });
            }
          }
        } catch (e) {
          console.error("Seller welcome email failed:", e);
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
