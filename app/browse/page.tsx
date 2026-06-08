"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ExampleAdvertPlaceholder from "@/app/components/ExampleAdvertPlaceholder";

function capitaliseWords(str?: string) {
  if (!str) return "";
  return str
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function advertDisplayTitle(ad: any) {
  const title = `${ad.year || ""} ${capitaliseWords(ad.make)} ${capitaliseWords(ad.model)}`.trim();
  return title || ad.title || "Private car advert";
}

function priceParams(value: string): Record<string, string> {
  if (!value) return {};
  if (value === "over-20000") return { minPrice: "20000" };
  if (value.includes("-")) {
    const [min, max] = value.split("-");
    return { minPrice: min, maxPrice: max };
  }
  return { maxPrice: value };
}

const PRICE_OPTIONS = [
  { value: "", label: "Any price" },
  { value: "2000", label: "Under £2,000" },
  { value: "2000-5000", label: "£2,000–£5,000" },
  { value: "5000-10000", label: "£5,000–£10,000" },
  { value: "10000-20000", label: "£10,000–£20,000" },
  { value: "over-20000", label: "Over £20,000" },
];

const MILEAGE_OPTIONS = [
  { value: "", label: "Any mileage" },
  { value: "20000", label: "Under 20,000" },
  { value: "50000", label: "Under 50,000" },
  { value: "100000", label: "Under 100,000" },
];

const FUEL_OPTIONS = [
  { value: "", label: "Any fuel" },
  { value: "Petrol", label: "Petrol" },
  { value: "Diesel", label: "Diesel" },
  { value: "Electric", label: "Electric" },
  { value: "Hybrid", label: "Hybrid" },
];

const BODY_TYPE_OPTIONS = [
  { value: "", label: "Any body type" },
  { value: "Hatchback", label: "Hatchback" },
  { value: "Saloon", label: "Saloon" },
  { value: "SUV", label: "SUV" },
  { value: "Estate", label: "Estate" },
  { value: "Coupe", label: "Coupe" },
  { value: "Convertible", label: "Convertible" },
  { value: "MPV", label: "MPV" },
  { value: "Van", label: "Van" },
];

const COLOUR_OPTIONS = [
  { value: "", label: "Any colour" },
  { value: "Black", label: "Black" },
  { value: "White", label: "White" },
  { value: "Silver", label: "Silver" },
  { value: "Grey", label: "Grey" },
  { value: "Blue", label: "Blue" },
  { value: "Red", label: "Red" },
  { value: "Green", label: "Green" },
  { value: "Yellow", label: "Yellow" },
  { value: "Orange", label: "Orange" },
  { value: "Brown", label: "Brown" },
];

const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  { value: "", label: "Any year" },
  ...Array.from({ length: THIS_YEAR - 2000 + 1 }, (_, i) => {
    const year = THIS_YEAR - i;
    return { value: String(year), label: String(year) };
  }),
];

const EMPTY_FILTERS = {
  make: "",
  model: "",
  bodyType: "",
  fuel: "",
  price: "",
  mileage: "",
  colour: "",
  yearFrom: "",
};

export default function BrowsePage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [adverts, setAdverts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Buyer location state
  const [postcodeInput, setPostcodeInput] = useState("");
  const [buyerLat, setBuyerLat] = useState<number | null>(null);
  const [buyerLng, setBuyerLng] = useState<number | null>(null);
  const [buyerTown, setBuyerTown] = useState("");
  const [mounted, setMounted] = useState(false);
  const [postcodeError, setPostcodeError] = useState("");

  // DIAGNOSTIC — logs every render of postcode state
  console.log("[postcode render]", { mounted, postcodeInput, buyerTown });

  // On mount: try to load postcode from logged-in profile, then localStorage
  useEffect(() => {
    async function loadBuyerLocation() {
      const storedPostcode = localStorage.getItem("buyer_postcode") ?? "";
      const storedTown = localStorage.getItem("buyer_town") ?? "";
      console.log("[loadBuyerLocation] localStorage read:", { storedPostcode, storedTown });

      console.log("[loadBuyerLocation] calling setPostcodeInput:", storedPostcode);
      setPostcodeInput(storedPostcode);
      console.log("[loadBuyerLocation] calling setBuyerTown:", storedTown);
      setBuyerTown(storedTown);
      console.log("[loadBuyerLocation] calling setMounted(true)");
      setMounted(true);

      // Try profile first
      console.log("[loadBuyerLocation] awaiting /api/account...");
      const accountRes = await fetch("/api/account");
      console.log("[loadBuyerLocation] /api/account response ok:", accountRes.ok);
      if (accountRes.ok) {
        const accountResult = await accountRes.json();
        console.log("[loadBuyerLocation] profile from API:", accountResult.profile);
        if (accountResult.profile?.latitude && accountResult.profile?.longitude) {
          console.log("[loadBuyerLocation] profile has lat/lng — calling setPostcodeInput:", accountResult.profile.postcode ?? "");
          setBuyerLat(accountResult.profile.latitude);
          setBuyerLng(accountResult.profile.longitude);
          setPostcodeInput(accountResult.profile.postcode ?? "");
          const storedTown2 = localStorage.getItem("buyer_town") ?? "";
          console.log("[loadBuyerLocation] storedTown2 for geocode check:", storedTown2);
          if (!storedTown2 && accountResult.profile.postcode) {
            console.log("[loadBuyerLocation] no stored town, geocoding profile postcode...");
            const geoRes = await fetch(`/api/geocode?postcode=${encodeURIComponent(accountResult.profile.postcode)}`);
            if (geoRes.ok) {
              const geoResult = await geoRes.json();
              console.log("[loadBuyerLocation] geocode result nearest_town:", geoResult.nearest_town);
              setBuyerTown(geoResult.nearest_town ?? "");
              localStorage.setItem("buyer_town", geoResult.nearest_town ?? "");
            }
          }
          console.log("[loadBuyerLocation] returning from profile path");
          return;
        }
      }
      // Fall back to localStorage
      const stored = localStorage.getItem("buyer_postcode");
      console.log("[loadBuyerLocation] localStorage fallback path, stored:", stored);
      if (stored) {
        console.log("[loadBuyerLocation] fallback: calling setPostcodeInput:", stored);
        setPostcodeInput(stored);
        const storedTown3 = localStorage.getItem("buyer_town") ?? "";
        console.log("[loadBuyerLocation] fallback: calling setBuyerTown:", storedTown3);
        setBuyerTown(storedTown3);
        console.log("[loadBuyerLocation] fallback: geocoding for lat/lng...");
        const geoRes = await fetch(`/api/geocode?postcode=${encodeURIComponent(stored)}`);
        if (geoRes.ok) {
          const geoResult = await geoRes.json();
          console.log("[loadBuyerLocation] fallback: geocode lat/lng:", geoResult.latitude, geoResult.longitude);
          setBuyerLat(geoResult.latitude);
          setBuyerLng(geoResult.longitude);
        }
      }
    }
    loadBuyerLocation();
  }, []);

  useEffect(() => {
    fetch("/api/browse?makes=1")
      .then((r) => r.json())
      .then((d) => setMakes(d.makes ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!filters.make) {
      setModels([]);
      return;
    }
    fetch(`/api/browse?models=1&make=${encodeURIComponent(filters.make)}`)
      .then((r) => r.json())
      .then((d) => setModels(d.models ?? []))
      .catch(() => setModels([]));
  }, [filters.make]);

  useEffect(() => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (filters.make) params.set("make", filters.make);
    if (filters.model) params.set("model", filters.model);
    if (filters.bodyType) params.set("bodyType", filters.bodyType);
    if (filters.fuel) params.set("fuelType", filters.fuel);
    if (filters.mileage) params.set("maxMileage", filters.mileage);
    if (filters.colour) params.set("colour", filters.colour);
    if (filters.yearFrom) params.set("minYear", filters.yearFrom);
    if (buyerLat !== null) params.set("buyer_lat", String(buyerLat));
    if (buyerLng !== null) params.set("buyer_lng", String(buyerLng));

    const pp = priceParams(filters.price);
    Object.entries(pp).forEach(([k, v]) => params.set(k, v));

    fetch(`/api/browse?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setAdverts(d.adverts ?? []);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load adverts.");
        setLoading(false);
      });
  }, [filters, buyerLat, buyerLng]);

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  async function handleSetPostcode(e: React.FormEvent) {
    e.preventDefault();
    setPostcodeError("");

    const trimmed = postcodeInput.trim();
    if (!trimmed) return;

    const geoRes = await fetch(`/api/geocode?postcode=${encodeURIComponent(trimmed)}`);
    const geoResult = await geoRes.json();

    if (!geoRes.ok) {
      setPostcodeError("Invalid postcode.");
      return;
    }

    setBuyerLat(geoResult.latitude);
    setBuyerLng(geoResult.longitude);
    setBuyerTown(geoResult.nearest_town ?? "");
    setPostcodeInput(geoResult.postcode);
    localStorage.setItem("buyer_postcode", geoResult.postcode);
    localStorage.setItem("buyer_town", geoResult.nearest_town ?? "");

    // Save to profile if logged in
    try {
      const accountRes = await fetch("/api/account");
      if (accountRes.ok) {
        const accountResult = await accountRes.json();
        if (accountResult.user) {
          await fetch("/api/account", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postcode: geoResult.postcode,
              latitude: geoResult.latitude,
              longitude: geoResult.longitude,
            }),
          });
        }
      }
    } catch {
      // Non-blocking
    }
  }

  function clearPostcode() {
    setBuyerLat(null);
    setBuyerLng(null);
    setBuyerTown("");
    setPostcodeInput("");
    localStorage.removeItem("buyer_postcode");
    localStorage.removeItem("buyer_town");
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <main>
      <section className="browse-hero">
        <p className="eyebrow">Private cars only</p>
        <h1>Latest adverts</h1>
        <p>
          Filter cars listed by private owners. Seller details stay protected
          and buyer messages go through OwnerCars.
        </p>
      </section>

      <div className="browse-filters">
        {/* Make */}
        <select
          value={filters.make}
          onChange={(e) => setFilters((f) => ({ ...f, make: e.target.value, model: "" }))}
          aria-label="Filter by make"
        >
          <option value="">Any make</option>
          {makes.map((m) => (
            <option key={m} value={m}>{capitaliseWords(m)}</option>
          ))}
        </select>

        {/* Model */}
        <select
          value={filters.model}
          onChange={(e) => setFilters((f) => ({ ...f, model: e.target.value }))}
          disabled={!filters.make}
          aria-label="Filter by model"
        >
          {!filters.make ? (
            <option value="">Select a make first</option>
          ) : (
            <>
              <option value="">Any model</option>
              {models.map((m) => (
                <option key={m} value={m}>{capitaliseWords(m)}</option>
              ))}
            </>
          )}
        </select>

        <select value={filters.bodyType} onChange={(e) => setFilters((f) => ({ ...f, bodyType: e.target.value }))} aria-label="Filter by body type">
          {BODY_TYPE_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>

        <select value={filters.fuel} onChange={(e) => setFilters((f) => ({ ...f, fuel: e.target.value }))} aria-label="Filter by fuel type">
          {FUEL_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>

        <select value={filters.price} onChange={(e) => setFilters((f) => ({ ...f, price: e.target.value }))} aria-label="Filter by price">
          {PRICE_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>

        <select value={filters.mileage} onChange={(e) => setFilters((f) => ({ ...f, mileage: e.target.value }))} aria-label="Filter by mileage">
          {MILEAGE_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>

        <select value={filters.colour} onChange={(e) => setFilters((f) => ({ ...f, colour: e.target.value }))} aria-label="Filter by colour">
          {COLOUR_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>

        <select value={filters.yearFrom} onChange={(e) => setFilters((f) => ({ ...f, yearFrom: e.target.value }))} aria-label="Filter by year from">
          {YEAR_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>

        {/* Postcode / location — only render after client has read localStorage */}
        {/* DIAGNOSTIC */ console.log("[postcode JSX]", { mounted, postcodeInput, buyerTown, rendering: mounted ? (buyerTown ? "chip" : "input") : "hidden" })}
        {mounted && (
          buyerTown ? (
            <button type="button" className="browse-postcode-active" onClick={clearPostcode}>
              Near {buyerTown} ✕
            </button>
          ) : (
            <form onSubmit={handleSetPostcode} style={{ display: "contents" }}>
              <input
                type="text"
                className="browse-postcode-input"
                placeholder="Your postcode"
                value={postcodeInput}
                onChange={(e) => { setPostcodeInput(e.target.value); setPostcodeError(""); }}
                maxLength={8}
                aria-label="Your postcode for distance"
              />
              <button type="submit" className="browse-postcode-set">Set</button>
            </form>
          )
        )}

        {hasActiveFilters && (
          <button type="button" className="browse-filters-clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {postcodeError && (
        <p style={{ color: "#dc2626", fontSize: "13px", margin: "4px 0 0 24px" }}>{postcodeError}</p>
      )}

      <section className="listing-section">
        {loading && <p>Loading cars…</p>}
        {!loading && error && <p>{error}</p>}

        {!loading && !error && adverts.length === 0 && (
          <p>No adverts match your filters.</p>
        )}

        {!loading && !error && adverts.length > 0 && (
          <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
            Showing {adverts.length} private car{adverts.length === 1 ? "" : "s"}
          </p>
        )}

        <div className="listing-grid">
          {adverts.map((ad: any) => {
            const displayTitle = advertDisplayTitle(ad);

            return (
              <Link className="listing-card" href={`/advert/${ad.id}`} key={ad.id}>
                {ad.advert_photos?.[0]?.image_url ? (
                  <img className="listing-photo-img" src={ad.advert_photos[0].image_url} alt={displayTitle} />
                ) : ad.is_example ? (
                  <ExampleAdvertPlaceholder className="listing-photo" />
                ) : (
                  <div className="listing-photo"></div>
                )}

                <div className="listing-body">
                  <div className="listing-topline">
                    <span className="seller-badge">Private seller</span>
                    {ad.is_example && <span className="example-badge">Example listing</span>}
                  </div>

                  <h2>{displayTitle}</h2>

                  <p className="listing-price">£{Number(ad.price).toLocaleString()}</p>

                  <div className="listing-meta">
                    <span>{Number(ad.mileage).toLocaleString()} miles</span>
                    <span>OwnerCars protected contact</span>
                  </div>

                  {(ad.nearest_town || ad.distance_miles !== undefined) && (
                    <p className="listing-location">
                      {ad.nearest_town && `Near ${ad.nearest_town}`}
                      {ad.nearest_town && ad.distance_miles !== undefined && " · "}
                      {ad.distance_miles !== undefined && `~${ad.distance_miles} miles away`}
                    </p>
                  )}

                  <p className="listing-description">{ad.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
