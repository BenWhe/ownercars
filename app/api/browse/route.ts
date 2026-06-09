import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

  // ── Distinct makes ──────────────────────────────────────────────────────────
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

  // ── Distinct models for a given make ────────────────────────────────────────
  if (searchParams.get("models") === "1") {
    const make = searchParams.get("make")?.trim();
    if (!make) {
      return NextResponse.json({ models: [] });
    }

    const { data, error } = await supabase
      .from("adverts")
      .select("model")
      .eq("status", "published")
      .ilike("make", make)
      .not("model", "is", null)
      .order("model");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const models = [
      ...new Set(
        (data ?? [])
          .map((r) => (r.model as string | null)?.trim())
          .filter(Boolean)
      ),
    ].sort() as string[];

    return NextResponse.json({ models });
  }

  // ── Filtered advert list ────────────────────────────────────────────────────
  const buyerLat = searchParams.get("buyer_lat") ? Number(searchParams.get("buyer_lat")) : null;
  const buyerLng = searchParams.get("buyer_lng") ? Number(searchParams.get("buyer_lng")) : null;

  const make = searchParams.get("make")?.trim();
  const model = searchParams.get("model")?.trim();
  const bodyType = searchParams.get("bodyType")?.trim();
  const fuelType = searchParams.get("fuelType")?.trim();
  const maxPrice = searchParams.get("maxPrice");
  const minPrice = searchParams.get("minPrice");
  const maxMileage = searchParams.get("maxMileage");
  const colour = searchParams.get("colour")?.trim();
  const minYear = searchParams.get("minYear");

  let query = supabase
    .from("adverts")
    .select("*, advert_photos(*)")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (make) query = query.ilike("make", make);
  if (model) query = query.ilike("model", model);
  if (bodyType) query = query.ilike("body_type", bodyType);
  if (fuelType) query = query.ilike("fuel_type", fuelType);
  if (maxPrice) query = query.lte("price", Number(maxPrice));
  if (minPrice) query = query.gte("price", Number(minPrice));
  if (maxMileage) query = query.lte("mileage", Number(maxMileage));
  if (colour) query = query.ilike("colour", colour);
  if (minYear) query = query.gte("year", Number(minYear));

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const adverts = (data ?? []).map((ad: any) => {
    if (buyerLat !== null && buyerLng !== null && ad.latitude && ad.longitude) {
      const dist = haversineDistance(buyerLat, buyerLng, ad.latitude, ad.longitude);
      return { ...ad, distance_miles: Math.round(dist) };
    }
    return ad;
  });

  return NextResponse.json({ adverts });
}
