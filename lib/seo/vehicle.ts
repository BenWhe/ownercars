import { makeLabel } from "@/lib/vehicles/makes";

// Display formatting for vehicle fields used in titles, descriptions and
// structured data. Adverts store make/model as DVSA returns them (upper case),
// e.g. "MERCEDES-BENZ" / "E" or "MAZDA" / "MX-5".

// Model words that stay upper case even though they're longer than two letters.
const MODEL_ACRONYMS = new Set([
  "AMG", "GTI", "GTD", "GTE", "GTS", "GTR", "TDI", "TSI", "TFSI", "HDI",
  "CDI", "SVR", "SVA", "SRT", "STI", "WRX", "EV", "PHEV", "HSE", "TT",
  "RS", "SLK", "SLC", "CLA", "CLS", "GLA", "GLB", "GLC", "GLE", "GLS",
  "XC", "CR-V", "HR-V", "RAV4", "MPV", "SUV", "TVR", "DB", "GT", "GTV",
]);

function formatModelPart(part: string): string {
  const upper = part.toUpperCase();
  // Anything with a digit is a designation (MX-5, M2, A4, 400, RAV4): keep it.
  if (/\d/.test(part)) return upper;
  if (MODEL_ACRONYMS.has(upper)) return upper;
  // One- or two-letter models (Mercedes "E", "C", "GT") stay upper case.
  if (part.length <= 2) return upper;
  return upper.charAt(0) + upper.slice(1).toLowerCase();
}

export function formatMake(make?: string | null): string {
  if (!make || !make.trim()) return "";
  return makeLabel(make);
}

export function formatModel(model?: string | null): string {
  if (!model || !model.trim()) return "";
  return model
    .trim()
    .split(/\s+/)
    .map((word) => word.split("-").map(formatModelPart).join("-"))
    .join(" ");
}

/** "2009 Mazda MX-5". Falls back to the advert's own title. */
export function vehicleName(ad: {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
  title?: string | null;
}): string {
  const name = [ad.year, formatMake(ad.make), formatModel(ad.model)]
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
    .join(" ")
    .trim();
  return name || ad.title?.trim() || "Private car advert";
}

export function formatPrice(price?: number | string | null): string | null {
  if (price === null || price === undefined || price === "") return null;
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `£${n.toLocaleString("en-GB")}`;
}

export function formatMileage(mileage?: number | string | null): string | null {
  if (mileage === null || mileage === undefined || mileage === "") return null;
  const n = Number(mileage);
  if (!Number.isFinite(n) || n < 0) return null;
  return `${n.toLocaleString("en-GB")} miles`;
}

/** Normalises free-ish text values ("PETROL", "manual") into readable words. */
export function readableValue(value?: string | null): string | null {
  if (!value || !value.trim()) return null;
  const v = value.trim();
  const upper = v.toUpperCase();
  if (upper === "SUV" || upper === "MPV") return upper;
  if (upper === "OTHER") return null;
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}
