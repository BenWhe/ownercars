import { readFileSync } from "fs";
import { join } from "path";
import { marked } from "marked";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How OwnerCars collects, uses, and protects your personal data when you use our website and services.",
};

export default function PrivacyPage() {
  const markdown = readFileSync(
    join(process.cwd(), "content", "OwnerCars_privacy_policy.md"),
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
