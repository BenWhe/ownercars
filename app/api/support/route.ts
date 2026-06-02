import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const SUPPORT_ADDRESS = "support@ownercars.co.uk";

const VALID_SUBJECTS = [
  "Problem with my advert",
  "Payment issue",
  "Report a buyer",
  "Account issue",
  "Other",
] as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.RECONFIRMATION_EMAIL_FROM;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  if (!resendApiKey || !from) {
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
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

  let payload: { subject?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const subject = payload.subject?.trim() ?? "";
  const body = payload.body?.trim() ?? "";

  if (!VALID_SUBJECTS.includes(subject as (typeof VALID_SUBJECTS)[number])) {
    return NextResponse.json({ error: "Invalid subject." }, { status: 400 });
  }

  if (body.length < 20) {
    return NextResponse.json(
      { error: "Message must be at least 20 characters." },
      { status: 400 }
    );
  }

  const safeBody = escapeHtml(body);
  const firstName = user.user_metadata?.first_name
    ? ` ${String(user.user_metadata.first_name)}`
    : "";

  try {
    // Email to support team — includes user identity for triage
    await sendEmail(
      resendApiKey,
      from,
      SUPPORT_ADDRESS,
      `Support: ${subject} — ${user.email}`,
      `<p><strong>From:</strong> ${escapeHtml(user.email ?? "")}</p>
       <p><strong>User ID:</strong> ${escapeHtml(user.id)}</p>
       <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
       <hr>
       <p>${safeBody.replace(/\n/g, "<br>")}</p>`,
      `From: ${user.email}\nUser ID: ${user.id}\nSubject: ${subject}\n\n${body}`
    );

    // Confirmation email to the user
    await sendEmail(
      resendApiKey,
      from,
      user.email!,
      "We've received your message — OwnerCars Support",
      `<p>Hi${firstName},</p>
       <p>We've received your message and will respond within 2 business days.</p>
       <p><strong>Your message:</strong><br>${safeBody.replace(/\n/g, "<br>")}</p>
       <p>The OwnerCars team</p>`,
      `Hi${firstName},\n\nWe've received your message and will respond within 2 business days.\n\nYour message:\n${body}\n\nThe OwnerCars team`
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please email support@ownercars.co.uk directly." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
