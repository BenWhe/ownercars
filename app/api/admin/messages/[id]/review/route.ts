import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { verifyReviewToken } from "@/lib/admin/reviewToken";
import { messageThreadId } from "@/lib/messages/thread";
import { notifyRecipient } from "@/lib/messages/notifyRecipient";

type Context = { params: Promise<{ id: string }> };

function createAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

// POST only — deliberately no GET handler here, so an email link scanner
// prefetching the review page (which only reads, see
// app/admin/messages/[id]/page.tsx) can never trigger a release/reject.
export async function POST(req: NextRequest, context: Context) {
  const { id } = await context.params;

  let body: { token?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { token, action } = body;
  if (!token || !verifyReviewToken(id, token)) {
    return NextResponse.json({ error: "Invalid or expired review link." }, { status: 401 });
  }

  if (action !== "release" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const admin = createAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: message } = await admin
    .from("messages")
    .select("id, advert_id, sender_id, recipient_id, delivery_status")
    .eq("id", id)
    .maybeSingle();

  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  // Idempotent: only ever acts on a held message. A second click (or a
  // retried request) on an already-reviewed message is a no-op that just
  // reports the current status.
  if (message.delivery_status !== "held") {
    return NextResponse.json({ ok: true, delivery_status: message.delivery_status });
  }

  if (action === "reject") {
    await admin
      .from("messages")
      .update({ delivery_status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("delivery_status", "held");

    return NextResponse.json({ ok: true, delivery_status: "rejected" });
  }

  const { data: released } = await admin
    .from("messages")
    .update({ delivery_status: "delivered", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("delivery_status", "held")
    .select("advert_id, sender_id, recipient_id")
    .maybeSingle();

  if (!released) {
    // Lost a race with another release/reject — report the now-current status.
    const { data: current } = await admin
      .from("messages")
      .select("delivery_status")
      .eq("id", id)
      .maybeSingle();
    return NextResponse.json({ ok: true, delivery_status: current?.delivery_status ?? "held" });
  }

  const { data: advert } = await admin
    .from("adverts")
    .select("seller_id, year, make, model")
    .eq("id", released.advert_id)
    .maybeSingle();

  const advertTitle = advert
    ? [advert.year, advert.make, advert.model].filter(Boolean).join(" ")
    : "";
  const recipientIsSeller = Boolean(advert && released.recipient_id === advert.seller_id);

  // From the recipient's side, the other party in the thread is always the sender.
  await notifyRecipient({
    recipientId: released.recipient_id,
    recipientRole: recipientIsSeller ? "seller" : "buyer",
    advertTitle,
    threadId: messageThreadId(released.advert_id, released.sender_id),
  });

  return NextResponse.json({ ok: true, delivery_status: "delivered" });
}
