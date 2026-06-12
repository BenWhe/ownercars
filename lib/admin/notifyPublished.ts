import { SupabaseClient } from "@supabase/supabase-js";

function cap(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Sends a plain-text admin notification to contact@ownercars.co.uk when an
 * advert is published. Must be called inside a try/catch — never await without
 * one, so a Resend failure cannot affect the publish flow.
 */
export async function notifyAdvertPublished(
  supabase: SupabaseClient,
  advertId: string,
  pricePaid: string
): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.RECONFIRMATION_EMAIL_FROM;
  if (!resendApiKey || !from) return;

  const { data: advert } = await supabase
    .from("adverts")
    .select("year, make, model")
    .eq("id", advertId)
    .maybeSingle();

  const title = advert
    ? [advert.year, cap(advert.make), cap(advert.model)].filter(Boolean).join(" ") ||
      "details not yet entered"
    : "details not yet entered";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: "contact@ownercars.co.uk",
      subject: "Advert published on OwnerCars",
      text: `Advert published.\n\n${title}\nAdvert ID: ${advertId}\nPrice paid: ${pricePaid}`,
    }),
  });
}
