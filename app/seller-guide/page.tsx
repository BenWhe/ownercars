import Link from "next/link";

export const metadata = {
  title: "Seller guide",
  description: "Get the most from your OwnerCars private car advert",
};

export default function SellerGuidePage() {
  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Seller guide</p>
        <h1>Get the most from your advert</h1>
        <p>
          A great private listing sells faster and attracts serious buyers.
          Follow these six steps to make your OwnerCars advert work hard for you.
        </p>

        <Link className="button primary" href="/create-advert">
          Start your advert
        </Link>
      </section>

      <section className="protection-section">
        <div className="protection-grid">
          <div className="protection-card">
            <span>1</span>
            <h3>Add great photos</h3>
            <p>
              Strong photos are the single biggest factor in getting a buyer to
              click. You can add up to 10.
            </p>
            <ul className="guide-bullets">
              <li>Add up to 10 photos — the first one is your main image</li>
              <li>Shoot in daylight for clean, true-to-life colour</li>
              <li>Cover all angles, inside and out</li>
              <li>Keep your number plate out of shot</li>
              <li>HEIC, JPG and PNG files all work</li>
              <li>Add, remove or reorder them any time via Edit advert</li>
            </ul>
          </div>

          <div className="protection-card">
            <span>2</span>
            <h3>Write a seller&rsquo;s note that works</h3>
            <p>
              Buyers trust honest, detailed sellers. A clear description
              pre-empts questions and filters out time-wasters.
            </p>
            <ul className="guide-bullets">
              <li>Be honest and specific: condition, history, faults and your reason for sale</li>
              <li>Mention what makes the car special</li>
              <li>Pre-empt the obvious questions: MOT, finance, V5C and keys</li>
              <li>Write for a serious buyer who knows what they&rsquo;re looking for</li>
            </ul>
          </div>

          <div className="protection-card">
            <span>3</span>
            <h3>Set up your Secure Vault</h3>
            <p>
              The Secure Vault lets you share important documents with genuine
              buyers — on your terms, without exposing them publicly.
            </p>
            <ul className="guide-bullets">
              <li>Upload your MOT certificate, service history, a redacted V5C and a video link</li>
              <li>Find it in Edit advert &rarr; Secure Vault section</li>
              <li>Buyers request documents in the message thread</li>
              <li>You decide whether to share</li>
              <li>The buyer gets a secure link that expires after 15 minutes</li>
            </ul>
          </div>

          <div className="protection-card">
            <span>4</span>
            <h3>Share your For Sale card</h3>
            <p>
              Every advert comes with a downloadable For Sale card carrying a QR
              code that links straight to your secure listing.
            </p>
            <ul className="guide-bullets">
              <li>Find it on your advert detail page</li>
              <li>Share it in Facebook car groups, on WhatsApp and Instagram</li>
              <li>Print it for the windscreen</li>
              <li>The QR code links to your secure listing</li>
            </ul>
          </div>

          <div className="protection-card">
            <span>5</span>
            <h3>Respond to messages promptly</h3>
            <p>
              Quick, helpful replies keep buyers engaged and build the trust that
              gets a viewing booked.
            </p>
            <ul className="guide-bullets">
              <li>You&rsquo;re emailed on every new message and reply</li>
              <li>Keep the conversation on OwnerCars</li>
              <li>Be helpful and answer questions fully</li>
              <li>Arrange viewings through messaging</li>
            </ul>
          </div>

          <div className="protection-card">
            <span>6</span>
            <h3>Mark as sold when it sells</h3>
            <p>
              Once the deal is done, mark the advert as sold to keep your listing
              tidy and accurate.
            </p>
            <ul className="guide-bullets">
              <li>Go to your dashboard &rarr; open the advert &rarr; Mark as sold</li>
              <li>It&rsquo;s removed from search results straight away</li>
              <li>You can list it again any time</li>
            </ul>
          </div>
        </div>

        <div className="protection-card large">
          <h2>Ready to list your car?</h2>
          <p>
            Create your advert in minutes and keep your personal details private
            from the first message to the final handshake.
          </p>
          <Link
            className="button primary"
            href="/create-advert"
            style={{ marginTop: 18 }}
          >
            Start your advert
          </Link>
        </div>
      </section>
    </main>
  );
}
