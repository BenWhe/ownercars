import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import AdvertClient from "./AdvertClient";

type MetaAdvert = {
  make: string | null;
  model: string | null;
  year: number | string | null;
  price: number | string | null;
  mileage: number | string | null;
  nearest_town: string | null;
  advert_photos?: Array<{ image_url: string | null; sort_order: number | null }>;
};

function capitaliseWords(str?: string | null) {
  if (!str) return "";
  return str
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function firstPhotoUrl(ad: MetaAdvert): string | null {
  const photos = [...(ad.advert_photos ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  return photos[0]?.image_url ?? null;
}

// Fetch only the public-safe fields needed for metadata/OG — same allowlist
// discipline as /api/public-adverts/[id]: no seller_id, postcode, coordinates,
// registration, or payment fields. Only published adverts are returned.
async function getMetaAdvert(id: string): Promise<MetaAdvert | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase
      .from("adverts")
      .select(
        "make, model, year, price, mileage, nearest_town, " +
          "advert_photos(image_url, sort_order)"
      )
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();

    if (error || !data) return null;
    return data as unknown as MetaAdvert;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ad = await getMetaAdvert(id);

  // Unpublished/missing advert — fall back to the site's generic metadata,
  // no error.
  if (!ad) return {};

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.ownercars.co.uk";
  const upperTitle = `${ad.year || ""} ${capitaliseWords(ad.make).toUpperCase()} ${capitaliseWords(
    ad.model
  ).toUpperCase()}`.trim();
  const price = ad.price != null ? `£${Number(ad.price).toLocaleString()}` : null;

  // Title template in the root layout appends " | OwnerCars".
  const title = price ? `${upperTitle} — ${price}` : upperTitle;

  const naturalTitle = `${ad.year || ""} ${capitaliseWords(ad.make)} ${capitaliseWords(
    ad.model
  )}`.trim();
  const mileageStr =
    ad.mileage != null ? `${Number(ad.mileage).toLocaleString()} miles` : null;
  const locationStr = ad.nearest_town ? ` near ${ad.nearest_town}` : "";

  const descriptionParts = [
    `${naturalTitle} for sale privately${locationStr}.`,
    [mileageStr, price].filter(Boolean).join(", ") + ".",
    "Contact the seller securely on OwnerCars — no details exposed.",
  ];
  const description = descriptionParts.filter(Boolean).join(" ");

  const photoUrl = firstPhotoUrl(ad);
  const ogImage = photoUrl || `${siteUrl}/opengraph-image.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/advert/${id}`,
      type: "website",
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function AdvertPage() {
  return <AdvertClient />;
}
