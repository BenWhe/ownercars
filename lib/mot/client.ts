// Server-only DVSA MOT History API client.
//
// OAuth2 client-credentials flow. The access token is cached at module scope
// until shortly before it expires, so we don't exchange credentials on every
// request (the token is valid ~1hr).
//
// Never import this from a client component — it reads server-only secrets.

const VEHICLE_ENDPOINT =
  "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";

/** Thrown when the registration is valid-looking but DVSA has no record (404). */
export class MotNotFoundError extends Error {
  constructor(message = "No vehicle found for that registration.") {
    super(message);
    this.name = "MotNotFoundError";
  }
}

/** Thrown for any other failure (auth, network, 5xx, malformed response). */
export class MotApiError extends Error {
  constructor(message = "Vehicle lookup is temporarily unavailable.") {
    super(message);
    this.name = "MotApiError";
  }
}

type CachedToken = { token: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

// Refresh a little before the real expiry so an in-flight request can't use a
// token that lapses mid-call.
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

export async function getMotToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const clientId = process.env.DVSA_MOT_CLIENT_ID;
  const clientSecret = process.env.DVSA_MOT_CLIENT_SECRET;
  const tokenUrl = process.env.DVSA_MOT_TOKEN_URL;
  const scope = process.env.DVSA_MOT_SCOPE;

  if (!clientId || !clientSecret || !tokenUrl || !scope) {
    throw new MotApiError("Vehicle lookup is not configured.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  let res: Response;
  try {
    res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    throw new MotApiError();
  }

  if (!res.ok) {
    throw new MotApiError("Could not authenticate with the vehicle service.");
  }

  let json: { access_token?: string; expires_in?: number };
  try {
    json = await res.json();
  } catch {
    throw new MotApiError();
  }

  if (!json.access_token) {
    throw new MotApiError();
  }

  const ttlMs = (json.expires_in ?? 3600) * 1000;
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + ttlMs - TOKEN_EXPIRY_BUFFER_MS,
  };

  return cachedToken.token;
}

/** Normalise a registration: uppercase, strip everything that isn't A–Z/0–9. */
export function normaliseReg(reg: string): string {
  return reg.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Fetch the full raw DVSA MOT History record for a registration.
 * Returns the parsed JSON exactly as DVSA sends it (including motTests).
 * Throws MotNotFoundError on 404, MotApiError on anything else.
 */
export async function lookupVehicle(reg: string): Promise<any> {
  const apiKey = process.env.DVSA_MOT_API_KEY;
  if (!apiKey) {
    throw new MotApiError("Vehicle lookup is not configured.");
  }

  const token = await getMotToken();
  const normalised = normaliseReg(reg);

  let res: Response;
  try {
    res = await fetch(`${VEHICLE_ENDPOINT}/${encodeURIComponent(normalised)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
    });
  } catch {
    throw new MotApiError();
  }

  if (res.status === 404) {
    throw new MotNotFoundError();
  }

  if (!res.ok) {
    throw new MotApiError();
  }

  try {
    return await res.json();
  } catch {
    throw new MotApiError();
  }
}
