import "server-only";

import { createClient } from "@supabase/supabase-js";
import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";
import { priceParams, type BrowseFilters } from "@/lib/vehicles/browseFilters";

// Server-side version of the filtered list in /api/browse, used to render the
// first page of /browse into the HTML. Same column allowlist, same filters and
// same response shape as the API (which is left untouched). No buyer
// location: distances are added by the client's own fetch once it knows the
// buyer's postcode.
const BROWSE_SELECT =
  "id, title, make, model, year, price, mileage, description, " +
  "nearest_town, is_example, " +
  "advert_photos(id, advert_id, image_url, sort_order)";

export type BrowseAdvert = {
  id: string;
  title: string | null;
  make: string | null;
  model: string | null;
  year: number | string | null;
  price: number | string | null;
  mileage: number | string | null;
  description: string | null;
  nearest_town: string | null;
  is_example: boolean | null;
  advert_photos: Array<{ id: string; advert_id: string; image_url: string | null; sort_order: number | null }>;
};

/** Returns null on any failure so the client falls back to fetching itself. */
export async function getBrowseAdverts(filters: BrowseFilters): Promise<BrowseAdvert[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const supabase = createClient(url, anonKey);
    let query = supabase
      .from("adverts")
      .select(BROWSE_SELECT)
      .eq("status", ADVERT_STATUS.PUBLISHED)
      .order("published_at", { ascending: false });

    // filtersFromParams only ever sets make, bodyType, fuel and price from
    // the URL; the rest are handled for completeness.
    if (filters.make) query = query.ilike("make", filters.make);
    if (filters.model) query = query.ilike("model", filters.model);
    if (filters.bodyType) query = query.ilike("body_type", filters.bodyType);
    if (filters.fuel) query = query.ilike("fuel_type", filters.fuel);
    if (filters.mileage) query = query.lte("mileage", Number(filters.mileage));
    if (filters.colour) query = query.ilike("colour", filters.colour);
    if (filters.yearFrom) query = query.gte("year", Number(filters.yearFrom));
    const pp = priceParams(filters.price);
    if (pp.maxPrice) query = query.lte("price", Number(pp.maxPrice));
    if (pp.minPrice) query = query.gte("price", Number(pp.minPrice));

    const { data, error } = await query;
    if (error || !data) return null;

    return (data as unknown as BrowseAdvert[]).map((ad) => ({
      id: ad.id,
      title: ad.title,
      make: ad.make,
      model: ad.model,
      year: ad.year,
      price: ad.price,
      mileage: ad.mileage,
      description: ad.description,
      nearest_town: ad.nearest_town,
      is_example: ad.is_example,
      advert_photos: ad.advert_photos ?? [],
    }));
  } catch {
    return null;
  }
}
