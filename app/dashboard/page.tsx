"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DownloadForSaleCardButton } from "@/app/components/ForSaleCard";
import PromoteAdvertTools from "@/app/components/PromoteAdvertTools";
import ExampleAdvertPlaceholder from "@/app/components/ExampleAdvertPlaceholder";
import { ADVERT_STATUS, sellerStatusLabel } from "@/lib/adverts/lifecycle";

function statusVariant(status: string | null): string {
  if (status === ADVERT_STATUS.PUBLISHED) return "published";
  if (status === ADVERT_STATUS.PAUSED) return "paused";
  return "muted";
}

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
  is_example?: boolean | null;
  advert_photos?: Array<{ image_url: string | null }>;
};

export default function DashboardPage() {
  const [adverts, setAdverts] = useState<DashboardAdvert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
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
      setUnreadCount(result.unreadCount || 0);
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

        {unreadCount > 0 && (
          <Link className="dashboard-message-alert" href="/messages">
            You have {unreadCount} unread message{unreadCount === 1 ? "" : "s"}
          </Link>
        )}
      </section>

      <section className="dashboard-section">
        {message && <p>{message}</p>}

        {adverts.some((ad) => ad.status === ADVERT_STATUS.PUBLISHED) && (
          <Link className="dashboard-guide-link" href="/seller-guide">
            Get the most from your advert →
          </Link>
        )}

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
              <div className="dashboard-photo-wrap">
                {ad.advert_photos?.[0]?.image_url ? (
                  <img
                    className="dashboard-photo-img"
                    src={ad.advert_photos[0].image_url}
                    alt={ad.title || "OwnerCars advert"}
                  />
                ) : ad.is_example ? (
                  <ExampleAdvertPlaceholder className="dashboard-photo" />
                ) : (
                  <div className="dashboard-photo"></div>
                )}
                <span className={`status-badge status-badge--${statusVariant(ad.status)}`}>
                  {sellerStatusLabel(ad.status)}
                </span>
              </div>

              <div className="dashboard-card-body">
                <h2>{[ad.year, ad.make, ad.model].filter(Boolean).map(s => String(s).charAt(0).toUpperCase() + String(s).slice(1)).join(' ') || ad.title || 'Untitled advert'}</h2>

                <p className="listing-price">
                  £{Number(ad.price).toLocaleString()}
                </p>

                <p className="dashboard-meta">
                  {[
                    ad.mileage ? `${Number(ad.mileage).toLocaleString()} miles` : null,
                    ad.fuel_type,
                    ad.gearbox,
                  ].filter(Boolean).join(" · ")}
                </p>

                <div className="dashboard-actions-primary">
                  {ad.status === ADVERT_STATUS.PUBLISHED ? (
                    <Link className="dashboard-cta" href={`/advert/${ad.id}`}>View advert</Link>
                  ) : ad.status === ADVERT_STATUS.DRAFT || ad.status === ADVERT_STATUS.PENDING_PAYMENT ? (
                    <Link className="dashboard-cta" href={`/publish-advert/${ad.id}`}>Publish advert</Link>
                  ) : null}
                </div>

                <div className="dashboard-actions">
                  <Link href={`/edit-advert/${ad.id}`}>Edit</Link>

                  {ad.status === ADVERT_STATUS.PUBLISHED && (
                    <button onClick={() => updateLifecycle(ad.id, "pause")}>
                      Pause
                    </button>
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

                  {ad.status === ADVERT_STATUS.PUBLISHED && (
                    <DownloadForSaleCardButton advert={ad} />
                  )}
                </div>

                <div className="dashboard-promote-wrap">
                  <PromoteAdvertTools
                    advertId={ad.id}
                    title={ad.title || "OwnerCars advert"}
                    compact
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}