import { readFileSync } from "fs";
import { join } from "path";
import { marked } from "marked";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata({
  title: "Terms of Service",
  description: "The terms for using OwnerCars, the UK private-seller car marketplace run by OwnerCars Limited.",
  path: "/terms",
});

export default function TermsPage() {
  const markdown = readFileSync(
    join(process.cwd(), "content", "OwnerCars_terms_of_service.md"),
    "utf-8"
  );
  const html = marked.parse(markdown) as string;

  return (
    <main>
      <section
        className="legal-page"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
