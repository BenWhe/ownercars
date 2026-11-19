import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";
import { messageThreadId } from "@/lib/messages/thread";
import { screenMessage } from "@/lib/messages/screen";
import { notifyRecipient } from "@/lib/messages/notifyRecipient";
import { notifyAdminHeld } from "@/lib/messages/notifyAdminHeld";
import { requireProfileDetails } from "@/lib/profile/requireProfileDetails";
import { getRequestMeta, logSecurityEvent } from "@/lib/security/requestMeta";

function createSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return null;

  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });
}

function createAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  if (!supabase) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      advert_id,
      sender_id,
      recipient_id,
      body,
      read_at,
      created_at,
      delivery_status,
      adverts (
        id,
        year,
        make,
        model,
        price
      )
    `)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const conversations = new Map<string, any>();

  for (const msg of data || []) {
    const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
    const threadId = messageThreadId(msg.advert_id, otherUserId);
    const existing = conversations.get(threadId);

    if (!existing) {
      conversations.set(threadId, {
        id: threadId,
        advert_id: msg.advert_id,
        other_user_id: otherUserId,
        adverts: msg.adverts,
        lastMessage: msg,
        unreadCount: msg.recipient_id === user.id && !msg.read_at ? 1 : 0,
        status: "open",
      });
    } else if (msg.recipient_id === user.id && !msg.read_at) {
      existing.unreadCount += 1;
    }
  }

  return NextResponse.json({ conversations: Array.from(conversations.values()), userId: user.id });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);
  const admin = createAdmin();

  if (!supabase || !admin) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let payload: { advertId?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const advertId = payload.advertId;
  const body = payload.body?.trim();

  if (!advertId || !body) {
    return NextResponse.json({ error: "Advert and message body are required." }, { status: 400 });
  }

  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id, seller_id, status, year, make, model")
    .eq("id", advertId)
    .eq("status", ADVERT_STATUS.PUBLISHED)
    .maybeSingle();

  if (advertError) {
    return NextResponse.json({ error: advertError.message }, { status: 400 });
  }

  if (!advert) {
    return NextResponse.json({ error: "This advert isn’t available for messaging." }, { status: 404 });
  }

  if (advert.seller_id === user.id) {
    return NextResponse.json({ error: "You cannot message your own advert." }, { status: 400 });
  }

  const profileCheck = await requireProfileDetails(admin, user);
  if (!profileCheck.ok) {
    return NextResponse.json(
      { error: profileCheck.error, code: profileCheck.code },
      { status: 403 }
    );
  }

  const { hold, reasons } = await screenMessage({
    senderId: user.id,
    advertId: advert.id,
    body,
    admin,
  });

  // sender_id always comes from the authenticated user, never the request
  // body. Insert goes through the service-role client — direct authenticated
  // inserts are revoked once Part B of the migration runs.
  const { data: message, error } = await admin
    .from("messages")
    .insert({
      advert_id: advert.id,
      sender_id: user.id,
      recipient_id: advert.seller_id,
      body,
      delivery_status: hold ? "held" : "delivered",
      held_reasons: hold ? reasons : null,
    })
    .select("id, advert_id, sender_id, recipient_id, body, created_at, delivery_status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Two different thread IDs: the buyer (sender) redirects to their own
  // conversation, where the other party is the seller; the seller's
  // notification email links to the same conversation from their side,
  // where the other party is the buyer (the sender, user.id).
  const buyerThreadId = messageThreadId(advert.id, advert.seller_id);
  const sellerThreadId = messageThreadId(advert.id, user.id);
  const advertTitle = [advert.year, advert.make, advert.model].filter(Boolean).join(" ");
  const meta = getRequestMeta(request);

  if (hold) {
    await logSecurityEvent(user.id, "message_held", meta, { messageId: message.id, advertId: advert.id, reasons });
    await notifyAdminHeld({
      messageId: message.id,
      senderId: user.id,
      advertId: advert.id,
      advertTitle,
      body,
      reasons,
      meta,
    });
  } else {
    await logSecurityEvent(user.id, "message_sent", meta, { messageId: message.id, advertId: advert.id });
    await notifyRecipient({
      recipientId: advert.seller_id,
      recipientRole: "seller",
      advertTitle,
      threadId: sellerThreadId,
    });
  }

  return NextResponse.json({ message, threadId: buyerThreadId, held: hold });
}
