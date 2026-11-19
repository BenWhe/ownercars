import { createClient } from "@supabase/supabase-js";

export type RequestMeta = {
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
};

export type SecurityEventType =
  | "sign_up"
  | "sign_in"
  | "message_sent"
  | "message_held"
  | "draft_created";

// Same approach as getClientIp in app/api/alerts/route.ts, extended with the
// x-real-ip fallback and the Vercel geo headers security_events also wants.
export function getRequestMeta(req: Request): RequestMeta {
  const headers = req.headers;
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null;

  const rawCity = headers.get("x-vercel-ip-city");

  return {
    ip,
    userAgent: headers.get("user-agent"),
    country: headers.get("x-vercel-ip-country"),
    region: headers.get("x-vercel-ip-country-region"),
    city: rawCity ? decodeURIComponent(rawCity) : null,
  };
}

function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Logs a security_events row with the service-role client. Never throws —
 * every caller fires this without awaiting its failure, so a logging hiccup
 * can never block the request it's attached to.
 *
 * Also backfills a sign_up row the first time a user with no prior
 * security_events hits any instrumented route: in production, email
 * confirmation means signUp() never returns a session, so it never gets a
 * chance to call this itself — the backfill is the only record of sign-up
 * for those accounts.
 */
export async function logSecurityEvent(
  userId: string,
  eventType: SecurityEventType,
  meta: RequestMeta,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const admin = createAdmin();
    if (!admin) return;

    if (eventType !== "sign_up") {
      const { count } = await admin
        .from("security_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (!count) {
        await admin.from("security_events").insert({
          user_id: userId,
          event_type: "sign_up",
          ip: meta.ip,
          user_agent: meta.userAgent,
          country: meta.country,
          region: meta.region,
          city: meta.city,
          metadata: { backfilled: true },
        });
      }
    }

    await admin.from("security_events").insert({
      user_id: userId,
      event_type: eventType,
      ip: meta.ip,
      user_agent: meta.userAgent,
      country: meta.country,
      region: meta.region,
      city: meta.city,
      metadata: metadata ?? {},
    });
  } catch (e) {
    console.error("logSecurityEvent failed:", e);
  }
}
