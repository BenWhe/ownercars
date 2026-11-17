import { noindexMetadata } from "@/lib/seo/site";

// Utility page: give it its own title and keep it out of search results.
export const metadata = noindexMetadata("Forgot password");

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
