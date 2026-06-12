import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/notify
 *
 * Target for Supabase Database Webhooks. Authenticated via the
 * x-admin-secret header (must match ADMIN_NOTIFY_SECRET env var — set the
 * same value in Vercel and in the Supabase webhook config).
 *
 * Supabase payload shape: { type, table, record, old_record, schema, ... }
 *
 * Always returns 200 after auth so Supabase doesn't retry-storm on transient
 * Resend failures.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_NOTIFY_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.RECONFIRMATION_EMAIL_FROM;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { type, table, record } = body ?? {};

  let subject = "";
  let text = "";

  if (table === "users" && type === "INSERT") {
    subject = "New OwnerCars account";
    text = `A new account was created.\n\nEmail: ${record?.email ?? "unknown"}\nCreated: ${record?.created_at ?? "unknown"}`;
  } else if (table === "adverts" && type === "INSERT" && record?.status === "draft") {
    const parts = [record?.year, record?.make, record?.model].filter(Boolean);
    const title = parts.length > 0 ? parts.join(" ") : "details not yet entered";
    subject = "New draft advert started";
    text = `A seller started a new advert.\n\n${title}\nAdvert ID: ${record?.id ?? "unknown"}`;
  } else {
    // Unrecognised table/type combination — return 200 so Supabase doesn't retry
    return NextResponse.json({ ok: true });
  }

  if (resendApiKey && from) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: "contact@ownercars.co.uk",
          subject,
          text,
        }),
      });
    } catch (e) {
      console.error("Admin notify email failed:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
