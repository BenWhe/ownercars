import { noindexMetadata } from "@/lib/seo/site";

// Utility page: give it its own title and keep it out of search results.
export const metadata = noindexMetadata("Create an account");

export default function CreateAccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
