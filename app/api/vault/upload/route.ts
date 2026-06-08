import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { DOCUMENT_DISPLAY_NAMES, isValidDocumentType } from "@/lib/vault/documents";

export const runtime = 'nodejs';
export const maxDuration = 30;

// POST /api/vault/upload
// Two modes:
//   1. File document: JSON { advert_id, document_type, file_path }
//      Called after the browser has already PUT the file to Supabase storage
//      via the signed URL from /api/vault/presign. Records the DB entry only.
//   2. Video link:   JSON { advert_id, document_type: 'video_link', url }
//      Stores the URL directly (no storage upload needed).
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

  let body: { advert_id?: string; document_type?: string; file_path?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { advert_id, document_type, file_path, url } = body;

  if (!advert_id || !document_type) {
    return NextResponse.json({ error: "Missing advert_id or document_type." }, { status: 400 });
  }

  if (!isValidDocumentType(document_type)) {
    return NextResponse.json({ error: "Invalid document_type." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Verify ownership
  const { data: advert } = await supabase
    .from("adverts")
    .select("id, seller_id")
    .eq("id", advert_id)
    .maybeSingle();

  if (!advert || advert.seller_id !== user.id) {
    return NextResponse.json({ error: "Not authorised to upload to this advert." }, { status: 403 });
  }

  // video_link: store URL directly
  if (document_type === "video_link") {
    if (!url) {
      return NextResponse.json({ error: "Missing url for video_link." }, { status: 400 });
    }
    try { new URL(url); } catch {
      return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
    }

    const { error } = await supabase.from("vault_documents").upsert(
      {
        advert_id,
        seller_id: user.id,
        document_type: "video_link",
        file_url: url,
        display_name: DOCUMENT_DISPLAY_NAMES["video_link"],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "advert_id,document_type" }
    );

    if (error) {
      console.error("DB upsert error (video_link):", JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, document_type: "video_link" });
  }

  // File document: record the path that was already uploaded to storage
  if (!file_path) {
    return NextResponse.json({ error: "Missing file_path." }, { status: 400 });
  }

  const { error: dbError } = await supabase.from("vault_documents").upsert(
    {
      advert_id,
      seller_id: user.id,
      document_type,
      file_url: file_path,
      display_name: DOCUMENT_DISPLAY_NAMES[document_type],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "advert_id,document_type" }
  );

  if (dbError) {
    console.error("DB upsert error:", JSON.stringify(dbError));
    return NextResponse.json({ error: dbError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, document_type });
}
