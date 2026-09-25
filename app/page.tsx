import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { LAUNCH_FREE_LISTING } from "@/lib/payments/config";
import HeroSearch from "@/app/components/HeroSearch";
import { PRICE_OPTIONS } from "@/lib/vehicles/filters";

// Featured cars are refreshed periodically rather than on every request.
export const revalidate = 300;

const MAX_CARS = 7;

type FeaturedAdvert = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | string | null;
  price: number | string | null;
  mileage: number | string | null;
  nearest_town: string | null;
  fuel_type: string | null;
  gearbox: string | null;
  body_type: string | null;
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

function specChips(ad: FeaturedAdvert): string[] {
  const chips: string[] = [];
  if (ad.mileage !== null && ad.mileage !== undefined && ad.mileage !== "" && !Number.isNaN(Number(ad.mileage))) {
    chips.push(`${Number(ad.mileage).toLocaleString()} miles`);
  }
  if (ad.fuel_type?.trim()) chips.push(capitaliseWords(ad.fuel_type));
  if (ad.gearbox?.trim()) chips.push(capitaliseWords(ad.gearbox));
  if (ad.body_type?.trim()) chips.push(capitaliseWords(ad.body_type));
  return chips;
}

// Explicit allowlist of public columns — no select("*"), and no latitude or
// longitude. Returns [] on any error so the grid falls back to the sell tile.
const FEATURED_SELECT =
  "id, make, model, year, price, mileage, nearest_town, fuel_type, gearbox, body_type, " +
  "advert_photos(image_url, sort_order)";

async function getFeaturedAdverts(): Promise<FeaturedAdvert[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  try {
    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase
      .from("adverts")
      .select(FEATURED_SELECT)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(MAX_CARS);

    if (error || !data) return [];
    return data as unknown as FeaturedAdvert[];
  } catch {
    return [];
  }
}

// Distinct makes of published adverts (make column only), merged into the
// hero search's make list so a make that exists in adverts always appears.
async function getLiveMakes(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  try {
    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase
      .from("adverts")
      .select("make")
      .eq("status", "published")
      .not("make", "is", null);

    if (error || !data) return [];
    return [
      ...new Set(
        data.map((r: { make: string | null }) => r.make?.trim()).filter(Boolean) as string[]
      ),
    ];
  } catch {
    return [];
  }
}

// Values are the exact ones /browse reads from the URL (price bands come from
// the shared option list; body types and fuel match /browse's own options).
const SHORTCUTS: { label: string; href: string }[] = [
  ...PRICE_OPTIONS.filter((o) => o.value).map((o) => ({
    label: o.label,
    href: `/browse?price=${o.value}`,
  })),
  { label: "Convertibles", href: "/browse?bodyType=Convertible" },
  { label: "Coupés", href: "/browse?bodyType=Coupe" },
  { label: "Estates", href: "/browse?bodyType=Estate" },
  { label: "SUVs", href: "/browse?bodyType=SUV" },
  { label: "Electric", href: "/browse?fuel=Electric" },
];

const GUIDES: { title: string; text: string; href: string }[] = [
  {
    title: "Car selling scams",
    text: "The seven messages private sellers get most often, and what they really mean.",
    href: "/car-selling-scams",
  },
  {
    title: "Safety advice",
    text: "Viewings, test drives and payment: how to sell safely.",
    href: "/safety-advice",
  },
  {
    title: "Seller guide",
    text: "Six steps: photos, seller's note, Secure Vault, For Sale card, prompt replies, marking sold.",
    href: "/seller-guide",
  },
  {
    title: "How it works",
    text: "Five steps: create your advert, add photos, publish, interact securely, mark it sold.",
    href: "/how-it-works",
  },
];

export default async function HomePage() {
  const [featured, liveMakes] = await Promise.all([getFeaturedAdverts(), getLiveMakes()]);

  return (
    <main>
      {/* HERO */}
      <section className="mk-hero">
        <div className="mk-hero-media">
          <Image
            className="mk-hero-img"
            src="/hero/hero-car.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
          />
          <div className="mk-hero-overlay" aria-hidden="true" />
        </div>
        <div className="mk-container mk-hero-inner">
          <p className="mk-eyebrow">Now launching across the South West</p>
          <h1 className="mk-hero-h1">Buy and sell cars privately</h1>
          <p className="mk-hero-sub">
            Private sellers only. Phone numbers, emails and addresses are never shown.
          </p>
          <HeroSearch liveMakes={liveMakes} />
        </div>
      </section>

      {/* LATEST CARS */}
      <section className="mk-latest">
        <div className="mk-container">
          <div className="mk-section-head">
            <h2>Latest cars for sale</h2>
            <Link className="mk-link" href="/browse">View all cars →</Link>
          </div>
          <div className="mk-grid">
            {featured.map((ad) => {
              const title = featuredTitle(ad);
              const photo = firstPhotoUrl(ad);
              const chips = specChips(ad);
              return (
                <Link className="mk-card" href={`/advert/${ad.id}`} key={ad.id}>
                  <div className="mk-card-photo">
                    {photo && <img src={photo} alt={title} loading="lazy" />}
                  </div>
                  <div className="mk-card-body">
                    <span className="mk-card-seller">Private seller</span>
                    <h3 className="mk-card-title">{title}</h3>
                    <p className="mk-card-price">£{Number(ad.price).toLocaleString()}</p>
                    {chips.length > 0 && (
                      <ul className="mk-chips">
                        {chips.map((chip) => (
                          <li key={chip}>{chip}</li>
                        ))}
                      </ul>
                    )}
                    {ad.nearest_town && <p className="mk-card-loc">Near {ad.nearest_town}</p>}
                  </div>
                </Link>
              );
            })}

            <div className="mk-sell-tile">
              <h3>Your car here</h3>
              <p>
                {LAUNCH_FREE_LISTING
                  ? "Free to list during launch. Your number is never shown."
                  : "Your number is never shown."}
              </p>
              <Link className="mk-btn mk-btn-white" href="/create-advert">
                {LAUNCH_FREE_LISTING ? "List your car free" : "Start your advert"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* BROWSE SHORTCUTS */}
      <section className="mk-shortcuts">
        <div className="mk-container">
          <h2>Browse by budget and body type</h2>
          <div className="mk-pills">
            {SHORTCUTS.map((s) => (
              <Link className="mk-pill" href={s.href} key={s.href}>
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* WHY SELL ON OWNERCARS */}
      <section className="mk-why">
        <div className="mk-container">
          <h2>Why sell on OwnerCars</h2>
          <div className="mk-why-grid">
            <div>
              <h3>Your number stays private.</h3>
              <p>Phone numbers, emails and addresses are never shown on adverts.</p>
            </div>
            <div>
              <h3>Messages stay here.</h3>
              <p>Buyers need an account and message you through OwnerCars.</p>
            </div>
            <div>
              <h3>Documents on your terms.</h3>
              <p>Share your MOT and service history from a secure vault, one buyer at a time.</p>
            </div>
          </div>
          <p className="mk-why-evidence">
            1 in 5 people selling on second-hand marketplaces has experienced a scam.{" "}
            <a
              href="https://www.which.co.uk/policy-and-insight/article/a-third-of-buyers-have-experienced-a-scam-on-popular-second-hand-marketplaces-in-the-last-two-years-which-warns-aEea68N4nnah"
              target="_blank"
              rel="noopener noreferrer"
            >
              Which?, 2024
            </a>
            .
          </p>
          <Link className="mk-link" href="/seller-protection">
            How OwnerCars protects you →
          </Link>
        </div>
      </section>

      {/* PRIVACY SPLIT */}
      <section className="home-split-section mk-section">
        <div className="home-split-heading mk-left">
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
              <span className="home-split-val">Account holders only</span>
            </div>
          </div>
        </div>
      </section>

      {/* DARK VAULT SECTION */}
      <section className="home-vault-section">
        <div className="home-vault-inner mk-vault-inner">
          <div className="home-vault-grid">
            <div>
              <p className="home-vault-eyebrow">Secure Vault</p>
              <h2>Your documents never leave OwnerCars.</h2>
              <p className="home-vault-lead">MOT certificate, service history, V5C — buyers request them through the platform, and you decide who sees each one.</p>
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
              <p className="home-vault-footnote">Built into every OwnerCars advert.</p>
            </div>
          </div>
        </div>
      </section>

      {/* GUIDES AND ADVICE */}
      <section className="mk-guides">
        <div className="mk-container">
          <h2>Guides and advice</h2>
          <div className="mk-guide-grid">
            {GUIDES.map((g) => (
              <Link className="mk-guide" href={g.href} key={g.href}>
                <h3>{g.title}</h3>
                <p>{g.text}</p>
                <span className="mk-link">Read more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="home-cta-band mk-cta-left">
        <h2>Your car. Your sale. Your privacy.</h2>
        <p>
          {LAUNCH_FREE_LISTING
            ? "Advertise until sold. Free to list during launch."
            : "Advertise until sold for £9.99 — launch price for the first 500 adverts."}
        </p>
        <Link className="home-btn home-cta-btn" href="/create-advert">
          {LAUNCH_FREE_LISTING ? "List your car free" : "Start for £9.99"}
        </Link>
      </section>

      {/* Mobile sticky CTA */}
      <div className="home-sticky-cta">
        <Link className="home-btn home-btn-primary" href="/create-advert">
          {LAUNCH_FREE_LISTING ? "List your car free" : "Start for £9.99"}
        </Link>
        <Link className="home-btn home-btn-ghost" href="/browse">Browse private cars</Link>
      </div>
    </main>
  );
}
