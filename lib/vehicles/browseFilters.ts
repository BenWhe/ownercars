// URL ↔ filter helpers shared by the /browse server page and its client
// component, so the server-rendered first page and the client's own fetch
// always apply the same filters. Moved unchanged from app/browse/page.tsx.
import { canonicalMake } from "@/lib/vehicles/makes";
import { BODY_TYPE_OPTIONS, FUEL_OPTIONS, PRICE_OPTIONS } from "@/lib/vehicles/filters";

export function priceParams(value: string): Record<string, string> {
  if (!value) return {};
  if (value === "over-20000") return { minPrice: "20000" };
  if (value.includes("-")) {
    const [min, max] = value.split("-");
    return { minPrice: min, maxPrice: max };
  }
  return { maxPrice: value };
}

export const EMPTY_FILTERS = {
  make: "",
  model: "",
  bodyType: "",
  fuel: "",
  price: "",
  mileage: "",
  colour: "",
  yearFrom: "",
};

export type BrowseFilters = typeof EMPTY_FILTERS;

// Match an incoming URL value against a known option list, case-insensitively,
// and return the option's canonical value (or "" if it isn't a known option).
export function matchOption(options: { value: string }[], input: string | null): string {
  if (!input) return "";
  const wanted = input.trim().toLowerCase();
  return options.find((o) => o.value && o.value.toLowerCase() === wanted)?.value ?? "";
}

export function filtersFromParams(sp: { get(name: string): string | null }): BrowseFilters {
  return {
    ...EMPTY_FILTERS,
    make: canonicalMake(sp.get("make")),
    bodyType: matchOption(BODY_TYPE_OPTIONS, sp.get("bodyType")),
    fuel: matchOption(FUEL_OPTIONS, sp.get("fuel")),
    price: matchOption(PRICE_OPTIONS, sp.get("price")),
  };
}
