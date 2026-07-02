import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

// Featured cars are refreshed periodically rather than on every request.
export const revalidate = 300;

type FeaturedAdvert = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | string | null;
  price: number | string | null;
  mileage: number | string | null;
  nearest_town: string | null;
  advert_photos?: Array<{ image_url: string | null; sort_order: number | null }>;
};

function capitaliseWords(str?: string | null) {
  if (!str) return "";
  return str
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function featuredTitle(ad: FeaturedAdvert) {
  const title = `${ad.year || ""} ${capitaliseWords(ad.make)} ${capitaliseWords(ad.model)}`.trim();
  return title || "Private car advert";
}

function firstPhotoUrl(ad: FeaturedAdvert): string | null {
  const photos = [...(ad.advert_photos ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  return photos[0]?.image_url ?? null;
}

// Fetch up to 6 most-recently-published adverts server-side, selecting only
// the public allowlist fields the browse API exposes (display fields +
// nearest_town + first photo). No postcode, coordinates, seller or payment
// fields are ever requested. Returns [] on any error so the section hides.
async function getFeaturedAdverts(): Promise<FeaturedAdvert[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  try {
    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase
      .from("adverts")
      .select(
        "id, make, model, year, price, mileage, nearest_town, " +
          "advert_photos(image_url, sort_order)"
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(6);

    if (error || !data) return [];
    return data as unknown as FeaturedAdvert[];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const featured = await getFeaturedAdverts();

  return (
    <main>
      {/* HERO */}
      <section className="home-hero">
        <p className="eyebrow home-eyebrow">Private cars. Private sellers. Privacy secured.</p>
        <h1 className="home-h1">
          Sell your car privately.<br />
          Keep your details <span className="home-private">private</span> too.
        </h1>
        <p className="home-hero-sub">
          Advertise until sold. Buyers message you through OwnerCars — your phone number, email and address are never shown to anyone.
        </p>
        <div className="home-hero-price">
          <span className="home-price-was">£24.99</span>
          <span className="home-price-now">£9.99</span>
        </div>
        <p className="home-price-note">Launch price — first 500 adverts only</p>
        <div className="home-hero-ctas">
          <Link className="home-btn home-btn-primary" href="/create-advert">Start for £9.99</Link>
          <Link className="home-btn home-btn-ghost" href="/browse">Browse private cars</Link>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="home-trust-strip">
        <div className="home-trust-inner">
          <div className="home-trust-item">
            <div className="home-trust-big">£9.99</div>
            <div className="home-trust-small">until sold — no renewals</div>
          </div>
          <div className="home-trust-item">
            <div className="home-trust-big">0%</div>
            <div className="home-trust-small">commission on your sale</div>
          </div>
          <div className="home-trust-item">
            <div className="home-trust-big">Zero</div>
            <div className="home-trust-small">personal details shown</div>
          </div>
          <div className="home-trust-item">
            <div className="home-trust-big">100%</div>
            <div className="home-trust-small">private sellers only</div>
          </div>
        </div>
      </section>

      {/* FEATURED CARS */}
      {featured.length > 0 && (
        <section className="home-cars-section">
          <div className="home-cars-heading">
            <h2>On the market now.</h2>
            <p>A few of the private cars currently listed on OwnerCars.</p>
          </div>
          <div className="home-cars-grid">
            {featured.map((ad) => {
              const title = featuredTitle(ad);
              const photo = firstPhotoUrl(ad);
              return (
                <Link className="home-car-card" href={`/advert/${ad.id}`} key={ad.id}>
                  {photo ? (
                    <img className="home-car-photo" src={photo} alt={title} />
                  ) : (
                    <div className="home-car-photo home-car-photo-empty" />
                  )}
                  <div className="home-car-body">
                    <h3 className="home-car-title">{title}</h3>
                    <p className="home-car-price">£{Number(ad.price).toLocaleString()}</p>
                    <p className="home-car-meta">{Number(ad.mileage).toLocaleString()} miles</p>
                    {ad.nearest_town && (
                      <p className="home-car-location">Near {ad.nearest_town}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="home-cars-footer">
            <Link className="home-cars-browse" href="/browse">
              Browse all private cars →
            </Link>
          </div>
        </section>
      )}

      {/* PRIVACY SPLIT */}
      <section className="home-split-section">
        <div className="home-split-heading">
          <h2>Masked isn&apos;t private.</h2>
          <p>Other marketplaces hide your number — until you return a call, reply to a text, or send a photo by WhatsApp. On OwnerCars there&apos;s no moment your details can leak, because buyers never leave the platform.</p>
        </div>
        <div className="home-split-grid">
          <div className="home-split-card home-split-them">
            <p className="home-split-label">Other marketplaces</p>
            <div className="home-split-row">
              <span className="home-split-icon">📞</span>
              <span>Phone number</span>
              <span className="home-split-val">Exposed when you reply</span>
            </div>
            <div className="home-split-row">
              <span className="home-split-icon">✉️</span>
              <span>Email address</span>
              <span className="home-split-val">Exposed when you reply</span>
            </div>
            <div className="home-split-row">
              <span className="home-split-icon">📄</span>
              <span>Documents</span>
              <span className="home-split-val">Sent by WhatsApp or email</span>
            </div>
            <div className="home-split-row">
              <span className="home-split-icon">👤</span>
              <span>Who&apos;s contacting you</span>
              <span className="home-split-val">Anonymous callers</span>
            </div>
          </div>
          <div className="home-split-card home-split-us">
            <p className="home-split-label">OwnerCars</p>
            <div className="home-split-row">
              <span className="home-split-icon">📞</span>
              <span>Phone number</span>
              <span className="home-split-val">Stays on-platform</span>
            </div>
            <div className="home-split-row">
              <span className="home-split-icon">✉️</span>
              <span>Email address</span>
              <span className="home-split-val">Stays on-platform</span>
            </div>
            <div className="home-split-row">
              <span className="home-split-icon">📄</span>
              <span>Documents</span>
              <span className="home-split-val">Secure Vault, shared on your terms</span>
            </div>
            <div className="home-split-row">
              <span className="home-split-icon">👤</span>
              <span>Who&apos;s contacting you</span>
              <span className="home-split-val">Registered buyers only</span>
            </div>
          </div>
        </div>
      </section>

      {/* DARK VAULT SECTION */}
      <section className="home-vault-section">
        <div className="home-vault-inner">
          <div className="home-vault-grid">
            <div>
              <p className="home-vault-eyebrow">Secure Vault</p>
              <h2>Your documents never leave OwnerCars.</h2>
              <p className="home-vault-lead">MOT certificate, service history, V5C — buyers request them, you decide who sees them. Buyers request them through the platform, and you decide who sees them.</p>
              <div className="home-vault-points">
                <div className="home-vault-point">
                  <span className="home-vault-dot">✓</span>
                  Buyers request one document at a time — you approve each share
                </div>
                <div className="home-vault-point">
                  <span className="home-vault-dot">✓</span>
                  Links expire after 15 minutes
                </div>
                <div className="home-vault-point">
                  <span className="home-vault-dot">✓</span>
                  Your documents are never sent by email or WhatsApp
                </div>
              </div>
            </div>
            <div className="home-vault-visual">
              <div className="home-vault-doc">
                <span className="home-vault-file">📄</span>
                <span className="home-vault-meta">
                  <div className="home-vault-name">MOT certificate</div>
                  <div className="home-vault-state">Shared with 1 buyer</div>
                </span>
                <span className="home-vault-lock">🔒</span>
              </div>
              <div className="home-vault-doc">
                <span className="home-vault-file">📋</span>
                <span className="home-vault-meta">
                  <div className="home-vault-name">Service history</div>
                  <div className="home-vault-state">2 requests pending your approval</div>
                </span>
                <span className="home-vault-lock">🔒</span>
              </div>
              <div className="home-vault-doc">
                <span className="home-vault-file">🪪</span>
                <span className="home-vault-meta">
                  <div className="home-vault-name">Redacted V5C</div>
                  <div className="home-vault-state">Private — not yet shared</div>
                </span>
                <span className="home-vault-lock">🔒</span>
              </div>
              <p className="home-vault-footnote">This only exists at OwnerCars.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="home-steps-section">
        <div className="home-steps-heading">
          <h2>Sold in three steps.</h2>
        </div>
        <div className="home-steps">
          <div className="home-step">
            <div className="home-step-num">1</div>
            <h3>Create your advert</h3>
            <p>Photos, price, history. Add your postcode — buyers only ever see your nearest town.</p>
          </div>
          <div className="home-step">
            <div className="home-step-num">2</div>
            <h3>Buyers message you here</h3>
            <p>All contact happens through OwnerCars. Phone numbers and emails are automatically blocked.</p>
          </div>
          <div className="home-step">
            <div className="home-step-num">3</div>
            <h3>Share documents safely</h3>
            <p>Approve vault requests one at a time. Meet, sell, done — your advert runs until the car is sold.</p>
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="home-cta-band">
        <h2>Your car. Your sale. Your privacy.</h2>
        <p>Advertise until sold for £9.99 — launch price for the first 500 adverts.</p>
        <Link className="home-btn home-cta-btn" href="/create-advert">Start for £9.99</Link>
      </section>

      {/* Mobile sticky CTA */}
      <div className="home-sticky-cta">
        <Link className="home-btn home-btn-primary" href="/create-advert">Start for £9.99</Link>
        <Link className="home-btn home-btn-ghost" href="/browse">Browse private cars</Link>
      </div>
    </main>
  );
}
