import Link from "next/link";

export default function HomePage() {
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
          <span className="home-price-was">£9.99</span>
          <span className="home-price-now">£2.50</span>
        </div>
        <p className="home-price-note">Launch price — first 500 adverts only</p>
        <div className="home-hero-ctas">
          <Link className="home-btn home-btn-primary" href="/create-advert">Start for £2.50</Link>
          <Link className="home-btn home-btn-ghost" href="/browse">Browse private cars</Link>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="home-trust-strip">
        <div className="home-trust-inner">
          <div className="home-trust-item">
            <div className="home-trust-big">£2.50</div>
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
              <span className="home-split-val">Secure Vault, every share logged</span>
            </div>
            <div className="home-split-row">
              <span className="home-split-icon">👤</span>
              <span>Who&apos;s contacting you</span>
              <span className="home-split-val">Registered, monitored buyers</span>
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
              <p className="home-vault-lead">MOT certificate, service history, V5C — buyers request them, you decide who sees them. Every request is logged and monitored.</p>
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
                  Document harvesting gets flagged and acted upon
                </div>
              </div>
            </div>
            <div className="home-vault-visual">
              <div className="home-vault-doc">
                <span className="home-vault-file">📄</span>
                <span className="home-vault-meta">
                  <div className="home-vault-name">MOT certificate</div>
                  <div className="home-vault-state">Shared with 1 buyer · logged</div>
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
        <p>Advertise until sold for £2.50 — launch price for the first 500 adverts.</p>
        <Link className="home-btn home-cta-btn" href="/create-advert">Start for £2.50</Link>
      </section>

      {/* Mobile sticky CTA */}
      <div className="home-sticky-cta">
        <Link className="home-btn home-btn-primary" href="/create-advert">Start for £2.50</Link>
        <Link className="home-btn home-btn-ghost" href="/browse">Browse private cars</Link>
      </div>
    </main>
  );
}
