import { readFileSync } from "fs";
import { join } from "path";
import { marked } from "marked";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How OwnerCars Limited collects, uses and protects your personal data.",
  path: "/privacy",
});

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
