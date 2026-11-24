import type { Metadata } from "next";
import BrowseClient from "./BrowseClient";
import { getBrowseAdverts } from "@/lib/adverts/browseAdverts";
import { filtersFromParams, type BrowseFilters } from "@/lib/vehicles/browseFilters";
import { PRICE_OPTIONS } from "@/lib/vehicles/filters";
import { makeLabel } from "@/lib/vehicles/makes";
import { pageMetadata } from "@/lib/seo/site";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Props = { searchParams: SearchParams };

function paramsGetter(sp: Record<string, string | string[] | undefined>) {
  return {
    get(name: string) {
      const v = sp[name];
      return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
    },
  };
}

const BODY_PLURALS: Record<string, string> = {
  Hatchback: "hatchbacks",
  Saloon: "saloons",
  SUV: "SUVs",
  Estate: "estates",
  Coupe: "coupés",
  Convertible: "convertibles",
  MPV: "MPVs",
  Van: "vans",
};

function priceLabel(value: string): string | null {
  if (!value) return null;
  if (value === "over-20000") return "over £20,000";
  if (value.includes("-")) {
    const [min, max] = value.split("-").map((n) => `£${Number(n).toLocaleString("en-GB")}`);
    return `from ${min} to ${max}`;
  }
  return PRICE_OPTIONS.some((o) => o.value === value)
    ? `under £${Number(value).toLocaleString("en-GB")}`
    : null;
}

// Body type, fuel and price come from fixed option lists (filtersFromParams
// drops anything else). Make is free text in the URL, so only plausible make
// names are used in the title; anything else falls back to the generic title.
const MAKE_RE = /^[A-Z0-9][A-Z0-9 -]{0,29}$/;

// "Used SUVs for sale by private sellers", "Used electric Ferrari cars under
// £2,000 from private sellers"…
function describeFilters(f: BrowseFilters): { noun: string; title: string } | null {
  const body = f.bodyType ? BODY_PLURALS[f.bodyType] : null;
  const fuel = f.fuel ? f.fuel.toLowerCase() : null;
  const make = f.make && MAKE_RE.test(f.make) ? makeLabel(f.make) : null;
  const price = priceLabel(f.price);
  if (!body && !fuel && !make && !price) return null;

  const noun = [fuel, make, body ?? "cars"].filter(Boolean).join(" ");
  const title = price
    ? `Used ${noun} ${price} from private sellers`
    : `Used ${noun} for sale by private sellers`;
  return { noun, title };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const filters = filtersFromParams(paramsGetter(await searchParams));
  const described = describeFilters(filters);

  // Every filter combination canonicalises to /browse for now (thin
  // inventory). Give popular filters their own landing pages and canonicals
  // once there are enough adverts.
  if (!described) {
    return pageMetadata({
      title: "Used cars for sale by private sellers",
      description:
        "Browse used cars from genuine private sellers, with no dealers. Message sellers securely on OwnerCars and request MOT and service history through the Secure Vault.",
      path: "/browse",
    });
  }

  return pageMetadata({
    title: described.title,
    description: `Private-seller ${described.noun} for sale on OwnerCars. No dealers, secure messaging, documents shared on the seller's terms.`,
    path: "/browse",
  });
}

// Rendered per request so new adverts appear immediately. The client takes
// over after the first render: changing filters or setting a postcode fetches
// from /api/browse exactly as before.
export default async function BrowsePage({ searchParams }: Props) {
  const filters = filtersFromParams(paramsGetter(await searchParams));
  const adverts = await getBrowseAdverts(filters);

  // null (query failed) → let the client fetch as it always has.
  return <BrowseClient initialAdverts={adverts ?? undefined} />;
}
