import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/messages/send";
import { getRequestContext } from "@/lib/security/requestContext";
import { ACTIVITY_COOKIE, activityFingerprint, recordAccountActivity } from "@/lib/security/activity";

export async function GET(request: NextRequest) {
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
    return NextResponse.json({ unreadCount: 0 });
  }

  // Record where this account is using the site from (at most hourly per IP).
  const context = getRequestContext(request);
  let activityCookie: string | null = null;
  if (context.ip) {
    const fingerprint = activityFingerprint(user.id, context.ip);
    if (request.cookies.get(ACTIVITY_COOKIE)?.value !== fingerprint) {
      const admin = createAdminClient();
      if (admin) await recordAccountActivity(admin, user.id, context);
      activityCookie = fingerprint;
    }
  }

  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const response = NextResponse.json({ unreadCount: count || 0 });
  if (activityCookie) {
    response.cookies.set(ACTIVITY_COOKIE, activityCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
  }
  return response;
}
