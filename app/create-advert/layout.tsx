import { LAUNCH_FREE_LISTING } from "@/lib/payments/config";
import { pageMetadata } from "@/lib/seo/site";

// /create-advert is a client page, so its metadata lives here.
export const metadata = pageMetadata({
  title: LAUNCH_FREE_LISTING
    ? "Sell your car privately: create a free advert"
    : "Sell your car privately: create your advert",
  description: LAUNCH_FREE_LISTING
    ? "Enter your registration and we'll fill in the details. Free to list during launch, advert runs until sold, and your contact details stay private."
    : "Enter your registration and we'll fill in the details. Your advert runs until sold, and your contact details stay private.",
  path: "/create-advert",
});

export default function CreateAdvertLayout({ children }: { children: React.ReactNode }) {
  return children;
}
