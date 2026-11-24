import { SITE_NAME, SITE_URL } from "@/lib/seo/site";
import {
  formatMake,
  formatModel,
  readableValue,
  vehicleName,
} from "@/lib/seo/vehicle";

// Server-rendered JSON-LD. "<" is escaped so advert text can never close the
// script tag early.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

// Site-wide Organization + WebSite graph, rendered once in the root layout.
// No SearchAction: Google retired the sitelinks search box in Nov 2024.
// Add social profile URLs to sameAs once the handles are claimed.
export const SITE_GRAPH = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: SITE_NAME,
      legalName: "OwnerCars Limited",
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon.png`,
      email: "contact@ownercars.co.uk",
      telephone: "+44 1392 949008",
      identifier: {
        "@type": "PropertyValue",
        propertyID: "Companies House",
        value: "17257243",
      },
      address: {
        "@type": "PostalAddress",
        streetAddress: "128 City Road",
        addressLocality: "London",
        postalCode: "EC1V 2NX",
        addressCountry: "GB",
      },
      areaServed: "GB",
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      inLanguage: "en-GB",
      publisher: { "@id": ORGANIZATION_ID },
    },
  ],
};

type ArticleInput = {
  headline: string;
  description: string;
  path: string;
  /** YYYY-MM-DD — first published (from git history). */
  datePublished: string;
  /** YYYY-MM-DD — last meaningful content change. Update when the copy changes. */
  dateModified: string;
};

export function articleSchema({ headline, description, path, datePublished, dateModified }: ArticleInput) {
  const url = `${SITE_URL}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline,
    description,
    url,
    mainEntityOfPage: url,
    datePublished,
    dateModified,
    inLanguage: "en-GB",
    image: `${SITE_URL}/opengraph-image.png`,
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

type CarAdvert = {
  id: string;
  title?: string | null;
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
  nearest_town: string | null;
  advert_photos: Array<{ image_url: string | null }>;
};

function positiveNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function nonNegativeNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Car + Offer for a published advert, plus a BreadcrumbList.
 *
 * Built only from fields the page already shows publicly. Never include the
 * registration, postcode, coordinates, seller name or contact details. Any
 * property the advert doesn't have is left out rather than guessed.
 */
export function advertSchema(ad: CarAdvert) {
  const url = `${SITE_URL}/advert/${ad.id}`;
  const name = vehicleName(ad);
  const make = formatMake(ad.make);
  const model = formatModel(ad.model);
  const year = ad.year ? String(ad.year).trim() : "";
  const price = positiveNumber(ad.price);
  const mileage = nonNegativeNumber(ad.mileage);
  const doors = positiveNumber(ad.doors);
  const seats = positiveNumber(ad.seats);
  const images = ad.advert_photos.map((p) => p.image_url).filter(Boolean) as string[];
  const description = ad.description?.trim().replace(/\s+/g, " ").slice(0, 5000);

  const car: Record<string, unknown> = {
    "@type": "Car",
    "@id": `${url}#car`,
    name,
    url,
    itemCondition: "https://schema.org/UsedCondition",
  };
  if (images.length) car.image = images;
  if (description) car.description = description;
  if (make) {
    car.brand = { "@type": "Brand", name: make };
    car.manufacturer = { "@type": "Organization", name: make };
  }
  if (model) car.model = model;
  if (year) {
    car.vehicleModelDate = year;
    car.productionDate = year;
  }
  const body = readableValue(ad.body_type);
  if (body) car.bodyType = body;
  const fuel = readableValue(ad.fuel_type);
  if (fuel) car.fuelType = fuel;
  const gearbox = readableValue(ad.gearbox);
  if (gearbox) car.vehicleTransmission = gearbox;
  const colour = readableValue(ad.colour);
  if (colour) car.color = colour;
  if (doors) car.numberOfDoors = doors;
  if (seats) car.seatingCapacity = seats;
  if (mileage !== null) {
    car.mileageFromOdometer = { "@type": "QuantitativeValue", value: mileage, unitCode: "SMI" };
  }
  if (price) {
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      price,
      priceCurrency: "GBP",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      url,
    };
    if (ad.nearest_town?.trim()) {
      offer.areaServed = { "@type": "Place", name: `${ad.nearest_town.trim()}, UK` };
    }
    car.offers = offer;
  }

  const crumbName = [make, model].filter(Boolean).join(" ") || name;
  const breadcrumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Browse", item: `${SITE_URL}/browse` },
      { "@type": "ListItem", position: 3, name: crumbName, item: url },
    ],
  };

  return { "@context": "https://schema.org", "@graph": [car, breadcrumbs] };
}
