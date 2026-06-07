"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ExampleAdvertPlaceholder from "@/app/components/ExampleAdvertPlaceholder";

function capitaliseWords(str?: string) {
  if (!str) return "";
  return str
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function HomePage() {
  const [latestAdvert, setLatestAdvert] = useState<any>(null);

  useEffect(() => {
    async function fetchLatestAdvert() {
      const supabase = createClient();

      const { data } = await supabase
        .from("adverts")
        .select("*, advert_photos(*)")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setLatestAdvert(data);
    }

    fetchLatestAdvert();
  }, []);

  const latestTitle = latestAdvert
    ? [latestAdvert.year, capitaliseWords(latestAdvert.make), capitaliseWords(latestAdvert.model)]
        .filter(Boolean)
        .join(" ")
    : null;

  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">PRIVATE CARS. PRIVATE SELLERS. PRIVACY SECURED.</p>
          <h1>Sell your car privately. Keep your details private too.</h1>

          <span className="price-badge">🔒 Launch price — rising to £9.99</span>

          <h2 className="price-hero">
            <span className="price-old">£9.99</span>
            <span className="price-new">£2.50</span>
          </h2>

          <p className="hero-subtitle">
            Other platforms expose your phone number the moment you call a buyer back. Service history, MOT certificates, walk-around videos? Every other platform pushes you to WhatsApp. OwnerCars keeps everything on-platform — from first message to final paperwork.
          </p>

          <div className="hero-actions">
            <Link className="button primary" href="/create-advert">
              Start for £2.50
            </Link>
            <Link className="button secondary" href="/browse">
              Browse private cars
            </Link>
          </div>
        </div>

        <Link
          href={latestAdvert ? `/advert/${latestAdvert.id}` : "/browse"}
          className="hero-card latest-advert-card"
        >
          {latestAdvert?.advert_photos?.[0]?.image_url ? (
            <img
              className="hero-card-img"
              src={latestAdvert.advert_photos[0].image_url}
              alt={[latestAdvert.year, capitaliseWords(latestAdvert.make), capitaliseWords(latestAdvert.model)].filter(Boolean).join(" ")}
            />
          ) : latestAdvert?.is_example ? (
            <ExampleAdvertPlaceholder
              className="hero-card-img"
              style={{ borderRadius: "12px 12px 0 0" }}
            />
          ) : (
            <div className="mock-photo"></div>
          )}

          <div className="mock-listing">
            <span className="latest-badge">Latest advert</span>

            <p className="mock-title">
              {latestTitle || "Latest private advert"}
            </p>

            <p className="mock-price">
              {latestAdvert
                ? `£${Number(latestAdvert.price).toLocaleString()}`
                : "Browse live adverts"}
            </p>

            <p className="mock-meta">
              {latestAdvert
                ? `${Number(latestAdvert.mileage).toLocaleString()} miles`
                : "Private sellers only"}
            </p>
          </div>
        </Link>
      </section>

      <section className="trust-strip">
        <p>No phone number shown · No address exposed · Documents shared securely on-platform · No ongoing charges</p>
      </section>

      <section className="cards-section">
        <div className="section-heading">
          <p className="eyebrow">Why OwnerCars?</p>
          <h2>A marketplace built for private sellers</h2>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <h3>Your details, your rules</h3>
            <p>
              Your phone number, home address and vehicle registration are never shown publicly. Buyers message you through OwnerCars. You decide when — and to whom — you share anything further.
            </p>
          </article>

          <article className="feature-card">
            <h3>What this really means</h3>
            <p>
              When a buyer requests your service history or MOT certificate, we log it. A buyer repeatedly requesting documents from multiple sellers without purchasing gets flagged and acted upon. Document harvesting — one of the most common scams in private car sales — doesn&apos;t happen here. This only exists at OwnerCars.
            </p>
          </article>

          <article className="feature-card">
            <h3>One price. No surprises.</h3>
            <p>
              AutoTrader&apos;s Ultimate package costs £97.50. PistonHeads charges £34.99 every 30 days — over £100 if your car takes three months to sell. OwnerCars is £9.99, once, until your car sells. Six months or six days, the price is the same.
            </p>
          </article>

          <article className="feature-card feature-card--full">
            <h3>Private sellers only.</h3>
            <p>No dealers. No trade listings. Every car on OwnerCars is from a private individual — which means genuine buyers, not forecourt browsers.</p>
          </article>
        </div>
      </section>

      <section className="vault-teaser">
        <div className="section-heading">
          <p className="eyebrow">THE OWNERCARS SECURE VAULT</p>
          <h2>Share the details that matter — with the buyers who&apos;ve earned them</h2>
          <p>Service history, MOT certificates, V5C, walk-around video. Every other platform asks you to send these over WhatsApp to someone you&apos;ve never met. OwnerCars gives you a secure, on-platform vault. You control who sees what. Every access is logged. You can revoke it at any time. Your documents never leave OwnerCars.</p>
          <Link className="button primary" href="/seller-protection">See how the vault works</Link>
        </div>
      </section>

      <section className="protection-teaser">
        <div>
          <p className="eyebrow">Protected private selling</p>
          <h2>Sell your car without exposing your details too early</h2>
          <p>
            OwnerCars helps protect your phone number, address, vehicle
            registration and identity by keeping buyer communication on-platform
            and releasing sensitive information only when you choose.
          </p>
        </div>

        <Link className="button primary" href="/seller-protection">
          See how seller protection works
        </Link>
      </section>

      <section className="steps-section">
        <div className="section-heading">
          <p className="eyebrow">How it works</p>
          <h2>List your car in five simple steps</h2>
        </div>

        <div className="steps">
          <div>
            <span>1</span>
            <p>Create your seller account</p>
          </div>
          <div>
            <span>2</span>
            <p>Add vehicle details and description</p>
          </div>
          <div>
            <span>3</span>
            <p>Upload up to 10 photos</p>
          </div>
          <div>
            <span>4</span>
            <p>Pay £2.50 and publish instantly</p>
          </div>
          <div>
            <span>5</span>
            <p>Interact with buyers securely until sold</p>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <h2>Launch price: £2.50 until sold. Rising to £9.99.</h2>
        <p>Join the private sellers who are selling smarter.</p>
        <Link className="button light" href="/create-advert">
          Start your advert
        </Link>
      </section>
    </main>
  );
}
