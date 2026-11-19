import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getRequestMeta, logSecurityEvent } from "@/lib/security/requestMeta";

// POST /api/security/sign-in-event
// Called fire-and-forget right after a successful signInWithPassword
// (app/login/page.tsx) or signUp-with-session (app/create-account/page.tsx,
// which passes { event: "sign_up" }). Defaults to "sign_in".
export async function POST(req: NextRequest) {
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

  let body: { event?: string } = {};
  try {
    body = await req.json();
  } catch {
    // No body is fine — defaults to sign_in below.
  }

  const eventType = body.event === "sign_up" ? "sign_up" : "sign_in";

  await logSecurityEvent(user.id, eventType, getRequestMeta(req));

  return NextResponse.json({ ok: true });
}
