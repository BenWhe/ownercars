import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin/session";
import { createAdminClient } from "@/lib/messages/send";
import { getTrustStatus } from "@/lib/messages/review";

type Context = { params: Promise<{ userId: string }> };

/**
 * GET /api/admin/evidence/[userId]  (admin only)
 *
 * A plain-text evidence record for one account, for a Report Fraud or police
 * report: account details, every message it sent and every blocked attempt,
 * each with time (UTC), IP address, approximate location and device. Only
 * this account's own data is included; the people it contacted are
 * identified by advert, not by name or email.
 */
export async function GET(_req: NextRequest, context: Context) {
  const adminUser = await getAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Server configuration error." }, { status: 500 });

  const { userId } = await context.params;
  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const [trust, profile, messages, blocks] = await Promise.all([
    getTrustStatus(admin, userId),
    admin.from("profiles").select("*").eq("id", userId).maybeSingle().then((r) => r.data),
    admin
      .from("messages")
      .select("created_at, status, body, sender_ip, sender_city, sender_region, sender_country, sender_user_agent, advert_id, adverts(year, make, model)")
      .eq("sender_id", userId)
      .order("created_at")
      .then((r) => r.data ?? []),
    admin
      .from("message_blocks")
      .select("created_at, body, reasons, sender_ip, sender_city, sender_region, sender_country, sender_user_agent, advert_id")
      .eq("sender_id", userId)
      .order("created_at")
      .then((r) => r.data ?? []),
  ]);

  const where = (r: { sender_city?: string | null; sender_region?: string | null; sender_country?: string | null }) =>
    [r.sender_city, r.sender_region, r.sender_country].filter(Boolean).join(", ") || "unknown";
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const lines: string[] = [
    "OwnerCars — account evidence record",
    `Generated: ${new Date().toISOString()} (all times UTC)`,
    "Platform: OwnerCars (www.ownercars.co.uk), operated by OwnerCars Limited, company no. 17257243",
    "",
    "ACCOUNT",
    `Account ID: ${user.id}`,
    `Email: ${user.email ?? "none"}`,
    `Signed up: ${user.created_at}`,
    `Email confirmed: ${user.email_confirmed_at ?? "no"}`,
    `Last sign-in: ${user.last_sign_in_at ?? "unknown"}`,
    `Name given: ${[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.full_name || meta.full_name || "none"}`,
    `Postcode given: ${profile?.postcode ?? meta.postcode ?? "none"}`,
    `Status on OwnerCars: ${trust}`,
    "",
    `MESSAGES SENT (${messages.length})`,
  ];
  for (const m of messages as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const ad = Array.isArray(m.adverts) ? m.adverts[0] : m.adverts;
    lines.push(
      "",
      `${m.created_at} · ${m.status} · advert: ${[ad?.year, ad?.make, ad?.model].filter(Boolean).join(" ") || m.advert_id}`,
      `IP: ${m.sender_ip ?? "not recorded"} · location: ${where(m)}`,
      `Device: ${m.sender_user_agent ?? "not recorded"}`,
      `Text: ${m.body}`
    );
  }
  lines.push("", `BLOCKED ATTEMPTS (${blocks.length}) — refused for containing contact details`);
  for (const b of blocks as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    lines.push(
      "",
      `${b.created_at} · caught: ${(b.reasons ?? []).join(", ")} · advert ID: ${b.advert_id ?? "unknown"}`,
      `IP: ${b.sender_ip ?? "not recorded"} · location: ${where(b)}`,
      `Device: ${b.sender_user_agent ?? "not recorded"}`,
      `Text: ${b.body}`
    );
  }
  lines.push(
    "",
    "Note: IP addresses and messages sent before 24 Nov 2026 were not recorded with location data. Sign-in IPs",
    "for the account are held by our authentication provider (Supabase) and can be supplied on request."
  );

  const safeEmail = (user.email ?? user.id).replace(/[^a-z0-9.@_-]+/gi, "_");
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="ownercars-evidence-${safeEmail}.txt"`,
      "Cache-Control": "no-store",
    },
  });
}
