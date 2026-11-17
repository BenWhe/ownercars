import { noindexMetadata } from "@/lib/seo/site";

// Utility page: give it its own title and keep it out of search results.
export const metadata = noindexMetadata("Connection test");

export default function SupabaseTestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
