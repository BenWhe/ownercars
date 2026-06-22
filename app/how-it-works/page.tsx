import { readFileSync } from "fs";
import { join } from "path";
import { marked } from "marked";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How OwnerCars works",
  description:
    "How OwnerCars keeps your details private — secure messaging, email alerts, and the Secure Vault for sharing documents safely.",
};

export default function HowItWorksPage() {
  const markdown = readFileSync(
    join(process.cwd(), "content", "OwnerCars_how_it_works.md"),
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
