import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600;

const STATIC_PATHS = [
  "",
  "/browse",
  "/how-it-works",
  "/seller-protection",
  "/seller-guide",
  "/safety-advice",
  "/contact",
  "/pricing",
  "/privacy",
  "/terms",
];

// Allowlist-only fetch: id + updated_at for published adverts. No title,
// price, seller, or any other field — the sitemap only needs a URL and a
// last-modified date per entry.
async function getPublishedAdvertEntries(siteUrl: string): Promise<MetadataRoute.Sitemap> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  try {
    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase
      .from("adverts")
      .select("id, updated_at")
      .eq("status", "published");

    if (error || !data) return [];

    return data.map((ad: { id: string; updated_at: string | null }) => ({
      url: `${siteUrl}/advert/${ad.id}`,
      lastModified: ad.updated_at ? new Date(ad.updated_at) : undefined,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.ownercars.co.uk";

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${siteUrl}${path}`,
  }));

  const advertEntries = await getPublishedAdvertEntries(siteUrl);

  return [...staticEntries, ...advertEntries];
}
