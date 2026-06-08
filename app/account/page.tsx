"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOutAndClearSession } from "@/lib/auth/client";

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [postcode, setPostcode] = useState("");
  const [postcodeInput, setPostcodeInput] = useState("");
  const [postcodeError, setPostcodeError] = useState("");
  const [postcodeSaving, setPostcodeSaving] = useState(false);
  const [postcodeSaved, setPostcodeSaved] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const res = await fetch("/api/account");
      const result = await res.json();
      setEmail(result.user?.email ?? null);
      const existing = result.profile?.postcode ?? "";
      setPostcode(existing);
      setPostcodeInput(existing);
      setLoading(false);
    }

    loadUser();
  }, []);

  async function logout() {
    setEmail(null);
    await signOutAndClearSession();
  }

  async function handleSavePostcode(e: React.FormEvent) {
    e.preventDefault();
    setPostcodeError("");
    setPostcodeSaved(false);
    setPostcodeSaving(true);

    const trimmed = postcodeInput.trim();
    if (!trimmed) {
      setPostcodeError("Please enter a postcode.");
      setPostcodeSaving(false);
      return;
    }

    const geoRes = await fetch(`/api/geocode?postcode=${encodeURIComponent(trimmed)}`);
    const geoResult = await geoRes.json();

    if (!geoRes.ok) {
      setPostcodeError("Please enter a valid UK postcode.");
      setPostcodeSaving(false);
      return;
    }

    const patchRes = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postcode: geoResult.postcode,
        latitude: geoResult.latitude,
        longitude: geoResult.longitude,
      }),
    });

    setPostcodeSaving(false);

    if (!patchRes.ok) {
      const err = await patchRes.json();
      setPostcodeError(err.error || "Could not save postcode.");
      return;
    }

    setPostcode(geoResult.postcode);
    setPostcodeInput(geoResult.postcode);
    setPostcodeSaved(true);
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
              <h2 className="text-xl font-bold">Your postcode</h2>
              <p className="mt-2 text-sm text-slate-500">
                Needed to calculate distances to adverts. Your postcode is never visible on the platform.
              </p>

              <form onSubmit={handleSavePostcode} className="mt-5 flex items-start gap-3 flex-wrap">
                <input
                  type="text"
                  value={postcodeInput}
                  onChange={(e) => { setPostcodeInput(e.target.value); setPostcodeError(""); setPostcodeSaved(false); }}
                  placeholder="e.g. DT6 3NP"
                  maxLength={8}
                  className="h-11 rounded-full border border-slate-200 px-4 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="submit"
                  disabled={postcodeSaving}
                  className="h-11 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {postcodeSaving ? "Saving..." : "Save postcode"}
                </button>
              </form>

              {postcodeError && (
                <p className="mt-2 text-sm text-red-600">{postcodeError}</p>
              )}
              {postcodeSaved && (
                <p className="mt-2 text-sm text-green-600">✓ Postcode saved — {postcode}</p>
              )}
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

function Status({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
      <span>{label}</span>
      <span className={`text-sm font-bold ${complete ? "text-green-600" : "text-slate-400"}`}>
        {complete ? "✓" : "Pending"}
      </span>
    </div>
  );
}
