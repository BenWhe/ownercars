import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

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

  const payload = {
    seller_id: user.id,
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
