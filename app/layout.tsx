import "./globals.css";
import Link from "next/link";
import Header from "./components/Header";
import AuthSessionSync from "./components/AuthSessionSync";
import { LAUNCH_FREE_LISTING } from "@/lib/payments/config";
import { Analytics } from "@vercel/analytics/next";

const TITLE = "OwnerCars — Sell your car privately";
const DESCRIPTION = LAUNCH_FREE_LISTING
  ? "Sell your car free on OwnerCars. Buyers message you through the site, so your phone number, email and address stay private."
  : "Sell your car privately and keep your details private. Buyers message you through OwnerCars — your phone number, email and address are never shown. Advertise until sold from £9.99.";

export const metadata = {
  metadataBase: new URL("https://www.ownercars.co.uk"),
  title: {
    default: TITLE,
    template: "%s | OwnerCars",
  },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://www.ownercars.co.uk",
    siteName: "OwnerCars",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>

        {/* HEADER */}
        <AuthSessionSync />
        <Header />

        {children}

        {/* FOOTER */}
        <footer className="mk-footer">
          <div className="mk-footer-inner">
            <nav className="mk-footer-cols" aria-label="Footer">
              <section>
                <h2>Buy</h2>
                <ul>
                  <li><Link href="/browse">Browse cars</Link></li>
                </ul>
              </section>
              <section>
                <h2>Sell</h2>
                <ul>
                  <li><Link href="/create-advert">Sell your car</Link></li>
                  <li><Link href="/pricing">Pricing</Link></li>
                  <li><Link href="/seller-guide">Seller guide</Link></li>
                  <li><Link href="/seller-protection">Seller protection</Link></li>
                </ul>
              </section>
              <section>
                <h2>Help</h2>
                <ul>
                  <li><Link href="/car-selling-scams">Car selling scams</Link></li>
                  <li><Link href="/safety-advice">Safety advice</Link></li>
                  <li><Link href="/how-it-works">How it works</Link></li>
                  <li><Link href="/contact">Contact</Link></li>
                </ul>
              </section>
              <section>
                <h2>Company</h2>
                <ul>
                  <li><Link href="/terms">Terms</Link></li>
                  <li><Link href="/privacy">Privacy</Link></li>
                </ul>
              </section>
            </nav>
            <p className="mk-footer-legal">© OwnerCars.co.uk</p>
            <p className="mk-footer-legal">
              OwnerCars Limited · Registered in England and Wales · Company no. 17257243 · Registered office: 128 City Road, London, EC1V 2NX
            </p>
          </div>
        </footer>

        <Analytics />
      </body>
    </html>
  );
}
