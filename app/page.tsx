"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function capitaliseWords(str?: string) {
  if (!str) return "";
  return str
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function HomePage() {

  const supabase = createClient();
const [latestAdvert, setLatestAdvert] = useState<any>(null);

const [searchTerm, setSearchTerm] = useState("");

useEffect(() => {
  async function fetchLatestAdvert() {
    const { data } = await supabase
      .from("adverts")
      .select("*, advert_photos(*)")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLatestAdvert(data);
  }

  fetchLatestAdvert();
}, []);



  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Private cars. Private sellers. One simple price.</p>
          <h1>Sell your car privately for less</h1>

          <span className="price-badge">Launch offer</span>

          <h2 className="price-hero">
  <span className="price-old">£9.99</span>
  <span className="price-new">£2.50</span>
</h2>
          <p className="hero-subtitle">
            Launch offer: advertise until sold for £2.50, create advert and interact with buyers through the platform to keep your phone number and email safe.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/create-advert">Start for £2.50</Link>
            <Link className="button secondary" href="/browse">Browse private cars</Link>
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
      alt={latestAdvert.title}
    />
  ) : (
    <div className="mock-photo"></div>
  )}

  <div className="mock-listing">
  <span className="latest-badge">Latest advert</span>

  <p className="mock-title">
  {latestAdvert
    ? `${latestAdvert.year} ${capitaliseWords(latestAdvert.make)} ${capitaliseWords(latestAdvert.model)}`
    : "Latest private advert"}
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

<section className="protection-teaser">
  <div>
    <p className="eyebrow">Protected private selling</p>
    <h2>Sell your car without exposing your details too early</h2>
    <p>
      OwnerCars helps protect your phone number, address, vehicle registration
      and identity by keeping buyer communication on-platform and releasing
      sensitive information only when you choose.
    </p>
  </div>

  <Link className="button primary" href="/seller-protection">
    See how seller protection works
  </Link>
</section>

      <section className="search-panel">
  <div className="search-panel-inner">
    <div className="search-panel-copy">
      <p className="eyebrow">Search your way</p>
      <h2>Find cars using natural language</h2>
      <p className="search-helper">
        Try “diesel SUV under 15000”, “5 doors petrol”, or “manual Porsche”.
      </p>
    </div>

    <form
      className="search-form"
      onSubmit={(e) => {
        e.preventDefault();

        const params = new URLSearchParams();
        if (searchTerm) params.set("q", searchTerm);

        router.push(`/browse?${params.toString()}`);
      }}
    >
      <input
        type="text"
        placeholder='Try "diesel SUV under 15000"'
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <button type="submit">Search</button>
    </form>
  </div>
</section>

      <section className="cards-section">
        <div className="section-heading">
          <p className="eyebrow">Why OwnerCars?</p>
          <h2>A marketplace built for private sellers</h2>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <h3>£9.99 fixed price</h3>
            <p>One simple advert price. No upgrade pressure or complicated package choices.</p>
          </article>
          <article className="feature-card">
            <h3>Advertise until sold</h3>
            <p>Your advert stays live while the car is available, with periodic checks to keep listings fresh.</p>
          </article>
          <article className="feature-card">
            <h3>Contact details protected</h3>
            <p>Buyer enquiries are handled through the platform so sellers do not need to expose their email or phone number.</p>
          </article>
        </div>
      </section>

      <section className="steps-section">
        <div className="section-heading">
          <p className="eyebrow">How it works</p>
          <h2>List your car in five simple steps</h2>
        </div>

        <div className="steps">
          <div><span>1</span><p>Create your seller account</p></div>
          <div><span>2</span><p>Add vehicle details and description</p></div>
          <div><span>3</span><p>Upload up to 10 photos</p></div>
          <div><span>4</span><p>Pay £9.99 and submit for approval</p></div>
          <div><span>5</span><p>Interact with buyers securely until sold</p></div>
        </div>
      </section>

      <section className="cta-band">
        <h2>Ready to sell your car privately?</h2>
        <p>Create your advert for £9.99 and keep your seller details protected.</p>
        <Link className="button light" href="/create-advert">Start your advert</Link>
      </section>
    </main>
  );
}