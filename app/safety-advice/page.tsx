import Link from "next/link";

export default function SafetyAdvicePage() {
  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Safety advice</p>
        <h1>Sell and buy privately with confidence</h1>
        <p>
          OwnerCars is designed to keep communication on-platform and help reduce
          the risk of scams, data harvesting and unsafe viewings.
        </p>
      </section>

      <section className="protection-section">
        <div className="protection-grid">
          <div className="protection-card">
            <span>1</span>
            <h3>Keep messages on OwnerCars</h3>
            <p>
              Avoid moving quickly to WhatsApp, text or email. Keeping messages
              on-platform helps create a clear record if anything feels wrong.
            </p>
          </div>

          <div className="protection-card">
            <span>2</span>
            <h3>Protect your vehicle registration</h3>
            <p>
              Do not share your vehicle registration too early. Genuine buyers
              can request details when there is a clear reason, such as insurance
              or MOT checks.
            </p>
          </div>

          <div className="protection-card">
            <span>3</span>
            <h3>Do not share your address too soon</h3>
            <p>
              Share your exact location only when a viewing is agreed. Consider
              meeting first in a public, safe location.
            </p>
          </div>

          <div className="protection-card">
            <span>4</span>
            <h3>Be wary of pressure tactics</h3>
            <p>
              Be cautious if someone asks for urgent payment details, pushes you
              off-platform, or asks for sensitive information before discussing
              the vehicle properly.
            </p>
          </div>

          <div className="protection-card">
            <span>5</span>
            <h3>Check payment carefully</h3>
            <p>
              Do not release the vehicle until funds have cleared in your bank.
              Be cautious of screenshots, fake banking apps or overpayment
              scams.
            </p>
          </div>

          <div className="protection-card">
            <span>6</span>
            <h3>Report suspicious behaviour</h3>
            <p>
              If something feels wrong, stop the conversation and contact
              OwnerCars. We can review buyer behaviour and take action where
              needed.
            </p>
          </div>
        </div>

        <div className="protection-card large">
          <h2>Seller protection is built in</h2>
          <p>
            OwnerCars is designed to help protect your phone number, email,
            vehicle registration and address until you decide what to share.
          </p>
          <br />
          <Link className="button primary" href="/seller-protection">
            Learn about seller protection
          </Link>
        </div>
      </section>
    </main>
  );
}