import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";
import { messageThreadId } from "@/lib/messages/thread";
import { geocodePostcode } from "@/lib/geocode/lookup";
import { createAdminClient, sendMessage } from "@/lib/messages/send";
import { notifyRecipientOfMessage } from "@/lib/messages/notifyRecipient";
import { notifyAdminOfHeldMessage } from "@/lib/messages/review";
import { getRequestContext } from "@/lib/security/requestContext";

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

  // Gate: buyer must have a postcode set before messaging
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("postcode")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.postcode) {
      // Self-heal: postcode may have been stored in user_metadata at signup but not yet
      // written to the profiles table (happens when email confirmation is enabled and
      // the session-based save path in create-account was never reached).
      let healed = false;
      try {
        const metaPostcode: string | null = user.user_metadata?.postcode ?? null;
        if (metaPostcode) {
          const geo = await geocodePostcode(metaPostcode);
          if (geo) {
            await admin.from("profiles").upsert(
              {
                id: user.id,
                postcode: geo.postcode,
                latitude: geo.latitude,
                longitude: geo.longitude,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );
            healed = true;
          }
        }
      } catch (healErr) {
        console.error("Postcode self-heal failed:", healErr);
        // falls through to POSTCODE_REQUIRED below
      }

      if (!healed) {
        return NextResponse.json(
          { error: "Please add your postcode to your account before messaging sellers.", code: "POSTCODE_REQUIRED" },
          { status: 403 }
        );
      }
    }
  }

  // Single send path: contact-detail filter, permission check, and insert
  // (with sender IP/location/device) using the service role.
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const sent = await sendMessage(admin, {
    advertId: advert.id,
    senderId: user.id,
    recipientId: advert.seller_id,
    body,
    context: getRequestContext(request),
  });

  if (!sent.ok) {
    return NextResponse.json({ error: sent.error, code: sent.code }, { status: sent.status });
  }

  const message = sent.message;

  if (message.status === "delivered") {
    // Tell the seller now. Held messages notify the seller only once approved.
    await notifyRecipientOfMessage({
      advertId: advert.id,
      advertTitle: [advert.year, advert.make, advert.model].filter(Boolean).join(" "),
      senderId: user.id,
      recipientId: advert.seller_id,
      body,
    });
  } else if (message.status === "pending") {
    await notifyAdminOfHeldMessage(admin, String(message.id));
  }

  return NextResponse.json({ message, threadId: messageThreadId(advert.id, advert.seller_id) });
}
