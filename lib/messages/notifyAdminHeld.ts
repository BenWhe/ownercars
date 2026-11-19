import { createClient } from "@supabase/supabase-js";
import { buildFromHeader } from "@/lib/email/welcomePublished";
import { buildReviewToken } from "@/lib/admin/reviewToken";
import type { RequestMeta } from "@/lib/security/requestMeta";

export type NotifyAdminHeldParams = {
  messageId: string;
  senderId: string;
  advertId: string;
  advertTitle: string;
  body: string;
  reasons: string[];
  meta: RequestMeta;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Admin-only notification for a held message — never sent to the recipient.
// Non-blocking by design: the caller must never let this failing block the
// message send itself.
export async function notifyAdminHeld({
  messageId,
  senderId,
  advertId,
  advertTitle,
  body,
  reasons,
  meta,
}: NotifyAdminHeldParams): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.RECONFIRMATION_EMAIL_FROM;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ownercars.co.uk";

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !from) return;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const [userRes, profileRes] = await Promise.all([
      fetch(`${supabaseUrl}/auth/v1/admin/users/${senderId}`, {
        headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
      }),
      admin.from("profiles").select("full_name, postcode").eq("id", senderId).maybeSingle(),
    ]);

    if (!userRes.ok) return;
    const userData = await userRes.json();
    const senderEmail: string | undefined = userData?.email;
    const accountCreatedAt: string | undefined = userData?.created_at;
    const fullName: string | null = profileRes.data?.full_name ?? null;
    const postcode: string | null = profileRes.data?.postcode ?? null;

    const token = buildReviewToken(messageId);
    const reviewUrl = token
      ? `${siteUrl}/admin/messages/${messageId}?t=${token}`
      : null;

    const subject = `Message held for review${advertTitle ? ` — ${advertTitle}` : ""}`;

    const rows: Array<[string, string]> = [
      ["Sender email", senderEmail ?? "unknown"],
      ["Sender name", fullName ?? "(not set)"],
      ["Sender postcode", postcode ?? "(not set)"],
      ["Account created", accountCreatedAt ?? "unknown"],
      ["IP", meta.ip ?? "unknown"],
      ["Location", [meta.city, meta.region, meta.country].filter(Boolean).join(", ") || "unknown"],
      ["User agent", meta.userAgent ?? "unknown"],
      ["Advert", advertTitle || "(untitled)"],
      ["Advert ID", advertId],
      ["Reasons", reasons.join(", ")],
    ];

    const htmlRows = rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:4px 0;color:#111827;font-size:13px;">${escapeHtml(value)}</td></tr>`
      )
      .join("");

    const textRows = rows.map(([label, value]) => `${label}: ${value}`).join("\n");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: buildFromHeader(from, "OwnerCars trust & safety"),
        to: "contact@ownercars.co.uk",
        subject,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"></head>
          <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
              <tr><td align="center">
                <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
                  <tr>
                    <td style="background:#1c2030;padding:24px 32px;">
                      <span style="font-size:20px;font-weight:700;color:#ffffff;">Message held for review</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px;">
                      <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">${htmlRows}</table>
                      <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Full message body:</p>
                      <div style="background:#f9fafb;border-left:4px solid #dc2626;border-radius:4px;padding:16px 20px;margin-bottom:28px;white-space:pre-wrap;font-size:14px;color:#374151;">${escapeHtml(body)}</div>
                      ${
                        reviewUrl
                          ? `<a href="${reviewUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">Review message</a>`
                          : `<p style="color:#dc2626;font-size:13px;">ADMIN_REVIEW_SECRET is not set — no review link could be generated.</p>`
                      }
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `,
        text: `A message was held for review.\n\n${textRows}\n\nFull message body:\n${body}${reviewUrl ? `\n\nReview: ${reviewUrl}` : "\n\nADMIN_REVIEW_SECRET is not set — no review link could be generated."}`,
      }),
    });
  } catch (e) {
    console.error("Failed to send held-message admin notification:", e);
  }
}
