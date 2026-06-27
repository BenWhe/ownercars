import "./globals.css";
import Link from "next/link";
import Header from "./components/Header";
import AuthSessionSync from "./components/AuthSessionSync";

const TITLE = "OwnerCars — Sell your car privately";
const DESCRIPTION =
  "Sell your car privately and keep your details private. Buyers message you through OwnerCars — your phone number, email and address are never shown. Advertise until sold from £9.99.";

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
        <footer className="site-footer">
          <p>© OwnerCars.co.uk</p>
          <div>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/seller-guide">Seller guide</Link>
            <Link href="/safety-advice">Safety advice</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </footer>

      </body>
    </html>
  );
}
