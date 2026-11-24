import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestContext } from "@/lib/security/requestContext";

// Records where a signed-in account uses the site from (account_ip_history),
// so the security dashboard has an IP and location for accounts that haven't
// sent a message yet. Called from /api/messages/unread, which the header hits
// on every page. Throttled with a cookie: one write per account per IP per
// hour at most.

export const ACTIVITY_COOKIE = "oc_seen";

export function activityFingerprint(userId: string, ip: string): string {
  const hour = Math.floor(Date.now() / 3_600_000);
  return createHash("sha256").update(`${userId}|${ip}|${hour}`).digest("base64url").slice(0, 22);
}

export async function recordAccountActivity(
  admin: SupabaseClient,
  userId: string,
  context: RequestContext
): Promise<void> {
  if (!context.ip) return;
  try {
    const { data: existing } = await admin
      .from("account_ip_history")
      .select("seen_count")
      .eq("user_id", userId)
      .eq("ip", context.ip)
      .maybeSingle();

    const now = new Date().toISOString();
    if (existing) {
      await admin
        .from("account_ip_history")
        .update({
          last_seen_at: now,
          seen_count: (existing.seen_count ?? 1) + 1,
          country: context.country,
          region: context.region,
          city: context.city,
          user_agent: context.userAgent,
        })
        .eq("user_id", userId)
        .eq("ip", context.ip);
    } else {
      await admin.from("account_ip_history").insert({
        user_id: userId,
        ip: context.ip,
        country: context.country,
        region: context.region,
        city: context.city,
        user_agent: context.userAgent,
        first_seen_at: now,
        last_seen_at: now,
      });
    }
  } catch (err) {
    // Never let activity logging affect the page.
    console.error("Failed to record account activity:", err);
  }
}
