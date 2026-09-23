import { readFileSync } from "fs";
import { join } from "path";
import { marked } from "marked";
import Link from "next/link";
import type { Metadata } from "next";
import { LAUNCH_FREE_LISTING } from "@/lib/payments/config";

const TITLE = "Car selling scams: 7 messages private sellers get | OwnerCars";
const DESCRIPTION =
  "The scam messages private car sellers get — codes, couriers, payment links, fake receipts — how to spot each one, and what to do if you've been caught out.";
const URL = "https://www.ownercars.co.uk/car-selling-scams";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function CarSellingScamsPage() {
  const markdown = readFileSync(
    join(process.cwd(), "content", "car-selling-scams.md"),
    "utf-8"
  );
  const html = marked.parse(markdown) as string;

  return (
    <main>
      <section
        className="legal-page"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <section className="cta-band">
        <h2>Sell without handing out your number</h2>
        {LAUNCH_FREE_LISTING && <p>Free to list during launch.</p>}
        <Link className="button primary" href="/create-advert">
          {LAUNCH_FREE_LISTING ? "List your car free" : "Start your advert"}
        </Link>
      </section>
    </main>
  );
}
