"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DownloadForSaleCardButton } from "@/app/components/ForSaleCard";
import PromoteAdvertTools from "@/app/components/PromoteAdvertTools";
import { ADVERT_STATUS, sellerStatusLabel } from "@/lib/adverts/lifecycle";

type DashboardAdvert = {
  id: string;
  title: string | null;
  price: number | string | null;
  mileage: number | string | null;
  make: string | null;
  model: string | null;
  year: number | string | null;
  fuel_type: string | null;
  gearbox: string | null;
  colour: string | null;
  status: string | null;
  advert_photos?: Array<{ image_url: string | null }>;
};

export default function DashboardPage() {
  const [adverts, setAdverts] = useState<DashboardAdvert[]>([]);
  const [message, setMessage] = useState("Loading your adverts...");

  async function updateLifecycle(advertId: string, action: "pause" | "reactivate" | "sold") {
    setMessage("Updating advert...");

    const res = await fetch(`/api/adverts/${advertId}/lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    const result = await res.json();

    if (!res.ok) {
      setMessage(result.error || "Could not update advert.");
      return;
    }

    window.location.reload();
  }

  useEffect(() => {
    async function fetchAdverts() {
      const res = await fetch("/api/dashboard");

      if (res.status === 401) {
        setMessage("You must be logged in to view your dashboard.");
        return;
      }

      const result = await res.json();

      if (!res.ok) {
        setMessage(result.error || "Could not load adverts.");
        return;
      }

      setAdverts(result.adverts || []);
      setMessage("");
    }

    fetchAdverts();
  }, []);

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Seller dashboard</p>
        <h1>Your adverts</h1>
        <p>
          Manage your private car adverts, view listings, and prepare for secure
          buyer messaging.
        </p>

        <Link className="button primary" href="/create-advert">
          Create new advert
        </Link>
      </section>

      <section className="dashboard-section">
        {message && <p>{message}</p>}

        {!message && adverts.length === 0 && (
          <div className="empty-state">
            <h2>No adverts yet</h2>
            <p>Create your first advert and start building your OwnerCars listing.</p>
            <Link className="button primary" href="/create-advert">
              Create advert
            </Link>
          </div>
        )}

        <div className="dashboard-grid">
          {adverts.map((ad) => (
            <article className="dashboard-card" key={ad.id}>
              {ad.advert_photos?.[0]?.image_url ? (
                <img
                  className="dashboard-photo-img"
                  src={ad.advert_photos[0].image_url}
                  alt={ad.title || "OwnerCars advert"}
                />
              ) : (
                <div className="dashboard-photo"></div>
              )}

              <div className="dashboard-card-body">
                <div style={{ display: "flex", gap: "8px" }}>
                  <span className="seller-badge">Private seller</span>
                  <span className="status-badge">{sellerStatusLabel(ad.status)}</span>
                </div>

                <h2>{ad.title}</h2>

                <p className="listing-price">
                  £{Number(ad.price).toLocaleString()}
                </p>

                <p className="dashboard-meta">
                  {Number(ad.mileage).toLocaleString()} miles
                </p>

                <div className="dashboard-actions">
                  {ad.status === ADVERT_STATUS.PUBLISHED ? (
                    <Link href={`/advert/${ad.id}`}>View advert</Link>
                  ) : ad.status === ADVERT_STATUS.DRAFT || ad.status === ADVERT_STATUS.PENDING_PAYMENT ? (
                    <Link href={`/publish-advert/${ad.id}`}>Publish advert</Link>
                  ) : null}

                  <Link href={`/edit-advert/${ad.id}`}>Edit</Link>

                  {ad.status === ADVERT_STATUS.PUBLISHED && (
                    <>
                      <DownloadForSaleCardButton advert={ad} />
                      <button onClick={() => updateLifecycle(ad.id, "pause")}>
                        Pause
                      </button>
                    </>
                  )}

                  {ad.status === ADVERT_STATUS.PAUSED && (
                    <button onClick={() => updateLifecycle(ad.id, "reactivate")}>
                      Reactivate
                    </button>
                  )}

                  {ad.status !== ADVERT_STATUS.SOLD && (
                    <button onClick={() => updateLifecycle(ad.id, "sold")}>
                      Mark as sold
                    </button>
                  )}
                </div>

                <PromoteAdvertTools
                  advertId={ad.id}
                  title={ad.title || "OwnerCars advert"}
                  compact
                />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}