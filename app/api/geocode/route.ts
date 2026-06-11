import { NextRequest, NextResponse } from "next/server";
import { geocodePostcode } from "@/lib/geocode/lookup";

// GET /api/geocode?postcode=XX1+1XX
// Validates and geocodes a UK postcode via postcodes.io
// Returns { postcode, latitude, longitude, nearest_town }
// No auth required — public route
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("postcode");

  if (!raw) {
    return NextResponse.json({ error: "Missing postcode." }, { status: 400 });
  }

  const result = await geocodePostcode(raw);

  if (!result) {
    return NextResponse.json({ error: "Invalid postcode." }, { status: 400 });
  }

  return NextResponse.json(result);
}
