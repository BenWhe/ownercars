import Link from "next/link";

export default function SellerProtectionPage() {
  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Seller protection built in</p>
        <h1>Sell privately, without exposing your details</h1>
        <p>
          OwnerCars is designed to protect your contact details, vehicle identity
          and location throughout the selling journey.
        </p>

        <Link className="button primary" href="/create-advert">
          Start your advert
        </Link>
      </section>

      <section className="protection-section">
        <div className="protection-card large">
          <h2>Your details stay private by default</h2>
          <p>
            We do not display your phone number, email address, full address,
            vehicle registration or VIN on public adverts. Buyers see the car,
            the key details and a general location only.
          </p>
        </div>

        <div className="protection-grid">
          <div className="protection-card">
            <span>1</span>
            <h3>Messaging stays on OwnerCars</h3>
            <p>
              Buyers contact you through the platform, so you do not need to
              move straight to WhatsApp or share your phone number.
            </p>
          </div>

          <div className="protection-card">
            <span>2</span>
            <h3>Vehicle registration is controlled</h3>
            <p>
              Buyers can request the vehicle registration, but you decide when
              and whether to share it.
            </p>
          </div>

          <div className="protection-card">
            <span>3</span>
            <h3>Your address is protected</h3>
            <p>
              Your address is not shown publicly. It is only shared when a
              viewing is agreed and you choose to release the details.
            </p>
          </div>

          <div className="protection-card">
            <span>4</span>
            <h3>Buyer requests are logged</h3>
            <p>
              Requests for sensitive information are recorded, helping us detect
              repeated attempts to collect vehicle registrations, addresses or
              contact details.
            </p>
          </div>

          <div className="protection-card">
            <span>5</span>
            <h3>Buyer checks are progressive</h3>
            <p>
              Buyers can build trust through contact checks, identity checks and
              positive platform behaviour.
            </p>
          </div>

          <div className="protection-card">
            <span>6</span>
            <h3>Reputation is based on behaviour</h3>
            <p>
              Over time, sellers can help build buyer reputation through real
              outcomes such as good communication, completed viewings and
              reliable follow-through.
            </p>
          </div>
        </div>

        <div className="protection-card large">
          <h2>Designed to prevent data harvesting</h2>
          <p>
            A common scam pattern is to collect a seller’s phone number, vehicle
            registration and address without any genuine intention to buy.
            OwnerCars reduces that risk by releasing sensitive information in
            stages, under seller control.
          </p>
        </div>
      </section>
    </main>
  );
}