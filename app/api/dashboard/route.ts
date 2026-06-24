import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function GET() {
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

  // Select only the columns the dashboard UI renders. Excludes
  // availability_confirmation_token, stripe_*, payment_*, checkout_*, and all
  // other internal/token fields that must not reach the browser.
  const DASHBOARD_SELECT =
    "id, title, make, model, year, price, mileage, " +
    "fuel_type, gearbox, colour, status, is_example, created_at, " +
    "advert_photos(id, image_url, sort_order)";

  const { data, error } = await supabase
    .from("adverts")
    .select(DASHBOARD_SELECT)
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Build response from explicit allowlist — any column not named above is
  // excluded by construction.
  const adverts = (data ?? []).map((ad: any) => ({
    id: ad.id,
    title: ad.title,
    make: ad.make,
    model: ad.model,
    year: ad.year,
    price: ad.price,
    mileage: ad.mileage,
    fuel_type: ad.fuel_type,
    gearbox: ad.gearbox,
    colour: ad.colour,
    status: ad.status,
    is_example: ad.is_example,
    advert_photos: ad.advert_photos ?? [],
  }));

  const { count: unreadCount, error: unreadError } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (unreadError) {
    return NextResponse.json({ error: unreadError.message }, { status: 400 });
  }

  return NextResponse.json({ adverts, userId: user.id, unreadCount: unreadCount || 0 });
}
