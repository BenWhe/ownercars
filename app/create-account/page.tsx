"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeNextPath(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default function CreateAccountPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [postcode, setPostcode] = useState("");
  const [postcodeError, setPostcodeError] = useState("");
  const [message, setMessage] = useState("");
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNextPath(safeNextPath(new URLSearchParams(window.location.search).get("next")));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function handleCreateAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPostcodeError("");

    // Validate postcode before signup
    if (postcode.trim()) {
      const geoRes = await fetch(`/api/geocode?postcode=${encodeURIComponent(postcode.trim())}`);
      if (!geoRes.ok) {
        setPostcodeError("Please enter a valid UK postcode.");
        return;
      }
    }

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { postcode: postcode.trim() || null },
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      // Save postcode to profile if user has a session (auto-confirm enabled)
      if (data.session && postcode.trim()) {
        try {
          const geoRes = await fetch(`/api/geocode?postcode=${encodeURIComponent(postcode.trim())}`);
          const geoResult = await geoRes.json();
          if (geoRes.ok) {
            await fetch("/api/account", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                postcode: geoResult.postcode,
                latitude: geoResult.latitude,
                longitude: geoResult.longitude,
              }),
            });
          }
        } catch {
          // Non-blocking — postcode can be set from account page
        }
      }

      const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));

      setMessage(
        next
          ? data.session
            ? "Account created. Taking you back to your advert..."
            : "Account created. Sign in to continue your advert."
          : "Account created. You can now sign in."
      );
      setTimeout(() => {
        if (next && data.session) {
          window.location.href = next;
          return;
        }

        if (next) {
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }

        router.push("/login");
      }, 1200);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Create account</p>

        <h1>Start selling privately</h1>

        <p className="auth-sub">
          Create your OwnerCars account to list your car, manage your advert and
          keep your seller details protected.
        </p>

        <form onSubmit={handleCreateAccount} className="auth-form">
          <label>
            Email address
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <label>
            Your postcode
            <input
              type="text"
              placeholder="e.g. DT6 3NP"
              value={postcode}
              onChange={(e) => { setPostcode(e.target.value); setPostcodeError(""); }}
              maxLength={8}
            />
            <p className="field-hint">Used to show distances to adverts and to help buyers find cars near them. Never shown to anyone.</p>
            {postcodeError && <p className="field-error" role="alert">{postcodeError}</p>}
          </label>

          <button type="submit">Create account</button>

          {message && <p className="auth-message">{message}</p>}
        </form>

        <div className="auth-divider">
          <span>Already have an account?</span>
        </div>

        <a
          className="auth-secondary-link"
          href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}
        >
          Sign in
        </a>
      </section>
    </main>
  );
}