import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";
import { redactContactDetails } from "@/lib/content/redaction";
import { messageThreadId } from "@/lib/messages/thread";

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
      contact_details_redacted,
      read_at,
      created_at,
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

  if (!supabase) {
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
    .select("id, seller_id, status")
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

  const redactedBody = redactContactDetails(body);

  if (!redactedBody.text) {
    return NextResponse.json(
      { error: "Please include a message without phone numbers or email addresses." },
      { status: 400 }
    );
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      advert_id: advert.id,
      sender_id: user.id,
      recipient_id: advert.seller_id,
      body: redactedBody.text,
      contact_details_redacted: redactedBody.redacted,
    })
    .select("id, advert_id, sender_id, recipient_id, body, contact_details_redacted, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ message, threadId: messageThreadId(advert.id, advert.seller_id) });
}
