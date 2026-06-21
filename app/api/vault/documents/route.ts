import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// GET /api/vault/documents?advert_id=...
// Returns the list of document types that have been uploaded for this advert.
// Used by both seller (edit page) and buyer (message thread) — does not return URLs.
export async function GET(request: NextRequest) {
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

  const advert_id = request.nextUrl.searchParams.get("advert_id");
  if (!advert_id) {
    return NextResponse.json({ error: "Missing advert_id." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch advert to determine seller and enforce access control.
  const { data: advert } = await supabase
    .from("adverts")
    .select("seller_id")
    .eq("id", advert_id)
    .maybeSingle();

  if (!advert) {
    return NextResponse.json({ documents: [] });
  }

  // Caller must be the seller OR a buyer who has an existing message thread
  // with the seller for this advert. Return empty (not 403) so unrelated users
  // learn nothing about what documents exist.
  if (user.id !== advert.seller_id) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("advert_id", advert_id)
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${advert.seller_id}),` +
        `and(sender_id.eq.${advert.seller_id},recipient_id.eq.${user.id})`
      );

    if (!count || count === 0) {
      return NextResponse.json({ documents: [] });
    }
  }

  const { data, error } = await supabase
    .from("vault_documents")
    .select("document_type, display_name, updated_at")
    .eq("advert_id", advert_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ documents: data || [] });
}
