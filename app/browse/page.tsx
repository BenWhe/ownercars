"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  const title = `${ad.year || ""} ${capitaliseWords(ad.make)} ${capitaliseWords(
    ad.model
  )}`.trim();
  return title || ad.title || "Private car advert";
}

// Maps the price dropdown value to { minPrice?, maxPrice? } params
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

const EMPTY_FILTERS = { make: "", price: "", mileage: "", fuel: "" };

export default function BrowsePage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [makes, setMakes] = useState<string[]>([]);
  const [adverts, setAdverts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch distinct makes once on mount
  useEffect(() => {
    fetch("/api/browse?makes=1")
      .then((r) => r.json())
      .then((d) => setMakes(d.makes ?? []))
      .catch(() => {});
  }, []);

  // Re-fetch adverts whenever filters change
  useEffect(() => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (filters.make) params.set("make", filters.make);
    if (filters.mileage) params.set("maxMileage", filters.mileage);
    if (filters.fuel) params.set("fuelType", filters.fuel);

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
  }, [filters]);

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
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

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="browse-filters">
        <select
          value={filters.make}
          onChange={(e) => setFilters((f) => ({ ...f, make: e.target.value }))}
          aria-label="Filter by make"
        >
          <option value="">Any make</option>
          {makes.map((m) => (
            <option key={m} value={m}>
              {capitaliseWords(m)}
            </option>
          ))}
        </select>

        <select
          value={filters.price}
          onChange={(e) => setFilters((f) => ({ ...f, price: e.target.value }))}
          aria-label="Filter by price"
        >
          {PRICE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filters.mileage}
          onChange={(e) =>
            setFilters((f) => ({ ...f, mileage: e.target.value }))
          }
          aria-label="Filter by mileage"
        >
          {MILEAGE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filters.fuel}
          onChange={(e) => setFilters((f) => ({ ...f, fuel: e.target.value }))}
          aria-label="Filter by fuel type"
        >
          {FUEL_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            className="browse-filters-clear"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Listing grid ───────────────────────────────────────────────────── */}
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
              <Link
                className="listing-card"
                href={`/advert/${ad.id}`}
                key={ad.id}
              >
                {ad.advert_photos?.[0]?.image_url ? (
                  <img
                    className="listing-photo-img"
                    src={ad.advert_photos[0].image_url}
                    alt={displayTitle}
                  />
                ) : (
                  <div className="listing-photo"></div>
                )}

                <div className="listing-body">
                  <div className="listing-topline">
                    <span className="seller-badge">Private seller</span>
                  </div>

                  <h2>{displayTitle}</h2>

                  <p className="listing-price">
                    £{Number(ad.price).toLocaleString()}
                  </p>

                  <div className="listing-meta">
                    <span>{Number(ad.mileage).toLocaleString()} miles</span>
                    <span>OwnerCars protected contact</span>
                  </div>

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
