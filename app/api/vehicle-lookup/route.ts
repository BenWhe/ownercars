import { NextRequest, NextResponse } from "next/server";
import {
  lookupVehicle,
  MotNotFoundError,
  MotApiError,
} from "@/lib/mot/client";

// ── Per-IP rate limit (soft) ──────────────────────────────────────────────────
// In-memory sliding window: ~10 lookups per minute per IP. This is per server
// instance, so it's a guard against accidental hammering rather than a hard
// global limit — adequate for a public lookup endpoint with no auth.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

/** Map DVSA's fuel descriptions onto the advert form's select options. */
function normaliseFuel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.includes("electric") && !v.includes("hybrid")) return "Electric";
  if (v.includes("hybrid")) return "Hybrid";
  if (v.includes("diesel")) return "Diesel";
  if (v.includes("petrol")) return "Petrol";
  return null;
}

/** Pull a 4-digit year from the first usable date field. */
function deriveYear(record: any): number | null {
  const candidates = [
    record?.manufactureDate,
    record?.firstUsedDate,
    record?.registrationDate,
  ];
  for (const d of candidates) {
    if (typeof d === "string") {
      const match = d.match(/\d{4}/);
      if (match) return Number(match[0]);
    }
  }
  return null;
}

/**
 * Most recent genuine odometer reading from the MOT history.
 * Only returns a value when odometerResultType indicates a real reading —
 * "NO_ODOMETER" / unreadable results are skipped.
 */
function deriveLastMileage(
  record: any
): { value: number; unit: string } | null {
  const tests = Array.isArray(record?.motTests) ? [...record.motTests] : [];
  tests.sort((a, b) => {
    const da = new Date(a?.completedDate ?? 0).getTime();
    const db = new Date(b?.completedDate ?? 0).getTime();
    return db - da;
  });

  for (const test of tests) {
    const resultType = String(test?.odometerResultType ?? "").toUpperCase();
    const value = Number(test?.odometerValue);
    if (resultType === "READ" && Number.isFinite(value) && value > 0) {
      return { value, unit: test?.odometerUnit || "mi" };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many lookups. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  let body: { registration?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const registration = (body.registration ?? "").trim();
  if (!registration) {
    return NextResponse.json(
      { error: "Enter a registration." },
      { status: 400 }
    );
  }

  let record: any;
  try {
    record = await lookupVehicle(registration);
  } catch (err) {
    if (err instanceof MotNotFoundError) {
      // 404 from DVSA → not found, but a successful request (HTTP 200 to client)
      return NextResponse.json({ found: false });
    }
    if (err instanceof MotApiError) {
      return NextResponse.json(
        {
          error:
            "We couldn't look up that registration right now. You can enter the details manually below.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      {
        error:
          "We couldn't look up that registration right now. You can enter the details manually below.",
      },
      { status: 502 }
    );
  }

  // CLEAN derived payload only. The raw record (including motTests) is never
  // returned to the client — it is re-fetched and persisted server-side at
  // draft creation.
  return NextResponse.json({
    found: true,
    make: record?.make ?? null,
    model: record?.model ?? null,
    year: deriveYear(record),
    fuelType: normaliseFuel(record?.fuelType),
    colour: record?.primaryColour ?? null,
    engineSize: record?.engineSize ? String(record.engineSize) : null,
    lastMileage: deriveLastMileage(record),
  });
}
