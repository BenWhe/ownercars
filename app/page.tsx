import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Private cars. Private sellers. One simple price.</p>
          <h1>Sell your car privately for £9.99</h1>
          <p className="hero-subtitle">
            Advertise until sold, upload up to 10 photos, and interact with buyers through the platform to keep your phone number and email safe.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/create-advert">Sell my car</Link>
            <Link className="button secondary" href="/browse">Browse private cars</Link>
          </div>
        </div>

        <div className="hero-card">
          <div className="mock-photo"></div>
          <div className="mock-listing">
            <p className="mock-title">2019 BMW 3 Series</p>
            <p className="mock-price">£18,995</p>
            <p className="mock-meta">Private seller · 42,000 miles · Exeter</p>
          </div>
        </div>
      </section>

      <section className="search-panel">
        <h2>Find a privately owned car</h2>
        <form className="search-form">
          <input type="text" placeholder="Make or model" />
          <input type="text" placeholder="Postcode" />
          <select defaultValue="Any price">
            <option>Any price</option>
          </select>
          <button type="button">Search</button>
        </form>
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