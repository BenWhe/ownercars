import type { NextRequest } from "next/server";

// Where a request came from, as seen by Vercel's edge. Stored with every
// message (and every blocked attempt) so a report to the police or Report
// Fraud can include the sender's IP, approximate location and device.
//
// Vercel sets the x-vercel-ip-* headers on every production request; they
// are absent locally, in which case the fields are null.
export type RequestContext = {
  ip: string | null;
  country: string | null; // ISO 3166-1 alpha-2, e.g. "GB"
  region: string | null;
  city: string | null;
  userAgent: string | null;
};

function header(req: NextRequest, name: string): string | null {
  const value = req.headers.get(name)?.trim();
  return value ? value : null;
}

function decode(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getRequestContext(req: NextRequest): RequestContext {
  const forwarded = header(req, "x-forwarded-for")?.split(",")[0]?.trim() || null;
  return {
    ip: forwarded ?? header(req, "x-real-ip"),
    country: header(req, "x-vercel-ip-country"),
    region: header(req, "x-vercel-ip-country-region"),
    city: decode(header(req, "x-vercel-ip-city")),
    userAgent: header(req, "user-agent")?.slice(0, 500) ?? null,
  };
}
