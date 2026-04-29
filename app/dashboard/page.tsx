"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const supabase = createClient();
  const [adverts, setAdverts] = useState<any[]>([]);
  const [message, setMessage] = useState("Loading your adverts...");

  useEffect(() => {
    async function fetchAdverts() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setMessage("You must be logged in to view your dashboard.");
        return;
      }

      const { data, error } = await supabase
        .from("adverts")
        .select("*")
        .eq("seller_id", user.id)
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
      <section className="dashboard-hero">
        <p className="eyebrow">Seller dashboard</p>
        <h1>Your adverts</h1>
        <p>Manage your private car adverts, view listings, and prepare for secure buyer messaging.</p>

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
              <div className="dashboard-photo"></div>

              <div className="dashboard-card-body">

                <div style={{ display: "flex", gap: "8px" }}>
                  <span className="seller-badge">Private seller</span>
                  <span className="status-badge">{ad.status}</span>
              </div>
                <h2>{ad.title}</h2>
                <p className="listing-price">£{Number(ad.price).toLocaleString()}</p>
                <p className="dashboard-meta">
                  {Number(ad.mileage).toLocaleString()} miles
                </p>

                <div className="dashboard-actions">
                  <Link href={`/advert/${ad.id}`}>View advert</Link>
                  <Link href={`/edit-advert/${ad.id}`}>Edit</Link>

                
                <button
                  onClick={async () => {
                    await supabase
                      .from("adverts")
                      .update({ status: "sold" })
                      .eq("id", ad.id);

                    window.location.reload();
                }}
              >
                Mark as sold
              </button>

                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}