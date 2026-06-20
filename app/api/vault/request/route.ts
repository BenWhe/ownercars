import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isValidDocumentType, DOCUMENT_DISPLAY_NAMES } from "@/lib/vault/documents";
import { parseMessageThreadId } from "@/lib/messages/thread";

// POST /api/vault/request
// Buyer requests a document from the seller via the message thread.
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: { advert_id?: string; document_type?: string; thread_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { advert_id, document_type, thread_id } = body;

  if (!advert_id || !document_type || !thread_id) {
    return NextResponse.json({ error: "Missing advert_id, document_type, or thread_id." }, { status: 400 });
  }

  if (!isValidDocumentType(document_type)) {
    return NextResponse.json({ error: "Invalid document_type." }, { status: 400 });
  }

  const thread = parseMessageThreadId(thread_id);
  if (!thread || thread.advertId !== advert_id) {
    return NextResponse.json({ error: "Invalid thread_id." }, { status: 400 });
  }

  const sellerId = thread.otherUserId;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Verify user is not the seller
  const { data: advert } = await supabase
    .from("adverts")
    .select("id, seller_id")
    .eq("id", advert_id)
    .maybeSingle();

  if (!advert) {
    return NextResponse.json({ error: "Advert not found." }, { status: 404 });
  }

  if (advert.seller_id === user.id) {
    return NextResponse.json({ error: "Sellers cannot request their own documents." }, { status: 403 });
  }

  // Require an existing message thread — buyer must have messaged the seller
  // first. Guards against thread injection by unrelated authenticated users.
  const { count: threadCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("advert_id", advert_id)
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${advert.seller_id}),` +
      `and(sender_id.eq.${advert.seller_id},recipient_id.eq.${user.id})`
    );

  if (!threadCount || threadCount === 0) {
    return NextResponse.json(
      { error: "Please message the seller before requesting documents." },
      { status: 403 }
    );
  }

  const displayName = DOCUMENT_DISPLAY_NAMES[document_type];
  const buyerLabel = user.email?.split("@")[0] ?? "A buyer";

  const { error } = await supabase.from("messages").insert({
    advert_id,
    sender_id: user.id,
    recipient_id: sellerId,
    event_type: "document_request",
    document_type,
    body: `${buyerLabel} has requested access to your ${displayName}.`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
