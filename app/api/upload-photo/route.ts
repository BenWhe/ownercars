import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// POST /api/upload-photo
// Body: FormData with fields: file (File), advertId (string), sortOrder (number)
// Auth is verified via cookie session; data operations use the service-role key
// so that RLS policies (which check auth.uid() via a join) don't interfere with
// server-side inserts. Ownership is enforced in code.
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
  }

  // Step 1: identify the caller via cookie session (read-only auth check).
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Step 2: parse the multipart upload.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const advertId = formData.get("advertId") as string | null;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!file || !advertId) {
    return NextResponse.json({ error: "Missing file or advertId" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  // Step 3: all data operations use the service-role key (bypasses RLS).
  // Ownership is verified manually in code before any write.
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: advert } = await supabase
    .from("adverts")
    .select("id, seller_id")
    .eq("id", advertId)
    .maybeSingle();

  if (!advert || advert.seller_id !== user.id) {
    return NextResponse.json(
      { error: "Not authorised to upload photos to this advert" },
      { status: 403 }
    );
  }

  // Step 4: upload the file bytes to Supabase Storage.
  const fileExt = file.name.split(".").pop() ?? "jpg";
  const filePath = `${advertId}/${Date.now()}.${fileExt}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("advert-photos")
    .upload(filePath, new Uint8Array(arrayBuffer), { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage
    .from("advert-photos")
    .getPublicUrl(filePath);

  // Step 5: insert the advert_photos record (service role bypasses the RLS
  // insert policy that joins back to adverts.seller_id = auth.uid()).
  const { data: photoRecord, error: dbError } = await supabase
    .from("advert_photos")
    .insert({
      advert_id: advertId,
      image_url: publicUrlData.publicUrl,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 400 });
  }

  return NextResponse.json({ photo: photoRecord });
}

// DELETE /api/upload-photo
// Body: JSON { photoId: string }
// Verifies ownership via the parent advert in code, then deletes the record.
export async function DELETE(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
  }

  // Step 1: identify the caller.
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let photoId: string;
  try {
    const body = await request.json();
    photoId = body.photoId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!photoId) {
    return NextResponse.json({ error: "Missing photoId" }, { status: 400 });
  }

  // Step 2: service-role client for data operations.
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch the photo to get its parent advert_id.
  const { data: photo } = await supabase
    .from("advert_photos")
    .select("id, advert_id")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  // Fetch the parent advert to verify ownership in code.
  const { data: advert } = await supabase
    .from("adverts")
    .select("id, seller_id")
    .eq("id", photo.advert_id)
    .maybeSingle();

  if (!advert || advert.seller_id !== user.id) {
    return NextResponse.json(
      { error: "Not authorised to delete this photo" },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabase
    .from("advert_photos")
    .delete()
    .eq("id", photoId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
