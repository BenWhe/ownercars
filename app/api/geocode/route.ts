import { NextRequest, NextResponse } from "next/server";

// GET /api/geocode?postcode=XX1+1XX
// Validates and geocodes a UK postcode via postcodes.io
// Returns { postcode, latitude, longitude, nearest_town }
// No auth required — public route
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("postcode");

  if (!raw) {
    return NextResponse.json({ error: "Missing postcode." }, { status: 400 });
  }

  const encoded = encodeURIComponent(raw.trim().toUpperCase());

  let data: any;
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encoded}`);
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "Could not reach geocoding service." }, { status: 502 });
  }

  if (data.status !== 200 || !data.result) {
    return NextResponse.json({ error: "Invalid postcode." }, { status: 400 });
  }

  const r = data.result;

  function deriveTown(r: any): string | null {
    const parish: string | null = r.parish ?? null;
    if (parish && !/unparished/i.test(parish)) {
      return parish;
    }
    const ward: string | null = r.admin_ward ?? null;
    if (ward) {
      // Take the first place name before any "&" or "," separator
      return ward.split(/[&,]/)[0].trim();
    }
    return r.admin_district ?? r.parliamentary_constituency ?? r.region ?? null;
  }

  const nearest_town = deriveTown(r);

  return NextResponse.json({
    postcode: r.postcode,
    latitude: r.latitude,
    longitude: r.longitude,
    nearest_town,
  });
}
