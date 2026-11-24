import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/messages/send";

// Sellers no longer read or write adverts with their own database session:
// the table only exposes public columns to signed-in users. These routes
// check ownership here and use the server key.

type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: Context) {
  const { id } = await context.params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const { data, error } = await admin
    .from("adverts")
    .select("*, advert_photos(*)")
    .eq("id", id)
    .eq("seller_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not authorised to manage this advert." }, { status: 403 });
  }

  return NextResponse.json({ advert: data, userId: user.id });
}

export async function PATCH(req: NextRequest, context: Context) {
  const { id } = await context.params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { title?: string; price?: number; mileage?: number; description?: string; postcode?: string; latitude?: number; longitude?: number; nearest_town?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const num = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : Number.isFinite(Number(v)) ? Number(v) : NaN);
  const price = num(body.price);
  const mileage = num(body.mileage);
  const latitude = num(body.latitude);
  const longitude = num(body.longitude);
  if ([price, mileage, latitude, longitude].some((v) => Number.isNaN(v))) {
    return NextResponse.json({ error: "Invalid number in request." }, { status: 400 });
  }

  const { data: updated, error } = await admin
    .from("adverts")
    .update({
      ...(body.title !== undefined && { title: String(body.title) }),
      ...(price !== undefined && { price }),
      ...(mileage !== undefined && { mileage }),
      ...(body.description !== undefined && { description: String(body.description) }),
      ...(body.postcode !== undefined && { postcode: body.postcode }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(body.nearest_town !== undefined && { nearest_town: body.nearest_town }),
    })
    .eq("id", id)
    .eq("seller_id", user.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "Not authorised to manage this advert." }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
