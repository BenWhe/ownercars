"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function BrowsePage() {
  const supabase = createClient();
  const [adverts, setAdverts] = useState<any[]>([]);
  const [message, setMessage] = useState("Loading cars...");

  useEffect(() => {
    async function fetchAdverts() {
      const { data, error } = await supabase
        .from("adverts")
        .select("*")
        .eq("status", "live")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
      } else {
        setAdverts(data || []);
        setMessage("");
      }
    }

    fetchAdverts();
  }, []);

  return (
    <main>
      <section className="browse-hero">
        <p className="eyebrow">Private cars only</p>
        <h1>Browse private cars</h1>
        <p>
          Search cars listed by private owners. Seller details stay protected and buyer messages go through OwnerCars.
        </p>
      </section>

      <section className="browse-search">
        <input type="text" placeholder="Make or model" />
        <input type="text" placeholder="Postcode" />
        <select defaultValue="Any price">
          <option>Any price</option>
          <option>Up to £5,000</option>
          <option>Up to £10,000</option>
          <option>Up to £20,000</option>
          <option>£20,000+</option>
        </select>
        <button type="button">Search</button>
      </section>

      <section className="listing-section">
        {message && <p>{message}</p>}

        {!message && adverts.length === 0 && (
          <p>No cars listed yet.</p>
        )}

{!message && (
  <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
    Showing {adverts.length} private car{adverts.length === 1 ? "" : "s"}
  </p>
)}

        <div className="listing-grid">
          {adverts.map((ad) => (
            <Link className="listing-card" href={`/advert/${ad.id}`} key={ad.id}>
              <div className="listing-photo"></div>

              <div className="listing-body">
                <div className="listing-topline">
                  <span className="seller-badge">Private seller</span>
                </div>

                <h2>{ad.title}</h2>
                <p className="listing-price">£{Number(ad.price).toLocaleString()}</p>

                <div className="listing-meta">
                  <span>{Number(ad.mileage).toLocaleString()} miles</span>
                  <span>OwnerCars protected contact</span>
                </div>

                <p className="listing-description">
                  {ad.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}