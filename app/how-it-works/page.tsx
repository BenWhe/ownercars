import Link from "next/link";
import { LAUNCH_FREE_LISTING } from "@/lib/payments/config";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata({
  title: "How it works: sell your car in five steps",
  description: LAUNCH_FREE_LISTING
    ? "Create your advert, add up to 10 photos, publish free during launch, talk to buyers securely through OwnerCars and mark it sold. Here's how it works."
    : "Create your advert, add up to 10 photos, publish, talk to buyers securely through OwnerCars and mark it sold. Here's how it works.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">How it works</p>
        <h1>List your car in five simple steps</h1>
        <p>
          OwnerCars is built for private sellers: simple pricing, protected
          contact details and secure buyer interaction.
        </p>

        <Link className="button primary" href="/create-advert">
          Start your advert
        </Link>
      </section>

      <section className="how-section">
        <div className="how-card">
          <span>1</span>
          <h2>Create your advert</h2>
          <p>Add your car details, mileage, price and description.</p>
        </div>

        <div className="how-card">
          <span>2</span>
          <h2>Upload photos</h2>
          <p>Add up to 10 photos and choose which image appears first.</p>
        </div>

        <div className="how-card">
          <span>3</span>
          <h2>Publish your listing</h2>
          <p>
            {LAUNCH_FREE_LISTING
              ? "Use the launch offer to advertise until sold for free. Listing fees will apply after launch."
              : "Use the launch offer to advertise until sold for £9.99. Standard OwnerCars pricing is £24.99."}
          </p>
        </div>

        <div className="how-card">
          <span>4</span>
          <h2>Interact securely</h2>
          <p>
            Buyers contact you through OwnerCars, helping keep your phone number
            and email safe.
          </p>
        </div>

        <div className="how-card">
          <span>5</span>
          <h2>Mark as sold</h2>
          <p>Once the car is sold, mark the advert as sold from your dashboard.</p>
        </div>
      </section>
    </main>
  );
}