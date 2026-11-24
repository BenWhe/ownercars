import { noindexMetadata } from "@/lib/seo/site";

// Utility page: give it its own title and keep it out of search results.
export const metadata = noindexMetadata("Reset password");

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
