import "server-only";

import { messageThreadId } from "@/lib/messages/thread";

/**
 * Emails a message's recipient that they have a new message. Moved unchanged
 * from /api/messages so it can also be sent when a held message is approved.
 * Never throws: a failed email must not affect sending or approval.
 */
export async function notifyRecipientOfMessage({
  advertId,
  advertTitle,
  senderId,
  recipientId,
  body,
}: {
  advertId: string;
  advertTitle: string;
  senderId: string;
  recipientId: string;
  body: string;
}): Promise<void> {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.RECONFIRMATION_EMAIL_FROM;

    if (serviceRoleKey && supabaseUrl && resendApiKey && from) {
      // Fetch recipient email via service role
      const userRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${recipientId}`,
        {
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
        }
      );

      if (userRes.ok) {
        const userData = await userRes.json();
        const recipientEmail = userData?.email;

        if (recipientEmail) {
          // The recipient's thread is keyed by the other party: the sender.
          const threadId = messageThreadId(advertId, senderId);
          const viewUrl = `https://www.ownercars.co.uk/messages/${threadId}`;
          const preview = body.length > 200 ? body.slice(0, 200) + "…" : body;
          const subject = `New message about your ${advertTitle} on OwnerCars`;

          const safePreview = preview
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from,
              to: recipientEmail,
              subject,
              html: `
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
                          <td style="padding:32px;">
                            <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">You have a new message</p>
                            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Someone sent you a message about your <strong>${advertTitle}</strong>.</p>
                            <div style="background:#f9fafb;border-left:4px solid #2563EB;border-radius:4px;padding:16px 20px;margin-bottom:28px;">
                              <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${safePreview}</p>
                            </div>
                            <a href="${viewUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">View message</a>
                          </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
                            <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because someone messaged your advert on <a href="https://www.ownercars.co.uk" style="color:#2563EB;text-decoration:none;">OwnerCars</a>.</p>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
              `,
              text: `You have a new message about your ${advertTitle} on OwnerCars.\n\n"${preview}"\n\nView it here: ${viewUrl}`,
            }),
          });
        }
      }
    }
  } catch (emailErr) {
    console.error("Failed to send new message email notification:", emailErr);
  }
}
