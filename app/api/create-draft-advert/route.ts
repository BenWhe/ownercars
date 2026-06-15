import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { lookupVehicle, normaliseReg } from "@/lib/mot/client";

export async function POST(request: Request) {
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

  let draft;
  try {
    draft = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // If the seller used reg-lookup, persist the normalised registration plus the
  // full raw DVSA response. We re-fetch the raw record here (server-side) rather
  // than accepting it from the client, so the motTests history never transits
  // the browser. registration + lookup_data are PRIVATE and are stripped from
  // the public browse/advert APIs.
  const registration = draft.registration
    ? normaliseReg(String(draft.registration))
    : null;
  let lookupData: unknown = null;
  if (registration) {
    try {
      lookupData = await lookupVehicle(registration);
    } catch {
      // Non-blocking — a lookup hiccup at save time must not stop draft creation.
      lookupData = null;
    }
  }

  const payload = {
    seller_id: user.id,
    seller_email: user.email,
    title: `${draft.year || ""} ${draft.make || ""} ${draft.model || ""}`.trim(),
    make: draft.make,
    model: draft.model,
    year: Number(draft.year),
    mileage: Number(draft.mileage),
    fuel_type: draft.fuelType,
    gearbox: draft.gearbox,
    price: Number(draft.price),
    body_type: draft.bodyType,
    colour: draft.colour,
    doors: Number(draft.doors),
    seats: Number(draft.seats),
    previously_written_off: draft.previouslyWrittenOff,
    description: draft.description,
    registration,
    engine_size: draft.engineSize || null,
    lookup_data: lookupData,
    postcode: draft.postcode ?? null,
    latitude: draft.latitude ?? null,
    longitude: draft.longitude ?? null,
    nearest_town: draft.nearest_town ?? null,
    status: "draft",
    paid: false,
    promo_code: null,
  };

  const { data, error } = await supabase
    .from("adverts")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.id });
}
