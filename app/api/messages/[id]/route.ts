import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { messageThreadId, parseMessageThreadId } from "@/lib/messages/thread";
import { screenMessage } from "@/lib/messages/screen";
import { notifyRecipient } from "@/lib/messages/notifyRecipient";
import { notifyAdminHeld } from "@/lib/messages/notifyAdminHeld";
import { requireProfileDetails } from "@/lib/profile/requireProfileDetails";
import { getRequestMeta, logSecurityEvent } from "@/lib/security/requestMeta";

type Context = { params: Promise<{ id: string }> };

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

export async function GET(req: NextRequest, context: Context) {
  const { id } = await context.params;
  const thread = parseMessageThreadId(id);

  if (!thread) {
    return NextResponse.json({ error: "Invalid message thread." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  if (!supabase) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { advertId, otherUserId } = thread;

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .eq("advert_id", advertId)
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
    .order("created_at", { ascending: true });

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 400 });
  }

  const hasThreadAccess = (messages || []).length > 0;

  if (!hasThreadAccess) {
    return NextResponse.json({ error: "Not authorised to view this conversation." }, { status: 403 });
  }

  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id, year, make, model, price, seller_id")
    .eq("id", advertId)
    .maybeSingle();

  if (advertError) {
    return NextResponse.json({ error: advertError.message }, { status: 400 });
  }

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("advert_id", advertId)
    .eq("sender_id", otherUserId)
    .eq("recipient_id", user.id)
    .is("read_at", null);

  return NextResponse.json({
    conversation: {
      id,
      advert_id: advertId,
      other_user_id: otherUserId,
      adverts: advert,
      status: "open",
    },
    messages: messages || [],
    userId: user.id,
  });
}

export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const thread = parseMessageThreadId(id);

  if (!thread) {
    return NextResponse.json({ error: "Invalid message thread." }, { status: 400 });
  }

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

  let payload: { body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const body = payload.body?.trim();
  if (!body) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }

  const { advertId, otherUserId } = thread;

  const { data: existing, error: existingError } = await supabase
    .from("messages")
    .select("id")
    .eq("advert_id", advertId)
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
    .limit(1);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  if (!existing?.length) {
    return NextResponse.json({ error: "Not authorised to reply to this conversation." }, { status: 403 });
  }

  const profileCheck = await requireProfileDetails(admin, user);
  if (!profileCheck.ok) {
    return NextResponse.json(
      { error: profileCheck.error, code: profileCheck.code },
      { status: 403 }
    );
  }

  const { data: advert } = await admin
    .from("adverts")
    .select("seller_id, year, make, model")
    .eq("id", advertId)
    .maybeSingle();

  if (!advert) {
    return NextResponse.json({ error: "This advert is no longer available." }, { status: 404 });
  }

  const { hold, reasons } = await screenMessage({
    senderId: user.id,
    advertId,
    body,
    admin,
  });

  // sender_id always comes from the authenticated user, never the request
  // body. Insert goes through the service-role client — direct authenticated
  // inserts are revoked once Part B of the migration runs.
  const { data: message, error } = await admin
    .from("messages")
    .insert({
      advert_id: advertId,
      sender_id: user.id,
      recipient_id: otherUserId,
      body,
      delivery_status: hold ? "held" : "delivered",
      held_reasons: hold ? reasons : null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const senderIsSeller = user.id === advert.seller_id;
  const advertTitle = [advert.year, advert.make, advert.model].filter(Boolean).join(" ");
  const meta = getRequestMeta(request);

  if (hold) {
    await logSecurityEvent(user.id, "message_held", meta, { messageId: message.id, advertId, reasons });
    await notifyAdminHeld({
      messageId: message.id,
      senderId: user.id,
      advertId,
      advertTitle,
      body,
      reasons,
      meta,
    });
  } else {
    await logSecurityEvent(user.id, "message_sent", meta, { messageId: message.id, advertId });

    // From the recipient's side, the other party in the thread is always
    // the sender (user.id) — same in both directions.
    const threadId = messageThreadId(advertId, user.id);

    await notifyRecipient({
      recipientId: otherUserId,
      recipientRole: senderIsSeller ? "buyer" : "seller",
      advertTitle,
      threadId,
    });
  }

  return NextResponse.json({ message, held: hold });
}
