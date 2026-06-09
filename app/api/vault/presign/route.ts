import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isValidDocumentType } from "@/lib/vault/documents";

export const runtime = 'nodejs';
export const maxDuration = 30;

// POST /api/vault/presign
// Verifies ownership, then returns a Supabase signed upload URL so the
// browser can PUT the file directly to storage, bypassing Vercel's payload limit.
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

  let body: { advert_id?: string; document_type?: string; filename?: string; content_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { advert_id, document_type, filename, content_type } = body;

  if (!advert_id || !document_type || !filename || !content_type) {
    return NextResponse.json({ error: "Missing advert_id, document_type, filename, or content_type." }, { status: 400 });
  }

  if (!isValidDocumentType(document_type) || document_type === "video_link") {
    return NextResponse.json({ error: "Invalid document_type." }, { status: 400 });
  }

  const isPdf = content_type === "application/pdf";
  const isImage = content_type.startsWith("image/");
  if (!isPdf && !isImage) {
    return NextResponse.json({ error: "Only PDF and image files are allowed." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: advert } = await supabase
    .from("adverts")
    .select("id, seller_id")
    .eq("id", advert_id)
    .maybeSingle();

  if (!advert || advert.seller_id !== user.id) {
    return NextResponse.json({ error: "Not authorised to upload to this advert." }, { status: 403 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "bin";
  const filePath = `${advert_id}/${document_type}/${Date.now()}.${ext}`;

  const { data: signed, error: signError } = await supabase.storage
    .from("vault-documents")
    .createSignedUploadUrl(filePath);

  if (signError || !signed?.signedUrl) {
    console.error("Presign error:", JSON.stringify(signError));
    return NextResponse.json({ error: signError?.message ?? "Could not create upload URL." }, { status: 500 });
  }

  return NextResponse.json({ signed_url: signed.signedUrl, file_path: filePath });
}
