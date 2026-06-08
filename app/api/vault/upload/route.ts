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
//      Ownership was already verified by /api/vault/presign.
//   2. Video link:   JSON { advert_id, document_type: 'video_link', url }
//      Stores the URL directly (no storage upload needed).
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
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

  // Sanity check: file_path must belong to this advert
  if (file_path && !file_path.startsWith(`${advert_id}/`)) {
    return NextResponse.json({ error: "Invalid file_path." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // video_link: store URL directly
  if (document_type === "video_link") {
    if (!url) {
      return NextResponse.json({ error: "Missing url for video_link." }, { status: 400 });
    }
    try { new URL(url); } catch {
      return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
    }

    const { data: advert } = await supabase
      .from("adverts")
      .select("seller_id")
      .eq("id", advert_id)
      .maybeSingle();

    const { error } = await supabase.from("vault_documents").upsert(
      {
        advert_id,
        seller_id: advert?.seller_id,
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

  // Fetch seller_id from adverts so the vault_documents row is correctly attributed
  const { data: advert } = await supabase
    .from("adverts")
    .select("seller_id")
    .eq("id", advert_id)
    .maybeSingle();

  const { error: dbError } = await supabase.from("vault_documents").upsert(
    {
      advert_id,
      seller_id: advert?.seller_id,
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
