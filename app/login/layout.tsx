import { noindexMetadata } from "@/lib/seo/site";

// Utility page: give it its own title and keep it out of search results.
export const metadata = noindexMetadata("Log in");

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
