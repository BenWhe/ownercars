import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { geocodePostcode } from "@/lib/geocode/lookup";

function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getClientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
}

export async function POST(request: NextRequest) {
  const admin = createAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  let body: { email?: string; filters?: Record<string, unknown>; postcode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // IP rate limit: max 3 alert signups per IP per hour
  const ip = getClientIp(request);
  if (ip) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("search_alerts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: "Too many alert requests. Please try again later." },
        { status: 429 }
      );
    }
  }

  const filters = body.filters ?? {};

  let latitude: number | null = null;
  let longitude: number | null = null;
  let postcode: string | null = null;

  if (body.postcode?.trim()) {
    try {
      const geo = await geocodePostcode(body.postcode.trim());
      if (geo) {
        latitude = geo.latitude;
        longitude = geo.longitude;
        postcode = geo.postcode;
      }
    } catch {
      // Non-blocking — location is optional for alerts
    }
  }

  const { error } = await admin.from("search_alerts").insert({
    email,
    filters,
    postcode,
    latitude,
    longitude,
    ip,
  });

  if (error) {
    return NextResponse.json({ error: "Could not save alert." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
