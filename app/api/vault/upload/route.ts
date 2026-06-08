import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { VALID_DOCUMENT_TYPES, DOCUMENT_DISPLAY_NAMES, isValidDocumentType } from "@/lib/vault/documents";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  // Authenticate via cookie session
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

  const contentType = request.headers.get("content-type") || "";

  // video_link: JSON body with { advert_id, document_type, url }
  if (contentType.includes("application/json")) {
    let body: { advert_id?: string; document_type?: string; url?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { advert_id, document_type, url } = body;

    if (!advert_id || !document_type || !url) {
      return NextResponse.json({ error: "Missing advert_id, document_type, or url." }, { status: 400 });
    }

    if (document_type !== "video_link") {
      return NextResponse.json({ error: "JSON body only accepted for video_link type." }, { status: 400 });
    }

    try { new URL(url); } catch {
      return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: advert } = await supabase.from("adverts").select("id, seller_id").eq("id", advert_id).maybeSingle();

    if (!advert || advert.seller_id !== user.id) {
      return NextResponse.json({ error: "Not authorised to upload to this advert." }, { status: 403 });
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
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, document_type: "video_link" });
  }

  // File upload: multipart/form-data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const advert_id = formData.get("advert_id") as string | null;
  const document_type = formData.get("document_type") as string | null;

  if (!file || !advert_id || !document_type) {
    return NextResponse.json({ error: "Missing file, advert_id, or document_type." }, { status: 400 });
  }

  if (!isValidDocumentType(document_type) || document_type === "video_link") {
    return NextResponse.json({ error: `Invalid document_type. Must be one of: ${VALID_DOCUMENT_TYPES.filter(t => t !== 'video_link').join(', ')}.` }, { status: 400 });
  }

  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) {
    return NextResponse.json({ error: "Only PDF and image files are allowed." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File must be under 10 MB." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: advert } = await supabase.from("adverts").select("id, seller_id").eq("id", advert_id).maybeSingle();
  if (!advert || advert.seller_id !== user.id) {
    return NextResponse.json({ error: "Not authorised to upload to this advert." }, { status: 403 });
  }

  const extFromName = file.name.split(".").pop()?.toLowerCase() || "bin";
  const filePath = `${advert_id}/${document_type}/${Date.now()}.${extFromName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("vault-documents")
    .upload(filePath, new Uint8Array(arrayBuffer), { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("Vault upload error:", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from("vault-documents").getPublicUrl(filePath);

  const { error: dbError } = await supabase.from("vault_documents").upsert(
    {
      advert_id,
      seller_id: user.id,
      document_type,
      file_url: filePath, // store path, not public URL — bucket is private
      display_name: DOCUMENT_DISPLAY_NAMES[document_type],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "advert_id,document_type" }
  );

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, document_type });
}
