import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdvertClient from "./AdvertClient";
import { getPublicAdvert, isPublishedAdvertOwner } from "@/lib/adverts/publicAdvert";
import { pageMetadata } from "@/lib/seo/site";
import { advertSchema, JsonLd } from "@/lib/seo/jsonld";
import { formatMileage, formatPrice, readableValue, vehicleName } from "@/lib/seo/vehicle";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ad = await getPublicAdvert(id);

  // Unpublished, sold or unknown advert: the page shows an "unavailable"
  // message, which must not be indexed.
  if (!ad) {
    return { title: "Advert unavailable", robots: { index: false, follow: true } };
  }

  const name = vehicleName(ad);
  const price = formatPrice(ad.price);
  const town = ad.nearest_town?.trim();

  // "2009 Mazda MX-5 for sale, £8,995, near Axminster" (+ " | OwnerCars")
  const title = [`${name} for sale`, price, town ? `near ${town}` : null]
    .filter(Boolean)
    .join(", ");

  const specs = [
    formatMileage(ad.mileage),
    readableValue(ad.fuel_type),
    readableValue(ad.gearbox),
  ].filter(Boolean);
  const description = [
    `${[name, ...specs].join(", ")}.`,
    `For sale privately${town ? ` near ${town}` : ""}${price ? ` for ${price}` : ""}.`,
    "Message the seller securely on OwnerCars.",
  ].join(" ");

  const photo = ad.advert_photos[0]?.image_url ?? undefined;

  return pageMetadata({
    title,
    description,
    // Canonical never carries a query string, so UTM-tagged shares
    // consolidate onto the clean URL.
    path: `/advert/${ad.id}`,
    image: photo,
    // Example listings aren't real cars for sale.
    noindex: !!ad.is_example,
  });
}

// Rendered per request (it reads the session cookie for the owner check), so
// an advert that is edited, paused or marked sold is reflected immediately and
// no cache revalidation is needed.
export default async function AdvertPage({ params }: Props) {
  const { id } = await params;
  const ad = await getPublicAdvert(id);

  // Draft, paused, sold or unknown: real 404 status (see ./not-found.tsx).
  if (!ad) notFound();

  const isOwner = await isPublishedAdvertOwner(id);

  return (
    <>
      {!ad.is_example && <JsonLd data={advertSchema(ad)} />}
      <AdvertClient initialAdvert={ad} initialIsOwner={isOwner} />
    </>
  );
}
