import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";
import { SITE_URL } from "@/lib/seo/site";

// Rendered per request. The previous `revalidate = 3600` version was
// prerendered at build time and, on production, appears never to have been
// regenerated: in Nov 2026 the live sitemap still only listed adverts updated
// before the last deploy (25 Sep 2026). The query is
// a single small select, and crawlers fetch the sitemap rarely.
export const dynamic = "force-dynamic";

// Indexable static pages only (auth, account and payment pages are excluded).
// No lastModified for these: a build timestamp would claim every page changed
// on every deploy, which teaches crawlers to ignore lastmod.
const STATIC_PATHS = [
  "/",
  "/browse",
  "/create-advert",
  "/how-it-works",
  "/pricing",
  "/seller-protection",
  "/seller-guide",
  "/car-selling-scams",
  "/safety-advice",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
];

type SitemapAdvert = { id: string; updated_at: string | null; published_at: string | null };

// Allowlist-only fetch: id and dates for live, real adverts. Example listings
// are excluded (they're noindexed on the advert page too).
async function getLiveAdverts(): Promise<SitemapAdvert[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  try {
    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase
      .from("adverts")
      .select("id, updated_at, published_at")
      .eq("status", ADVERT_STATUS.PUBLISHED)
      .eq("is_example", false)
      .order("updated_at", { ascending: false });

    if (error || !data) return [];
    return data as SitemapAdvert[];
  } catch {
    return [];
  }
}

function toDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const adverts = await getLiveAdverts();

  const advertEntries: MetadataRoute.Sitemap = adverts.map((ad) => ({
    url: `${SITE_URL}/advert/${ad.id}`,
    lastModified: toDate(ad.updated_at) ?? toDate(ad.published_at),
  }));

  // The homepage and /browse list the latest adverts, so their content really
  // does change whenever an advert does.
  const latestAdvertChange = advertEntries[0]?.lastModified;

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`,
    ...((path === "/" || path === "/browse") && latestAdvertChange
      ? { lastModified: latestAdvertChange }
      : {}),
  }));

  return [...staticEntries, ...advertEntries];
}
