import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-bold tracking-tight text-blue-600">
            OwnerCars
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-700 md:flex">
            <Link href="/browse">Browse cars</Link>
            <Link href="/create-advert">Sell your car</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/login" className="rounded-full bg-slate-950 px-5 py-2 text-white">
              Login
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center">
        <div>
          <div className="mb-5 inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Private sellers only
          </div>

          <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
            Sell your car privately for £9.99
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Advertise until sold. Interact with verified buyers through the
            platform to keep your phone number and email safe.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/create-advert"
              className="rounded-full bg-blue-600 px-7 py-3 font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Sell my car
            </Link>

            <Link
              href="/browse"
              className="rounded-full border border-slate-300 px-7 py-3 font-semibold text-slate-900 hover:bg-slate-50"
            >
              Browse private cars
            </Link>
          </div>
        </div>

        <div className="rounded-3xl bg-slate-950 p-8 text-white shadow-2xl">
          <div className="rounded-2xl bg-white p-5 text-slate-950">
            <div className="h-48 rounded-xl bg-gradient-to-br from-slate-200 to-slate-400" />
            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-600">Private seller</p>
                <h2 className="mt-1 text-2xl font-bold">BMW M2 Competition</h2>
                <p className="mt-1 text-slate-500">2021 • 24,500 miles • Petrol</p>
              </div>
              <p className="text-2xl font-bold">£39,995</p>
            </div>

            <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">
              Buyers must verify their email and phone before messaging.
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-8 md:grid-cols-4">
          {[
            "£9.99 fixed price",
            "Advertise until sold",
            "Seller details protected",
            "Verified buyers only",
          ].map((item) => (
            <div key={item} className="rounded-2xl bg-white p-5 font-semibold shadow-sm">
              ✓ {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-bold tracking-tight">No anonymous buyers.</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Every buyer must verify their email and phone number before a message
            is sent. That means fewer timewasters, less spam, and safer private
            selling.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            ["Create your advert", "Add your car details, description and up to 10 photos."],
            ["Pay £9.99", "One fixed price. No confusing packages or dealer upsells."],
            ["Message securely", "Keep your phone number and email hidden from buyers."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-3xl border border-slate-200 p-8">
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-blue-600 px-6 py-16 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold">Ready to sell privately?</h2>
            <p className="mt-2 text-blue-100">
              List your car for £9.99 and keep your details protected.
            </p>
          </div>

          <Link
            href="/create-advert"
            className="rounded-full bg-white px-7 py-3 font-semibold text-blue-700"
          >
            Start advert
          </Link>
        </div>
      </section>
    </main>
  );
}