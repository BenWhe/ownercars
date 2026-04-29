import "./globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>

        {/* HEADER */}
        <header className="site-header">
          <Link className="brand" href="/">
            OwnerCars<span>.co.uk</span>
          </Link>

          <nav className="nav">
            <Link href="/browse">Browse cars</Link>
            <Link href="/create-advert">Sell your car</Link>
            <Link href="#">Pricing</Link>
            <Link href="#">How it works</Link>
            <Link className="nav-cta" href="/create-advert">
              Advertise for £9.99
            </Link>
          </nav>
        </header>

        {children}

        {/* FOOTER */}
        <footer className="site-footer">
          <p>© OwnerCars.co.uk</p>
          <div>
            <Link href="#">Safety advice</Link>
            <Link href="#">Contact</Link>
          </div>
        </footer>

      </body>
    </html>
  );
}
