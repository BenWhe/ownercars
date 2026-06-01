"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CONTACT_REDACTION_NOTICE, redactContactDetails } from "@/lib/content/redaction";

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

function parseSearch(query: string) {
  const q = query.toLowerCase();

  const filters: any = {
    priceMax: null,
    fuelType: null,
    gearbox: null,
    bodyType: null,
    doors: null,
    seats: null,
  };

  const priceMatch =
    q.match(/under\s*£?\s*(\d+)/) ||
    q.match(/below\s*£?\s*(\d+)/) ||
    q.match(/up to\s*£?\s*(\d+)/);

  if (priceMatch) filters.priceMax = Number(priceMatch[1]);

  if (q.includes("petrol")) filters.fuelType = "Petrol";
  if (q.includes("diesel")) filters.fuelType = "Diesel";
  if (q.includes("electric") || q.includes("ev")) filters.fuelType = "Electric";
  if (q.includes("hybrid")) filters.fuelType = "Hybrid";

  if (q.includes("manual")) filters.gearbox = "Manual";
  if (q.includes("automatic") || q.includes("auto")) filters.gearbox = "Automatic";

  if (q.includes("suv") || q.includes("4x4")) filters.bodyType = "SUV";
  if (q.includes("hatchback")) filters.bodyType = "Hatchback";
  if (q.includes("saloon")) filters.bodyType = "Saloon";
  if (q.includes("estate")) filters.bodyType = "Estate";
  if (q.includes("coupe")) filters.bodyType = "Coupe";
  if (q.includes("convertible")) filters.bodyType = "Convertible";

  const doorMatch = q.match(/(\d+)\s*door/);
  if (doorMatch) filters.doors = Number(doorMatch[1]);

  const seatMatch = q.match(/(\d+)\s*seat/);
  if (seatMatch) filters.seats = Number(seatMatch[1]);

  return filters;
}

function BrowseContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [adverts, setAdverts] = useState<any[]>([]);
  const [message, setMessage] = useState("Loading cars...");

  useEffect(() => {
    async function fetchAdverts() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("adverts")
        .select("*, advert_photos(*)")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (error) {
        setMessage(error.message);
        return;
      }

      let filtered = data || [];

      if (query) {
        const filters = parseSearch(query);

        filtered = filtered.filter((ad: any) => {
          const searchableText = `
            ${ad.make || ""}
            ${ad.model || ""}
            ${ad.title || ""}
            ${ad.body_type || ""}
            ${ad.fuel_type || ""}
            ${ad.gearbox || ""}
            ${ad.description || ""}
          `.toLowerCase();

          if (filters.priceMax && Number(ad.price) > filters.priceMax) return false;
          if (filters.fuelType && ad.fuel_type !== filters.fuelType) return false;
          if (filters.gearbox && ad.gearbox !== filters.gearbox) return false;
          if (filters.bodyType && ad.body_type !== filters.bodyType) return false;
          if (filters.doors && Number(ad.doors) !== filters.doors) return false;
          if (filters.seats && Number(ad.seats) !== filters.seats) return false;

          const cleanedQuery = query
            .toLowerCase()
            .replace(/under\s*£?\s*\d+/g, "")
            .replace(/below\s*£?\s*\d+/g, "")
            .replace(/up to\s*£?\s*\d+/g, "")
            .replace(/petrol|diesel|electric|ev|hybrid/g, "")
            .replace(/manual|automatic|auto/g, "")
            .replace(/suv|4x4|hatchback|saloon|estate|coupe|convertible/g, "")
            .replace(/\d+\s*door/g, "")
            .replace(/\d+\s*seat/g, "")
            .trim();

          if (cleanedQuery && !searchableText.includes(cleanedQuery)) {
            return false;
          }

          return true;
        });
      }

      setAdverts(filtered);
      setMessage("");
    }

    fetchAdverts();
  }, [query]);

  return (
    <>
      <section className="browse-hero">
        <p className="eyebrow">Private cars only</p>
        <h1>Latest adverts</h1>
        <p>
          Search cars listed by private owners. Seller details stay protected and
          buyer messages go through OwnerCars.
        </p>
      </section>

      <section className="browse-search">
        <input type="text" placeholder='Try "diesel SUV under 15000"' />
        <button type="button">Search</button>
      </section>

      <section className="listing-section">
        {message && <p>{message}</p>}

        {!message && query && (
          <p className="interpreted-search">
            Showing results for: <strong>{query}</strong>
          </p>
        )}

        {!message && adverts.length === 0 && <p>No cars listed yet.</p>}

        {!message && (
          <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
            Showing {adverts.length} private car
            {adverts.length === 1 ? "" : "s"}
          </p>
        )}

        <div className="listing-grid">
          {adverts.map((ad: any) => {
            const displayTitle = advertDisplayTitle(ad);
            const safeDescription = redactContactDetails(ad.description);

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

                  <p className="listing-description">{safeDescription.text}</p>
                  {safeDescription.redacted && (
                    <p className="redaction-notice">{CONTACT_REDACTION_NOTICE}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}

export default function BrowsePage() {
  return (
    <main>
      <Suspense fallback={<p style={{ padding: "80px" }}>Loading cars...</p>}>
        <BrowseContent />
      </Suspense>
    </main>
  );
}