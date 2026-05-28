import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// POST /api/upload-photo
// Body: FormData with fields: file (File), advertId (string), sortOrder (number)
// Uploads the file to Supabase Storage, inserts an advert_photos record, returns { photo }.
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

  // Verify the authenticated user owns this advert before accepting the upload.
  const { data: advert } = await supabase
    .from("adverts")
    .select("id")
    .eq("id", advertId)
    .eq("seller_id", user.id)
    .maybeSingle();

  if (!advert) {
    return NextResponse.json(
      { error: "Not authorised to upload photos to this advert" },
      { status: 403 }
    );
  }

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
// Verifies the caller owns the advert the photo belongs to, then deletes the record.
export async function DELETE(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Look up the photo and verify ownership via the parent advert.
  const { data: photo } = await supabase
    .from("advert_photos")
    .select("id, advert_id")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const { data: ownerAdvert } = await supabase
    .from("adverts")
    .select("id")
    .eq("id", photo.advert_id)
    .eq("seller_id", user.id)
    .maybeSingle();

  if (!ownerAdvert) {
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
