import type { SupabaseClient, User } from "@supabase/supabase-js";
import { geocodePostcode } from "@/lib/geocode/lookup";

export type ProfileDetailsResult =
  | { ok: true }
  | { ok: false; code: "PROFILE_INCOMPLETE"; error: string };

/**
 * Requires profiles.full_name and profiles.postcode before letting a user
 * message, request/share a document, or create a draft advert. Self-heals
 * from signup user_metadata first — the same pattern as the postcode
 * self-heal already in app/api/messages/route.ts, extended to full_name —
 * since confirm-email means the profile row is sometimes never written.
 */
export async function requireProfileDetails(
  admin: SupabaseClient,
  user: User
): Promise<ProfileDetailsResult> {
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, postcode")
    .eq("id", user.id)
    .maybeSingle();

  let fullName = (profile?.full_name ?? "").trim();
  let postcode: string | null = profile?.postcode ?? null;

  if (!fullName || !postcode) {
    const metaName: string | null = user.user_metadata?.full_name ?? null;
    const metaPostcode: string | null = user.user_metadata?.postcode ?? null;

    const healedName = !fullName && metaName ? metaName.trim() : "";
    let healedGeo: { postcode: string; latitude: number; longitude: number } | null = null;

    if (!postcode && metaPostcode) {
      try {
        healedGeo = await geocodePostcode(metaPostcode);
      } catch {
        // Falls through to PROFILE_INCOMPLETE below.
      }
    }

    if (healedName || healedGeo) {
      const update: Record<string, unknown> = {
        id: user.id,
        updated_at: new Date().toISOString(),
      };
      if (healedName) update.full_name = healedName;
      if (healedGeo) {
        update.postcode = healedGeo.postcode;
        update.latitude = healedGeo.latitude;
        update.longitude = healedGeo.longitude;
      }

      await admin.from("profiles").upsert(update, { onConflict: "id" });

      if (healedName) fullName = healedName;
      if (healedGeo) postcode = healedGeo.postcode;
    }
  }

  if (!fullName || !postcode) {
    return {
      ok: false,
      code: "PROFILE_INCOMPLETE",
      error: "Please add your name and postcode to your account first.",
    };
  }

  return { ok: true };
}
