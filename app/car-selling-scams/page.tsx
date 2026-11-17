import { readFileSync } from "fs";
import { join } from "path";
import { marked } from "marked";
import Link from "next/link";
import { LAUNCH_FREE_LISTING } from "@/lib/payments/config";
import { pageMetadata } from "@/lib/seo/site";
import { articleSchema, JsonLd } from "@/lib/seo/jsonld";

// Title and description unchanged (template adds " | OwnerCars").
const TITLE = "Car selling scams: 7 messages private sellers get";
const DESCRIPTION =
  "The scam messages private car sellers get — codes, couriers, payment links, fake receipts — how to spot each one, and what to do if you've been caught out.";

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/car-selling-scams" });

export default function CarSellingScamsPage() {
  const markdown = readFileSync(
    join(process.cwd(), "content", "car-selling-scams.md"),
    "utf-8"
  );
  const html = marked.parse(markdown) as string;

  return (
    <main>
      <JsonLd
        data={articleSchema({
          headline: TITLE,
          description: DESCRIPTION,
          path: "/car-selling-scams",
          datePublished: "2026-09-23",
          dateModified: "2026-09-23",
        })}
      />
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
