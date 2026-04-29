"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const supabase = createClient();

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      setLoading(false);
    }

    loadUser();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setEmail(null);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-bold tracking-tight text-blue-600">
            OwnerCars
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-700 md:flex">
            <Link href="/browse">Browse cars</Link>
            <Link href="/create-advert">Sell your car</Link>
            <Link href="/dashboard">Dashboard</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight">Your account</h1>

        {loading && <p className="mt-6 text-slate-600">Loading...</p>}

        {!loading && !email && (
          <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold">You are not logged in.</p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-full bg-blue-600 px-6 py-3 font-semibold text-white"
            >
              Go to login
            </Link>
          </div>
        )}

        {!loading && email && (
          <div className="mt-8 space-y-6">
            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold text-blue-600">Account details</p>
              <p className="mt-3 text-lg font-bold">{email}</p>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <h2 className="text-xl font-bold">Seller status</h2>

              <div className="mt-6 space-y-3 text-sm text-slate-700">
                <Status label="Account created" complete />
                <Status label="Email verified" complete />
                <Status label="Phone verified" complete={false} />
                <Status label="Advert created" complete />
                <Status label="Payment completed" complete={false} />
                <Status label="Admin approval" complete={false} />
              </div>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <h2 className="text-xl font-bold">Actions</h2>

              <div className="mt-6 flex flex-wrap gap-4">
                <Link
                  href="/create-advert"
                  className="rounded-full bg-blue-600 px-6 py-3 font-semibold text-white"
                >
                  Create advert
                </Link>

                <Link
                  href="/dashboard"
                  className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-900"
                >
                  View dashboard
                </Link>

                <button
                  onClick={logout}
                  className="rounded-full border border-red-200 px-6 py-3 font-semibold text-red-600"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Status({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
      <span>{label}</span>
      <span
        className={`text-sm font-bold ${
          complete ? "text-green-600" : "text-slate-400"
        }`}
      >
        {complete ? "✓" : "Pending"}
      </span>
    </div>
  );
}