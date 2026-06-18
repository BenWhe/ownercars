import { readFileSync } from "fs";
import { join } from "path";
import { marked } from "marked";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The Terms of Service governing your use of OwnerCars and its vehicle advertising and messaging services.",
};

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
