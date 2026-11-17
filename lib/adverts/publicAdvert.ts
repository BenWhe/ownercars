import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";

// Public, published-only advert fetch for server rendering (metadata, JSON-LD
// and the advert page itself). Same allowlist discipline as
// /api/public-adverts/[id]: no seller_id, postcode, coordinates, registration
// or payment fields are ever selected here.
export type PublicAdvertPhoto = {
  id: string;
  image_url: string | null;
  sort_order: number | null;
};

export type PublicAdvert = {
  id: string;
  title: string | null;
  make: string | null;
  model: string | null;
  year: number | string | null;
  price: number | string | null;
  mileage: number | string | null;
  description: string | null;
  gearbox: string | null;
  body_type: string | null;
  colour: string | null;
  doors: number | string | null;
  seats: number | string | null;
  fuel_type: string | null;
  engine_size: number | string | null;
  previously_written_off: string | null;
  nearest_town: string | null;
  is_example: boolean | null;
  updated_at: string | null;
  advert_photos: PublicAdvertPhoto[];
};

const PUBLIC_ADVERT_SELECT =
  "id, title, make, model, year, price, mileage, description, " +
  "gearbox, body_type, colour, doors, seats, fuel_type, engine_size, " +
  "previously_written_off, nearest_town, is_example, updated_at, " +
  "advert_photos(id, image_url, sort_order)";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sortedPhotos(photos?: PublicAdvertPhoto[] | null): PublicAdvertPhoto[] {
  return [...(photos ?? [])]
    .filter((p) => !!p.image_url)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/**
 * Returns the advert if it is published, otherwise null (draft, paused, sold,
 * unknown id, or any database error). Wrapped in React cache() so
 * generateMetadata and the page share one query per request.
 */
export const getPublicAdvert = cache(async (id: string): Promise<PublicAdvert | null> => {
  if (!UUID_RE.test(id)) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase
      .from("adverts")
      .select(PUBLIC_ADVERT_SELECT)
      .eq("id", id)
      .eq("status", ADVERT_STATUS.PUBLISHED)
      .maybeSingle();

    if (error || !data) return null;
    const advert = data as unknown as PublicAdvert;
    return { ...advert, advert_photos: sortedPhotos(advert.advert_photos) };
  } catch {
    return null;
  }
});

/**
 * True when the signed-in user owns this published advert. Mirrors the
 * isOwner check in /api/public-adverts/[id]: seller_id is read on the server
 * and compared here, and only the boolean ever reaches the page.
 */
export async function isPublishedAdvertOwner(id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Server Components can't set cookies; session refresh is handled by
        // proxy.ts and the browser client.
        setAll() {},
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from("adverts")
      .select("seller_id")
      .eq("id", id)
      .eq("status", ADVERT_STATUS.PUBLISHED)
      .maybeSingle();

    return !!data && (data as { seller_id: string | null }).seller_id === user.id;
  } catch {
    return false;
  }
}
