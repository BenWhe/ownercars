import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function createAuthClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createAuthClient(cookieStore);
  if (!supabase) return NextResponse.json({ error: "Missing env vars" }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ user: null });
  }

  // Fetch profile (postcode/location/name) using service role to avoid RLS complexity
  let profile: {
    postcode: string | null;
    latitude: number | null;
    longitude: number | null;
    full_name: string | null;
  } | null = null;
  if (serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await admin
      .from("profiles")
      .select("postcode, latitude, longitude, full_name")
      .eq("id", user.id)
      .maybeSingle();
    profile = data ?? null;
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email, user_metadata: user.user_metadata ?? {} },
    profile: profile ?? { postcode: null, latitude: null, longitude: null, full_name: null },
  });
}

// PATCH /api/account — update buyer's postcode/location in profiles table
export async function PATCH(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createAuthClient(cookieStore);
  if (!supabase) return NextResponse.json({ error: "Missing env vars" }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: {
    postcode?: string;
    latitude?: number;
    longitude?: number;
    full_name?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Build the upsert from only the fields the caller actually sent, so a
  // partial update (e.g. name only) never nulls out postcode/location and
  // vice-versa. onConflict updates just the provided columns.
  const updates: Record<string, unknown> = {
    id: user.id,
    updated_at: new Date().toISOString(),
  };

  if ("postcode" in body || "latitude" in body || "longitude" in body) {
    updates.postcode = body.postcode ?? null;
    updates.latitude = body.latitude ?? null;
    updates.longitude = body.longitude ?? null;
  }

  if ("full_name" in body) {
    const trimmed = typeof body.full_name === "string" ? body.full_name.trim() : "";
    updates.full_name = trimmed || null;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await admin
    .from("profiles")
    .upsert(updates, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
