import "./globals.css";
import Link from "next/link";
import Header from "./components/Header";

export const metadata = {
  title: "OwnerCars",
  description: "Private cars. Private sellers.",
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
        <Header />

        {children}

        {/* FOOTER */}
        <footer className="site-footer">
          <p>© OwnerCars.co.uk</p>
          <div>
            <Link href="/safety-advice">Safety advice</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </footer>

      </body>
    </html>
  );
}
