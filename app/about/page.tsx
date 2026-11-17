import Link from "next/link";
import { LAUNCH_FREE_LISTING } from "@/lib/payments/config";
import { pageMetadata, SITE_URL } from "@/lib/seo/site";
import { JsonLd, ORGANIZATION_ID } from "@/lib/seo/jsonld";

const TITLE = "About OwnerCars";
const DESCRIPTION =
  "OwnerCars is a UK private-seller car marketplace built around privacy. Here's why we started it and how we keep sellers' details safe.";

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/about", absoluteTitle: true });

const ABOUT_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": `${SITE_URL}/about#webpage`,
  url: `${SITE_URL}/about`,
  name: TITLE,
  description: DESCRIPTION,
  inLanguage: "en-GB",
  about: { "@id": ORGANIZATION_ID },
  mainEntity: { "@id": ORGANIZATION_ID },
};

export default function AboutPage() {
  return (
    <main>
      <JsonLd data={ABOUT_SCHEMA} />

      <section className="dashboard-hero">
        <p className="eyebrow">About</p>
        <h1>About OwnerCars</h1>
        <p>
          A UK car marketplace for private sellers, built so you never have to
          hand out your number.
        </p>
      </section>

      {/* Inline links in this page's copy are underlined so they read as links. */}
      <section className="protection-section about-page" style={{ display: "grid", gap: "18px" }}>
        <div className="protection-card large">
          <h2>Why we started it</h2>
          <p>
            Selling a car privately usually means putting your phone number in
            an advert and hoping for the best. What follows is familiar: calls
            at all hours, messages that are obviously scams, and &ldquo;buyers&rdquo;
            asking for a photo of the logbook before they&apos;ve seen the car.
          </p>
          <p style={{ marginTop: "12px" }}>
            Other marketplaces mask your number, but only until you return a
            call, reply to a text or send a photo on WhatsApp. Masked
            isn&apos;t the same as private. We built OwnerCars so there&apos;s
            no point in the sale where your details have to leave the platform.
          </p>
        </div>

        <div className="protection-card large">
          <h2>What makes us different</h2>
          <ul className="guide-bullets">
            <li>
              <strong>Private sellers only.</strong> No dealers, and no traders
              posing as private sellers. See our <Link href="/pricing">pricing</Link>{" "}
              and <Link href="/terms">terms</Link>.
            </li>
            <li>
              <strong>Messages stay on OwnerCars.</strong> Buyers contact you
              through the site, so your phone number and email are never shown.{" "}
              <Link href="/seller-protection">How seller protection works</Link>.
            </li>
            <li>
              <strong>The Secure Vault.</strong> Share your MOT, service history
              and documents with genuine buyers, on your terms.{" "}
              <Link href="/seller-guide">Read the seller guide</Link>.
            </li>
            <li>
              <strong>The nearest town, never a postcode.</strong>{" "}
              Adverts show roughly where the car is, not where you live, and your
              registration isn&apos;t shown on the advert.
            </li>
          </ul>
        </div>

        <div className="protection-card large">
          <h2>Where we are</h2>
          <p>
            OwnerCars is open to private sellers across the UK, and we&apos;re
            starting with the South West.
          </p>
        </div>

        <div className="protection-card large">
          <h2>Who&apos;s behind it</h2>
          <p>
            OwnerCars was founded by Ben Wheeler. It&apos;s run by OwnerCars
            Limited, a company registered in England and Wales (company no.
            17257243), and we&apos;re registered with the Information
            Commissioner&apos;s Office as a data controller. Read our{" "}
            <Link href="/privacy">privacy policy</Link>.
          </p>
        </div>

        <div className="protection-card large">
          <h2>How we deal with scams and traders</h2>
          <p>
            We remove suspicious adverts, and adverts from traders posing as
            private sellers. If you see an advert or a message that doesn&apos;t
            look right, email{" "}
            <a href="mailto:contact@ownercars.co.uk">contact@ownercars.co.uk</a>{" "}
            and we&apos;ll look into it. Our guide to{" "}
            <Link href="/car-selling-scams">car selling scams</Link> covers the
            messages private sellers get most often.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "8px" }}>
          <Link className="button primary" href="/create-advert">
            {LAUNCH_FREE_LISTING ? "List your car free" : "List your car"}
          </Link>
          <Link className="button secondary" href="/browse">
            Browse private cars
          </Link>
        </div>
      </section>
    </main>
  );
}
