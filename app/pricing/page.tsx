import Link from "next/link";

export default function PricingPage() {
  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Simple pricing</p>
        <h1>Advertise your car privately for £9.99 — launch price</h1>
        <p>
          One fixed price. No upgrade pressure. No complicated listing packages.
          Your advert stays live until sold.
        </p>

        <Link className="button primary" href="/create-advert">
          Start your advert
        </Link>
      </section>

      <section className="pricing-section">
        <div className="pricing-card featured">
          <p className="eyebrow">OwnerCars advert</p>
          <h2 className="price-hero">
  <span className="price-old">£24.99</span>
  <span className="price-new">£9.99</span>
</h2>
          <p className="pricing-subtitle">Launch offer - normally £24.99</p>

          <ul>
            <li>Private sellers only</li>
            <li>Upload up to 10 photos</li>
            <li>Advert stays live until sold</li>
            <li>Buyer contact through OwnerCars</li>
            <li>No dealer adverts</li>
            <li>No confusing upgrade packages</li>
          </ul>

          <Link className="button primary" href="/create-advert">
            Advertise for £9.99
          </Link>
        </div>

        <div className="pricing-note">
          <h2>Have a launch promo code?</h2>
          <p>
            During initial rollout our Launch lets early private sellers advertise until sold for £9.99. Standard OwnerCars
            price is £24.99.
          </p>
        </div>
      </section>
    </main>
  );
}