import { pageMetadata } from "@/lib/seo/site";

// /browse is a client page, so its metadata lives here. Every filter
// combination canonicalises to /browse for now (thin inventory); give popular
// filters their own landing pages and canonicals once there are enough adverts.
export const metadata = pageMetadata({
  title: "Used cars for sale by private sellers",
  description:
    "Browse used cars from genuine private sellers, with no dealers. Message sellers securely on OwnerCars and request MOT and service history through the Secure Vault.",
  path: "/browse",
});

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
