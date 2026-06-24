import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";

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

  // Select only the columns the public advert detail page needs.
  // seller_id is fetched to compute isOwner server-side but is never returned.
  // All internal, payment, and PII fields are excluded at the query level.
  const ADVERT_SELECT =
    "id, title, make, model, year, price, mileage, description, " +
    "gearbox, body_type, colour, doors, seats, fuel_type, engine_size, " +
    "previously_written_off, nearest_town, is_example, seller_id, " +
    "advert_photos(id, advert_id, image_url, sort_order)";

  const { data, error } = await supabase
    .from("adverts")
    .select(ADVERT_SELECT)
    .eq("id", id)
    .eq("status", ADVERT_STATUS.PUBLISHED)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "This advert isn't live yet." }, { status: 404 });
  }

  const row = data as any;

  // Compute ownership server-side. seller_id is used here and then excluded
  // from the response — the page receives only the boolean result.
  const isOwner = user?.id != null && user.id === row.seller_id;

  // Build response from explicit allowlist. seller_id is intentionally absent —
  // exposing a raw user UUID in the public response enabled unauthenticated DoS
  // (cancel-checkout with a known advertId + sellerId pair).
  const advert = {
    id: row.id,
    title: row.title,
    make: row.make,
    model: row.model,
    year: row.year,
    price: row.price,
    mileage: row.mileage,
    description: row.description,
    gearbox: row.gearbox,
    body_type: row.body_type,
    colour: row.colour,
    doors: row.doors,
    seats: row.seats,
    fuel_type: row.fuel_type,
    engine_size: row.engine_size,
    previously_written_off: row.previously_written_off,
    nearest_town: row.nearest_town,
    is_example: row.is_example,
    advert_photos: row.advert_photos ?? [],
  };

  return NextResponse.json({ advert, isOwner, userId: user?.id ?? null });
}
