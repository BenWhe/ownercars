import { SupabaseClient } from "@supabase/supabase-js";

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cap(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function advertMatchesFilters(advert: any, filters: any): boolean {
  if (filters.make && advert.make?.toLowerCase() !== filters.make.toLowerCase()) return false;
  if (filters.model && advert.model?.toLowerCase() !== filters.model.toLowerCase()) return false;
  if (filters.bodyType && advert.body_type?.toLowerCase() !== filters.bodyType.toLowerCase()) return false;
  if (filters.fuelType && advert.fuel_type?.toLowerCase() !== filters.fuelType.toLowerCase()) return false;
  if (filters.colour && advert.colour?.toLowerCase() !== filters.colour.toLowerCase()) return false;
  if (filters.minYear != null && Number(advert.year) < Number(filters.minYear)) return false;
  if (filters.maxMileage != null && Number(advert.mileage) > Number(filters.maxMileage)) return false;
  if (filters.minPrice != null && Number(advert.price) < Number(filters.minPrice)) return false;
  if (filters.maxPrice != null && Number(advert.price) > Number(filters.maxPrice)) return false;
  return true;
}

export async function matchAndNotifyAlerts(supabaseAdmin: SupabaseClient, advertId: string) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.RECONFIRMATION_EMAIL_FROM;
  if (!resendApiKey || !from) return;

  const { data: advert } = await supabaseAdmin
    .from("adverts")
    .select("id, seller_id, year, make, model, price, mileage, body_type, fuel_type, colour, nearest_town, latitude, longitude")
    .eq("id", advertId)
    .maybeSingle();

  if (!advert) return;

  // Fetch seller email to exclude them from their own alert notifications
  let sellerEmail: string | null = null;
  if (advert.seller_id) {
    try {
      const { data: { user: sellerUser } } = await supabaseAdmin.auth.admin.getUserById(advert.seller_id);
      sellerEmail = sellerUser?.email?.toLowerCase() ?? null;
    } catch {
      // Non-blocking — proceed without exclusion if lookup fails
    }
  }

  const { data: alerts } = await supabaseAdmin
    .from("search_alerts")
    .select("id, email, filters, token, latitude, longitude");

  if (!alerts || alerts.length === 0) return;

  const advertTitle = [advert.year, cap(advert.make), cap(advert.model)].filter(Boolean).join(" ");
  const advertUrl = `https://www.ownercars.co.uk/advert/${advert.id}`;
  const priceStr = advert.price ? `£${Number(advert.price).toLocaleString("en-GB")}` : "";

  const sends: Promise<void>[] = [];

  for (const alert of alerts) {
    if (sellerEmail && alert.email.toLowerCase() === sellerEmail) continue;
    if (!advertMatchesFilters(advert, alert.filters ?? {})) continue;

    const unsubscribeUrl = `https://www.ownercars.co.uk/api/alerts/unsubscribe?token=${encodeURIComponent(alert.token)}`;

    let distanceLine = "";
    if (alert.latitude && alert.longitude && advert.latitude && advert.longitude) {
      const dist = Math.round(haversineDistance(alert.latitude, alert.longitude, advert.latitude, advert.longitude));
      distanceLine = `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;">~${dist} miles from your location</p>`;
    }

    const locationLine = advert.nearest_town
      ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Near ${advert.nearest_town}</p>`
      : "";

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
              <tr>
                <td style="background:#1c2030;padding:24px 32px;">
                  <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Owner<span style="color:#2563EB;">Cars</span></span>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">A car matching your alert has been listed</p>
                  <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">A private seller just listed a car that matches your saved search.</p>
                  <div style="background:#f9fafb;border-left:4px solid #2563EB;border-radius:4px;padding:16px 20px;margin-bottom:28px;">
                    <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#111827;">${advertTitle}</p>
                    ${priceStr ? `<p style="margin:0 0 4px;font-size:14px;color:#111827;font-weight:600;">${priceStr}</p>` : ""}
                    ${locationLine}
                    ${distanceLine}
                  </div>
                  <a href="${advertUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">View advert</a>
                </td>
              </tr>
              <tr>
                <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because you set up a search alert on <a href="https://www.ownercars.co.uk" style="color:#2563EB;text-decoration:none;">OwnerCars</a>. <a href="${unsubscribeUrl}" style="color:#9ca3af;">Unsubscribe</a></p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    const text = `A car matching your alert has been listed on OwnerCars.\n\n${advertTitle}${priceStr ? ` — ${priceStr}` : ""}${advert.nearest_town ? `\nNear ${advert.nearest_town}` : ""}\n\nView it here: ${advertUrl}\n\nUnsubscribe: ${unsubscribeUrl}`;

    sends.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: alert.email,
          subject: `New match: ${advertTitle} on OwnerCars`,
          html,
          text,
        }),
      })
        .then(() => {})
        .catch((e) => console.error("Alert email send failed:", e))
    );
  }

  await Promise.all(sends);
}
