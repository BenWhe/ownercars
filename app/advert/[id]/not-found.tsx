"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

// Shown with a 404 status for adverts that are draft, paused, sold or don't
// exist. Keeps the links the old client-side "unavailable" screen offered.
export default function AdvertNotFound() {
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === "string" ? params.id : null;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Advert unavailable</p>
        <h1>This advert isn&rsquo;t live</h1>
        <p className="auth-sub">
          It may have sold, been paused, or not been published yet.
        </p>

        <div style={{ display: "grid", gap: "10px", marginTop: "20px" }}>
          <Link href="/browse" className="auth-secondary-link">
            Browse cars for sale
          </Link>

          {id && (
            <Link href={`/publish-advert/${id}`} className="auth-secondary-link">
              Continue publishing
            </Link>
          )}

          <Link href="/dashboard" className="auth-secondary-link">
            Go to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
