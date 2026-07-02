import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildFromHeader } from "@/lib/email/welcomePublished";

/** Constant-time secret comparison — avoids leaking match progress via timing. */
function secretsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

/** Trims a string field to a sane length; rejects non-strings and empties. */
function safeString(value: unknown, maxLen = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
}

function safeEmail(value: unknown): string | null {
  const s = safeString(value, 254);
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

/** Parses to a real date and re-serialises, rather than trusting the raw string. */
function safeDate(value: unknown): string | null {
  const s = safeString(value, 64);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Loose id validator — record ids are UUIDs, but stay permissive on shape. */
function safeId(value: unknown): string | null {
  const s = safeString(value, 64);
  return s && /^[0-9a-zA-Z-]+$/.test(s) ? s : null;
}

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
  const provided = req.headers.get("x-admin-secret");
  if (!secret || !provided || !secretsMatch(provided, secret)) {
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
    const email = safeEmail(record?.email) ?? "unknown";
    const createdAt = safeDate(record?.created_at) ?? "unknown";
    subject = "New OwnerCars account";
    text = `A new account was created.\n\nEmail: ${email}\nCreated: ${createdAt}`;
  } else if (table === "adverts" && type === "INSERT" && record?.status === "draft") {
    const parts = [
      safeString(record?.year, 8),
      safeString(record?.make, 80),
      safeString(record?.model, 80),
    ].filter((v): v is string => Boolean(v));
    const title = parts.length > 0 ? parts.join(" ") : "details not yet entered";
    const advertId = safeId(record?.id) ?? "unknown";
    subject = "New draft advert started";
    text = `A seller started a new advert.\n\n${title}\nAdvert ID: ${advertId}`;
  } else {
    // Unrecognised table/type combination — return 200 so Supabase doesn't retry
    return NextResponse.json({ ok: true });
  }

  if (resendApiKey && from) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Normalise to a clean "Display Name" <address> header rather than
          // sending the env value verbatim, which Resend may reject.
          from: buildFromHeader(from, "OwnerCars"),
          to: "contact@ownercars.co.uk",
          subject,
          text,
        }),
      });

      // Surface Resend HTTP errors — a non-2xx does NOT throw, so without this
      // check failures were silently dropped. We still return 200 below so
      // Supabase doesn't retry-storm, but the reason is now visible in logs.
      if (!response.ok) {
        const body = await response.text();
        console.error(`Admin notify email failed: ${response.status} ${body}`);
      }
    } catch (e) {
      console.error("Admin notify email failed:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
