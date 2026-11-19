// Shared "you have a message" email, used by both message POST routes and
// the admin release action. Non-blocking by design: every caller fires this
// without letting a failure affect the message send/release itself.

export type NotifyRecipientParams = {
  recipientId: string;
  // Which side of the advert the recipient is on — determines the copy.
  recipientRole: "seller" | "buyer";
  advertTitle: string;
  threadId: string;
};

export async function notifyRecipient({
  recipientId,
  recipientRole,
  advertTitle,
  threadId,
}: NotifyRecipientParams): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.RECONFIRMATION_EMAIL_FROM;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ownercars.co.uk";

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !from) return;

    const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${recipientId}`, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    });
    if (!userRes.ok) return;

    const userData = await userRes.json();
    const recipientEmail: string | undefined = userData?.email;
    if (!recipientEmail) return;

    const viewUrl = `${siteUrl}/messages/${threadId}`;

    const isBuyer = recipientRole === "buyer";
    const subject = isBuyer
      ? advertTitle
        ? `You have a reply about the ${advertTitle}`
        : "You have a reply about your enquiry"
      : advertTitle
        ? `New message about your ${advertTitle} on OwnerCars`
        : "New message on OwnerCars";

    const headline = isBuyer ? "The seller has replied" : "You have a new message";
    const intro = isBuyer
      ? advertTitle
        ? `The seller of the <strong>${advertTitle}</strong> has replied to your message on OwnerCars.`
        : "The seller has replied to your message on OwnerCars."
      : `Someone sent you a message about your <strong>${advertTitle || "advert"}</strong> on OwnerCars.`;

    const text = isBuyer
      ? `The seller has replied to your message on OwnerCars.\n\nView the reply here: ${viewUrl}`
      : `You have a new message about your ${advertTitle || "advert"} on OwnerCars.\n\nView it here: ${viewUrl}`;

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
                  <tr>
                    <td style="background:#1c2030;padding:24px 32px;">
                      <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                        Owner<span style="color:#2563EB;">Cars</span>
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px;">
                      <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">${headline}</p>
                      <p style="margin:0 0 28px;font-size:14px;color:#6b7280;">${intro}</p>
                      <a href="${viewUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">View on OwnerCars</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
                      <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because of a message on <a href="${siteUrl}" style="color:#2563EB;text-decoration:none;">OwnerCars</a>. Reply directly on-platform to keep your details private.</p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `,
        text,
      }),
    });
  } catch (e) {
    console.error("Failed to send message notification email:", e);
  }
}
