import Link from "next/link";
import type { Metadata } from "next";
import { LAUNCH_FREE_LISTING } from "@/lib/payments/config";

const TITLE = "Seller protection: sell your car privately | OwnerCars";
const DESCRIPTION =
  "Your phone number, email and address are never shown. Buyers message you through OwnerCars, and your documents are shared on your terms.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
};

function CtaButton() {
  return (
    <Link className="button primary" href="/create-advert">
      {LAUNCH_FREE_LISTING ? "List your car free" : "Start your advert"}
    </Link>
  );
}

export default function SellerProtectionPage() {
  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Seller protection</p>
        <h1>Sell your car without handing out your life</h1>
        <p>
          Selling privately usually means giving strangers your phone number,
          your address and a photo of your logbook. OwnerCars is built so you
          don&apos;t have to.
        </p>

        <CtaButton />
      </section>

      <section className="protection-section">
        <div className="protection-card large">
          <h2>The listing is where the risk starts</h2>
          <p>
            To sell a car, you have to be findable, and fraudsters know it.
            They want exactly what a buyer asks for: your number, your
            address, your registration and your documents.
          </p>
        </div>

        <div className="home-trust-strip">
          <div className="home-trust-inner trust-strip-3col">
            <div className="home-trust-item">
              <div className="home-trust-big">1 in 5</div>
              <div className="home-trust-small">
                people selling on second-hand marketplaces has experienced a scam
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", opacity: 0.75, marginTop: "6px" }}>
                Which?, 2024
              </div>
            </div>
            <div className="home-trust-item">
              <div className="home-trust-big">Half</div>
              <div className="home-trust-small">
                of UK adults received a suspicious message in the previous three months
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", opacity: 0.75, marginTop: "6px" }}>
                Ofcom, 2025
              </div>
            </div>
            <div className="home-trust-item">
              <div className="home-trust-big">11,394</div>
              <div className="home-trust-small">
                cloned number plates were reported in 2025, up 54% since 2020
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", opacity: 0.75, marginTop: "6px" }}>
                DVLA figures, 2026
              </div>
            </div>
          </div>
        </div>

        <div className="protection-card large">
          <blockquote
            style={{
              margin: "0 0 16px",
              padding: 0,
              fontSize: "22px",
              fontWeight: 600,
              fontStyle: "italic",
              lineHeight: 1.4,
              color: "var(--text)",
            }}
          >
            &ldquo;Both documents contain key identifying details that scammers
            can use to steal your identity or even clone your vehicle.&rdquo;
          </blockquote>
          <p>DVLA, on the vehicle logbook and driving licence</p>
        </div>

        <div className="protection-card large">
          <h2>Private by default</h2>
          <p>
            Your advert shows the car, its key details and the nearest town.
            It never shows your phone number, email address, home address or
            postcode, and your registration isn&apos;t listed as an advert
            detail.
          </p>
          <p style={{ fontSize: "14px", marginTop: "12px" }}>
            Photos can still show a number plate, so we ask you to cover or
            blur it before you upload.
          </p>
        </div>

        <div className="protection-grid">
          <div className="protection-card">
            <span>1</span>
            <h3>Messages stay on OwnerCars.</h3>
            <p>
              Buyers need an account to message you, and every conversation
              happens here. You never have to hand out your number to answer
              a question.
            </p>
          </div>

          <div className="protection-card">
            <span>2</span>
            <h3>You decide what to share, and when.</h3>
            <p>
              Your registration and address are never on your advert. If a
              buyer needs them, for an insurance quote or to arrange a
              viewing, you choose whether and when to tell them.
            </p>
          </div>

          <div className="protection-card">
            <span>3</span>
            <h3>Your documents, on your terms.</h3>
            <p>
              Put your MOT certificate, service history and a redacted
              logbook in your secure vault. Buyers request them one at a
              time, you approve each one, and the link expires after 15
              minutes. Nothing is sent by email or WhatsApp.
            </p>
          </div>

          <div className="protection-card">
            <span>4</span>
            <h3>Buyers see the town, not your house.</h3>
            <p>
              Your postcode is used only to show buyers roughly how far away
              the car is. They see the nearest town, never the postcode.
            </p>
          </div>
        </div>

        <div className="protection-card large">
          <h2>What no website can do for you</h2>
          <p>
            No website can make scams impossible. Someone can still invent a
            courier or ask for a code through our messages. So we&apos;ve
            written down the messages sellers get most often, and what each
            one really means.
          </p>
          <p style={{ marginTop: "16px" }}>
            <Link className="home-cars-browse" href="/car-selling-scams">
              Read the car selling scams guide →
            </Link>
          </p>
          <p style={{ marginTop: "10px" }}>
            <Link className="home-cars-browse" href="/safety-advice">
              Safety advice for viewings →
            </Link>
          </p>
        </div>

        <div className="protection-card large">
          <h2>Ready to sell privately?</h2>
          <CtaButton />
        </div>
      </section>

      <p style={{ textAlign: "center", fontSize: "13px", color: "var(--muted)", padding: "0 24px 48px" }}>
        <a
          href="https://www.which.co.uk/policy-and-insight/article/a-third-of-buyers-have-experienced-a-scam-on-popular-second-hand-marketplaces-in-the-last-two-years-which-warns-aEea68N4nnah"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit" }}
        >
          Which?, May 2024
        </a>
        {" · "}
        <a
          href="https://www.ofcom.org.uk/siteassets/resources/documents/consultations/category-3-4-weeks/consultation-combatting-mobile-messaging-scams/main-document/consultation-combatting-mobile-messaging-scams.pdf"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit" }}
        >
          Ofcom, October 2025
        </a>
        {" · "}
        <a
          href="https://www.gov.uk/government/news/dvlas-top-tips-for-avoiding-scams"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit" }}
        >
          DVLA, April 2025
        </a>
        {" · "}
        <a
          href="https://www.bodyshopmag.com/2026/news/number-plate-cloning-spikes-by-nine-per-cent/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit" }}
        >
          DVLA figures, April 2026
        </a>
      </p>
    </main>
  );
}
