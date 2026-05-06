import "./globals.css";
import Link from "next/link";
import Header from "./components/Header";

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
