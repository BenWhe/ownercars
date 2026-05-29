import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// POST /api/upload-photo
// Body: FormData — file (File), advertId (string), sortOrder (number)
// Returns { photo, photos } where photos is the full ordered list for the advert
// so the caller never needs a separate fetchPhotos() after upload.
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("[upload-photo POST] Missing env vars");
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
  }

  // Auth via cookie session only.
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) {
    console.warn("[upload-photo POST] Not authenticated");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    console.error("[upload-photo POST] Failed to parse form data:", e);
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const advertId = formData.get("advertId") as string | null;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  console.log("[upload-photo POST] userId:", user.id, "advertId:", advertId,
    "file:", file?.name, "size:", file?.size, "type:", file?.type, "sortOrder:", sortOrder);

  if (!file || !advertId) {
    return NextResponse.json({ error: "Missing file or advertId" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  // All data operations use the service-role key so RLS join policies don't
  // interfere. Ownership is verified in code below.
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id, seller_id")
    .eq("id", advertId)
    .maybeSingle();

  console.log("[upload-photo POST] ownership check — advert:", advert?.id,
    "seller_id:", advert?.seller_id, "user.id:", user.id, "error:", advertError?.message);

  if (!advert || advert.seller_id !== user.id) {
    return NextResponse.json(
      { error: "Not authorised to upload photos to this advert" },
      { status: 403 }
    );
  }

  // Derive file extension from MIME type as a fallback to avoid bare filenames.
  const mimeExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  const extFromName = file.name.split(".").pop()?.toLowerCase();
  const fileExt = extFromName || mimeExt[file.type] || "jpg";
  const filePath = `${advertId}/${Date.now()}.${fileExt}`;

  console.log("[upload-photo POST] uploading to storage path:", filePath);

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("advert-photos")
    .upload(filePath, new Uint8Array(arrayBuffer), { contentType: file.type });

  if (uploadError) {
    console.error("[upload-photo POST] storage upload error:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  console.log("[upload-photo POST] storage upload OK");

  const { data: publicUrlData } = supabase.storage
    .from("advert-photos")
    .getPublicUrl(filePath);

  console.log("[upload-photo POST] public URL:", publicUrlData.publicUrl);

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
    console.error("[upload-photo POST] advert_photos insert error:", dbError.message);
    return NextResponse.json({ error: dbError.message }, { status: 400 });
  }

  console.log("[upload-photo POST] DB insert OK, photoId:", photoRecord.id);

  // Return the full ordered photos list for this advert so the caller can
  // update UI state directly without a separate fetchPhotos() call.
  const { data: allPhotos } = await supabase
    .from("advert_photos")
    .select("*")
    .eq("advert_id", advertId)
    .order("sort_order", { ascending: true });

  return NextResponse.json({ photo: photoRecord, photos: allPhotos || [] });
}

// DELETE /api/upload-photo
// Body: JSON { photoId: string }
// Returns { success, photos } — remaining photos for the advert after deletion.
export async function DELETE(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("[upload-photo DELETE] Missing env vars");
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
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
    console.warn("[upload-photo DELETE] Not authenticated");
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

  console.log("[upload-photo DELETE] userId:", user.id, "photoId:", photoId);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: photo } = await supabase
    .from("advert_photos")
    .select("id, advert_id")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo) {
    console.warn("[upload-photo DELETE] photo not found:", photoId);
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const { data: advert } = await supabase
    .from("adverts")
    .select("id, seller_id")
    .eq("id", photo.advert_id)
    .maybeSingle();

  console.log("[upload-photo DELETE] advert seller_id:", advert?.seller_id, "user.id:", user.id);

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
    console.error("[upload-photo DELETE] delete error:", deleteError.message);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  console.log("[upload-photo DELETE] deleted OK, fetching remaining photos");

  const { data: remainingPhotos } = await supabase
    .from("advert_photos")
    .select("*")
    .eq("advert_id", photo.advert_id)
    .order("sort_order", { ascending: true });

  return NextResponse.json({ success: true, photos: remainingPhotos || [] });
}
