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
  const [fullName, setFullName] = useState("");
  const [fullNameInput, setFullNameInput] = useState("");
  const [fullNameError, setFullNameError] = useState("");
  const [fullNameSaving, setFullNameSaving] = useState(false);
  const [fullNameSaved, setFullNameSaved] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const res = await fetch("/api/account");
      const result = await res.json();
      setEmail(result.user?.email ?? null);
      let existing: string = result.profile?.postcode ?? "";

      // Self-heal: postcode was stored in user_metadata at signup but never written to
      // the profiles table (expected when email confirmation is enabled).
      if (!existing) {
        const metaPostcode: string | null = result.user?.user_metadata?.postcode ?? null;
        if (metaPostcode) {
          try {
            const geoRes = await fetch(`/api/geocode?postcode=${encodeURIComponent(metaPostcode)}`);
            if (geoRes.ok) {
              const geo = await geoRes.json();
              await fetch("/api/account", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  postcode: geo.postcode,
                  latitude: geo.latitude,
                  longitude: geo.longitude,
                }),
              });
              existing = geo.postcode;
            }
          } catch {
            // Non-blocking — user can always save manually
          }
        }
      }

      setPostcode(existing);
      setPostcodeInput(existing);

      let existingName: string = result.profile?.full_name ?? "";

      // Self-heal: full_name was stored in user_metadata at signup but never
      // written to the profiles table (expected when email confirmation is
      // enabled, since the signup PATCH only runs when a session exists).
      if (!existingName) {
        const metaName: string | null = result.user?.user_metadata?.full_name ?? null;
        if (metaName) {
          try {
            await fetch("/api/account", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ full_name: metaName }),
            });
            existingName = metaName;
          } catch {
            // Non-blocking — user can always save manually
          }
        }
      }

      setFullName(existingName);
      setFullNameInput(existingName);
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

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setFullNameError("");
    setFullNameSaved(false);
    setFullNameSaving(true);

    const trimmed = fullNameInput.trim();
    if (!trimmed) {
      setFullNameError("Please enter your name.");
      setFullNameSaving(false);
      return;
    }

    const patchRes = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: trimmed }),
    });

    setFullNameSaving(false);

    if (!patchRes.ok) {
      const err = await patchRes.json();
      setFullNameError(err.error || "Could not save your name.");
      return;
    }

    setFullName(trimmed);
    setFullNameInput(trimmed);
    setFullNameSaved(true);
  }

  if (loading) return null;

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Your account</p>
        <h1>Account settings</h1>
        <p>Manage your email, postcode and account preferences.</p>
      </section>

      <section className="form-section">
        {!email ? (
          <div className="account-card">
            <p style={{ marginBottom: "16px" }}>You are not logged in.</p>
            <Link href="/login" className="button primary" style={{ display: "inline-flex" }}>
              Go to login
            </Link>
          </div>
        ) : (
          <>
            {/* Name */}
            <div className="account-card">
              <p className="eyebrow" style={{ marginBottom: "6px" }}>YOUR NAME</p>

              <form onSubmit={handleSaveName} className="account-postcode-form">
                <input
                  type="text"
                  value={fullNameInput}
                  onChange={(e) => {
                    setFullNameInput(e.target.value);
                    setFullNameError("");
                    setFullNameSaved(false);
                  }}
                  placeholder="e.g. Jane Smith"
                  className="account-postcode-input"
                  style={{ width: "220px" }}
                />
                <button
                  type="submit"
                  disabled={fullNameSaving}
                  className="button primary"
                  style={{ padding: "10px 20px" }}
                >
                  {fullNameSaving ? "Saving…" : fullName ? "Update name" : "Save name"}
                </button>
              </form>

              {fullName && fullNameInput === fullName && !fullNameSaved && (
                <p style={{ fontSize: '13px', color: '#16a34a', margin: '6px 0 0' }}>✓ Name saved</p>
              )}
              {fullNameError && (
                <p className="account-error">{fullNameError}</p>
              )}
              {fullNameSaved && (
                <p className="account-success">✓ Name saved — {fullName}</p>
              )}
            </div>

            {/* Email */}
            <div className="account-card">
              <p className="eyebrow" style={{ marginBottom: "6px" }}>Email address</p>
              <p className="account-value">{email}</p>
              <p className="account-hint" style={{ marginTop: "8px", marginBottom: 0 }}>
                Need to change your email address? <Link href="/contact">Contact us</Link>
              </p>
            </div>

            {/* Postcode */}
            <div className="account-card">
              <p className="eyebrow" style={{ marginBottom: "6px" }}>YOUR POSTCODE</p>
              <p className="account-hint">
                Used to show you how far away adverts are. Never shown to anyone.
              </p>

              <form onSubmit={handleSavePostcode} className="account-postcode-form">
                <input
                  type="text"
                  value={postcodeInput}
                  onChange={(e) => {
                    setPostcodeInput(e.target.value);
                    setPostcodeError("");
                    setPostcodeSaved(false);
                  }}
                  placeholder="e.g. DT6 3NP"
                  maxLength={8}
                  className="account-postcode-input"
                />
                <button
                  type="submit"
                  disabled={postcodeSaving}
                  className="button primary"
                  style={{ padding: "10px 20px" }}
                >
                  {postcodeSaving ? "Saving…" : postcode ? "Update postcode" : "Save postcode"}
                </button>
              </form>

              {postcode && postcodeInput === postcode && !postcodeSaved && (
                <p style={{ fontSize: '13px', color: '#16a34a', margin: '6px 0 0' }}>✓ Postcode saved</p>
              )}
              {postcodeError && (
                <p className="account-error">{postcodeError}</p>
              )}
              {postcodeSaved && (
                <p className="account-success">✓ Postcode saved — {postcode}</p>
              )}
            </div>

            {/* Actions */}
            <div className="account-card">
              <p className="eyebrow" style={{ marginBottom: "16px" }}>Actions</p>
              <div className="account-actions">
                <Link href="/dashboard" className="button primary">
                  View dashboard
                </Link>
                <Link href="/create-advert" className="button primary">
                  Create advert
                </Link>
                <button
                  onClick={logout}
                  className="button primary"
                  style={{ background: '#dc2626' }}
                >
                  Log out
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
