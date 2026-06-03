import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const supabase = createSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);

  // ── Distinct makes for the filter dropdown ──────────────────────────────────
  if (searchParams.get("makes") === "1") {
    const { data, error } = await supabase
      .from("adverts")
      .select("make")
      .eq("status", "published")
      .not("make", "is", null)
      .order("make");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const makes = [
      ...new Set(
        (data ?? [])
          .map((r) => (r.make as string | null)?.trim())
          .filter(Boolean)
      ),
    ].sort() as string[];

    return NextResponse.json({ makes });
  }

  // ── Filtered advert list ────────────────────────────────────────────────────
  const make = searchParams.get("make")?.trim();
  const maxPrice = searchParams.get("maxPrice");
  const minPrice = searchParams.get("minPrice");
  const maxMileage = searchParams.get("maxMileage");
  const fuelType = searchParams.get("fuelType")?.trim();

  let query = supabase
    .from("adverts")
    .select("*, advert_photos(*)")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (make) {
    query = query.ilike("make", make);
  }
  if (maxPrice) {
    query = query.lte("price", Number(maxPrice));
  }
  if (minPrice) {
    query = query.gte("price", Number(minPrice));
  }
  if (maxMileage) {
    query = query.lte("mileage", Number(maxMileage));
  }
  if (fuelType) {
    query = query.ilike("fuel_type", fuelType);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ adverts: data ?? [] });
}
