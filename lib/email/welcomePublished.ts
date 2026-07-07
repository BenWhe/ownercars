import { SupabaseClient } from "@supabase/supabase-js";

// Welcome email is always blind-copied here so support has a record of every
// send without it being visible to the seller.
const WELCOME_EMAIL_BCC = "support@ownercars.co.uk";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cap(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * First name for the greeting. The resolved full name comes from
 * profiles.full_name (collected at signup), with auth user_metadata as a
 * fallback for accounts created before name collection existed. Falls back to
 * "there" when neither is present.
 */
function greetingFirstName(fullName: string | null | undefined): string {
  const name = (fullName ?? "").trim();
  if (!name) return "there";
  return name.split(/\s+/)[0];
}

/**
 * Reads a seller's name from profiles.full_name (the primary source, populated
 * at signup). Best-effort — returns null if the row or column has no value.
 */
export async function fetchProfileFullName(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  const name = (data?.full_name ?? "").trim();
  return name || null;
}

/**
 * Build a From header with the given display name while reusing the verified
 * sending address from RECONFIRMATION_EMAIL_FROM (which may be a bare address
 * or already in "Name <addr>" form). Always emits a clean, Resend-valid
 * "Display Name" <address> header rather than passing the env value verbatim.
 */
export function buildFromHeader(envFrom: string, displayName: string): string {
  const match = envFrom.match(/<([^>]+)>/);
  const address = (match ? match[1] : envFrom).trim();
  return `"${displayName}" <${address}>`;
}

/**
 * Look up a seller's email (from the auth admin API, the same source used by
 * the message-notification route) and resolved name. The name prefers
 * profiles.full_name, falling back to auth user_metadata, then null. Returns
 * null if the lookup fails or no email is on file.
 */
export async function fetchSellerContact(
  supabase: SupabaseClient,
  sellerId: string
): Promise<{ email: string; fullName: string | null } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${sellerId}`, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const email: string | undefined = data?.email;
  if (!email) return null;

  const meta = data?.user_metadata ?? {};
  const metaName: string | null = meta.full_name ?? meta.name ?? null;

  // profiles.full_name is the primary source; metadata is the fallback.
  let profileName: string | null = null;
  try {
    profileName = await fetchProfileFullName(supabase, sellerId);
  } catch {
    // Best-effort — fall back to metadata if the profiles lookup fails.
  }

  return { email, fullName: profileName ?? metaName ?? null };
}

type WelcomeEmailParams = {
  to: string;
  fullName?: string | null;
  advertId: string;
  advertTitle: string;
};

/**
 * Sends the customer-facing "your advert is live" welcome email. Throws on a
 * failed send — callers MUST wrap this in try/catch so a Resend failure can
 * never break the publish flow.
 */
export async function sendAdvertPublishedWelcomeEmail({
  to,
  fullName,
  advertId,
  advertTitle,
}: WelcomeEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const envFrom = process.env.RECONFIRMATION_EMAIL_FROM;
  if (!apiKey || !envFrom) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.ownercars.co.uk";
  const advertUrl = `${siteUrl}/advert/${advertId}`;
  const guideUrl = `${siteUrl}/seller-guide`;

  const hi = greetingFirstName(fullName);
  const safeTitle = escapeHtml(advertTitle || "your advert");
  const subject = "Your OwnerCars advert is live";

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
            <!-- Header -->
            <tr>
              <td style="background:#1c2030;padding:24px 32px;">
                <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                  Owner<span style="color:#2563EB;">Cars</span>
                </span>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:32px;color:#374151;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111827;">Hi ${escapeHtml(hi)},</p>
                <p style="margin:0 0 16px;">Your advert is live on OwnerCars — congratulations on taking the privacy-first approach to selling your car.</p>
                <p style="margin:0 0 8px;">Here are a few things worth doing now to get the best result:</p>

                <div style="background:#f9fafb;border-left:4px solid #2563EB;border-radius:4px;padding:18px 20px;margin:16px 0 8px;">
                  <p style="margin:0 0 14px;"><strong style="color:#111827;">Add all your photos</strong> — up to 10, and the first one is your main image. More photos mean more confident buyers. You can add and reorder them from your dashboard any time.</p>
                  <p style="margin:0 0 14px;"><strong style="color:#111827;">Set up your Secure Vault</strong> — this is where you upload your MOT certificate, service history, and V5C. Buyers can request documents through the platform, and you decide who sees what. Sellers who set up their Vault get more serious enquiries. Find it in Edit advert.</p>
                  <p style="margin:0;"><strong style="color:#111827;">Share your For Sale card</strong> — open your advert and download your branded For Sale card. Post it in Facebook car groups, send it on WhatsApp, or put it in the windscreen. The QR code takes buyers straight to your listing without exposing your details.<br/><a href="${advertUrl}" style="color:#2563EB;text-decoration:none;font-weight:600;">Download your shareable For Sale card here →</a></p>
                </div>

                <p style="margin:16px 0;">You'll be emailed when a buyer messages — so you won't miss anything. Reply promptly and keep the conversation on OwnerCars to protect your privacy.</p>

                <p style="margin:0 0 24px;">If you have any questions, just reply to this email — I read every one. And if you know anyone else thinking of selling their car privately, do point them our way. 🙂</p>

                <a href="${advertUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">View your advert</a>

                <p style="margin:24px 0 0;font-size:14px;color:#6b7280;">Want more tips? Read the <a href="${guideUrl}" style="color:#2563EB;text-decoration:none;">seller guide</a>.</p>

                <p style="margin:28px 0 0;">Good luck with the sale,</p>
                <p style="margin:14px 0 0;font-weight:600;color:#111827;">Ben Wheeler</p>
                <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">Founder, OwnerCars</p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because you published <strong>${safeTitle}</strong> on <a href="${siteUrl}" style="color:#2563EB;text-decoration:none;">OwnerCars</a>.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  const text = `Hi ${hi},

Your advert is live on OwnerCars — congratulations on taking the privacy-first approach to selling your car.

Here are a few things worth doing now to get the best result:

Add all your photos — up to 10, and the first one is your main image. More photos mean more confident buyers. You can add and reorder them from your dashboard any time.

Set up your Secure Vault — this is where you upload your MOT certificate, service history, and V5C. Buyers can request documents through the platform, and you decide who sees what. Sellers who set up their Vault get more serious enquiries. Find it in Edit advert.

Share your For Sale card — open your advert and download your branded For Sale card. Post it in Facebook car groups, send it on WhatsApp, or put it in the windscreen. The QR code takes buyers straight to your listing without exposing your details.
Download your shareable For Sale card here: ${advertUrl}

You'll be emailed when a buyer messages — so you won't miss anything. Reply promptly and keep the conversation on OwnerCars to protect your privacy.

If you have any questions, just reply to this email — I read every one. And if you know anyone else thinking of selling their car privately, do point them our way. :)

View your advert: ${advertUrl}
Seller guide: ${guideUrl}

Good luck with the sale,

Ben Wheeler
Founder, OwnerCars`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: buildFromHeader(envFrom, "Ben Wheeler, OwnerCars"),
      to,
      bcc: WELCOME_EMAIL_BCC,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Welcome email failed: ${response.status} ${body}`);
  }
}

/** Builds a display title from advert fields, matching the admin-notify format. */
export function advertDisplayTitle(advert: {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
}): string {
  return (
    [advert.year, cap(advert.make), cap(advert.model)].filter(Boolean).join(" ") ||
    "your advert"
  );
}
