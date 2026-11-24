import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildFromHeader } from "@/lib/email/welcomePublished";
import { REPORT_REASONS, type ReportReason } from "@/lib/messages/reportReasons";
import { vehicleName } from "@/lib/seo/vehicle";

export { REPORT_REASONS, type ReportReason };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ownercars.co.uk";
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL ?? "contact@ownercars.co.uk";

/** Emails the admin address that a message was reported. Never throws. */
export async function notifyAdminOfReport(admin: SupabaseClient, messageId: string, reason: ReportReason): Promise<void> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.RECONFIRMATION_EMAIL_FROM;
    if (!resendApiKey || !from) return;

    const { data: msg } = await admin
      .from("messages")
      .select("body, sender_id, sender_ip, sender_city, sender_country, adverts(year, make, model)")
      .eq("id", messageId)
      .maybeSingle();
    if (!msg) return;

    let senderEmail: string | null = null;
    try {
      const { data } = await admin.auth.admin.getUserById(msg.sender_id);
      senderEmail = data?.user?.email ?? null;
    } catch {
      senderEmail = null;
    }
    const ad = (Array.isArray(msg.adverts) ? msg.adverts[0] : msg.adverts) as
      | { year?: number; make?: string; model?: string }
      | null;
    const title = ad ? vehicleName({ ...ad, title: "an advert" }) : "an advert";
    const where = [msg.sender_city, msg.sender_country].filter(Boolean).join(", ") || "unknown";

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: buildFromHeader(from, "OwnerCars Security"),
        to: ADMIN_ALERT_EMAIL,
        subject: `Message reported: ${title}`,
        text: [
          `A seller reported a message about ${title}.`,
          `Reason: ${REPORT_REASONS[reason]}`,
          "",
          `From: ${senderEmail ?? "unknown"} · sent from ${where} (IP ${msg.sender_ip ?? "not recorded"})`,
          "",
          "Message:",
          msg.body,
          "",
          "The account's future messages are held for review until you've looked at it.",
          `Security dashboard: ${SITE_URL}/admin/security`,
        ].join("\n"),
      }),
    });
  } catch (err) {
    console.error("Failed to send report alert:", err);
  }
}
