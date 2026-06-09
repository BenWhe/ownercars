import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isValidDocumentType } from "@/lib/vault/documents";

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

  let body: { advert_id?: string; document_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { advert_id, document_type } = body;

  if (!advert_id || !document_type) {
    return NextResponse.json({ error: "Missing advert_id or document_type." }, { status: 400 });
  }

  if (!isValidDocumentType(document_type)) {
    return NextResponse.json({ error: "Invalid document_type." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: doc } = await supabase
    .from("vault_documents")
    .select("id, seller_id, file_url, document_type")
    .eq("advert_id", advert_id)
    .eq("document_type", document_type)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (doc.seller_id !== user.id) {
    return NextResponse.json({ error: "Not authorised to delete this document." }, { status: 403 });
  }

  // Delete from storage (only for file documents, not video_link)
  if (document_type !== "video_link") {
    await supabase.storage.from("vault-documents").remove([doc.file_url]);
  }

  const { error: dbError } = await supabase
    .from("vault_documents")
    .delete()
    .eq("id", doc.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
