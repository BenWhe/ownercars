import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How we protect sellers",
  description:
    "How OwnerCars keeps sellers in control — secure on-platform messaging, email alerts, and the Secure Vault for sharing documents safely on your terms.",
};

export default function HowWeProtectSellersPage() {
  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">How we protect sellers</p>
        <h1>Your privacy, built in</h1>
        <p>
          Selling a car privately shouldn&apos;t mean handing your details to
          strangers. OwnerCars is built so you stay in control — your contact
          details, your registration, and your documents are never exposed
          without your say-so.
        </p>
      </section>

      <section className="protection-section">
        <div className="protection-card large">
          <h2>Everything stays on the platform</h2>
          <p>
            On most sites, the moment you advertise a car your phone number or
            email is out in the open. On OwnerCars, they never are. Buyers and
            sellers communicate entirely through OwnerCars&apos; secure
            messaging — no contact details, exact location, or registration
            ever changes hands without your say-so.
          </p>
        </div>

        <div className="protection-grid">
          <div className="protection-card">
            <span>1</span>
            <h3>Messaging on the platform</h3>
            <p>
              A buyer enquiring about your car sends a message through the
              advert — no phone number or email changes hands. You reply
              through the same thread. Your contact details, exact location,
              and registration stay private throughout. No scam texts, no
              nuisance calls, no details leaking the moment you respond.
            </p>
          </div>

          <div className="protection-card">
            <span>2</span>
            <h3>Accounts required to make contact</h3>
            <p>
              To message a seller, a buyer needs an OwnerCars account. This
              keeps conversations tied to real, contactable accounts — not
              throwaway addresses. All exchange stays on the platform, where
              your privacy is protected. A buyer&apos;s details are never shown
              to you; only their messages come through.
            </p>
          </div>

          <div className="protection-card">
            <span>3</span>
            <h3>Email alerts</h3>
            <p>
              You don&apos;t need to watch the site. You&apos;re emailed when a
              buyer sends a first message, when they reply in an existing
              conversation, and when they request one of your Secure Vault
              documents. Buyers are emailed when you reply. Every alert links
              back to the conversation on OwnerCars — the messages stay on the
              platform.
            </p>
          </div>

          <div className="protection-card">
            <span>4</span>
            <h3>The Secure Vault</h3>
            <p>
              Upload your MOT certificate, service history, a redacted V5C,
              and a video link — all stored privately, never shown publicly on
              your advert. When a buyer requests a document you&apos;re
              notified in your messages and decide whether to share. If you do,
              they receive a secure link that expires after 15 minutes. One
              document at a time, entirely on your terms.
            </p>
          </div>
        </div>

        <div className="protection-card large">
          <h2>Privacy by design</h2>
          <p>
            Every part of OwnerCars is built to keep the seller in control.{" "}
            <strong>Contact details</strong> — never shown; all communication
            is through the platform.{" "}
            <strong>Registration number</strong> — never displayed as a listed
            detail on your advert, so it can&apos;t be read off the page or
            used to clone your vehicle&apos;s identity (and we&apos;d always
            recommend keeping the plate out of your photos too).{" "}
            <strong>Location</strong> — shown only as the nearest town, never
            your full postcode or address.{" "}
            <strong>Documents</strong> — shared only through the Secure Vault,
            on your terms, via time-limited links. Selling your car
            shouldn&apos;t cost you your privacy. With OwnerCars, it
            doesn&apos;t.
          </p>
        </div>
      </section>
    </main>
  );
}
