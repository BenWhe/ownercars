export interface GeocodeResult {
  postcode: string;
  latitude: number;
  longitude: number;
  nearest_town: string | null;
}

function deriveTown(r: any): string | null {
  const parish: string | null = r.parish ?? null;
  if (parish && !/unparished/i.test(parish)) {
    return parish;
  }
  const ward: string | null = r.admin_ward ?? null;
  if (ward) {
    // Take the first place name before any "&" or "," separator
    return ward.split(/[&,]/)[0].trim();
  }
  return r.admin_district ?? r.parliamentary_constituency ?? r.region ?? null;
}

/**
 * Geocode a UK postcode via postcodes.io.
 * Returns null if the postcode is invalid or the service is unreachable.
 */
export async function geocodePostcode(postcode: string): Promise<GeocodeResult | null> {
  const encoded = encodeURIComponent(postcode.trim().toUpperCase());
  let data: any;
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encoded}`);
    data = await res.json();
  } catch {
    return null;
  }
  if (data.status !== 200 || !data.result) return null;
  const r = data.result;
  return {
    postcode: r.postcode,
    latitude: r.latitude,
    longitude: r.longitude,
    nearest_town: deriveTown(r),
  };
}
