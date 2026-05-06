export default function ContactPage() {
  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Contact OwnerCars</p>
        <h1>We’re here to help</h1>
        <p>
          Contact us with questions about selling, buying, account access or
          safety on OwnerCars.
        </p>
      </section>

      <section className="contact-section">
        <div className="contact-card">
          <h2>Contact details</h2>

          <div className="contact-list">
            <p>
              <strong>Phone</strong>
              <a href="tel:01392949008">01392 949008</a>
            </p>

            <p>
              <strong>Email</strong>
              <a href="mailto:contact@ownercars.co.uk">
                contact@ownercars.co.uk
              </a>
            </p>

            <p>
              <strong>WhatsApp</strong>
              <a href="https://wa.me/447960034969">07960 034969</a>
            </p>

            <p>
              <strong>Address</strong>
              <span>
                c/o Truckers Market Ltd.<br />
                128 City Road<br />
                London<br />
                EC1V 2NX
              </span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}