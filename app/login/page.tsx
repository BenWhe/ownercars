"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth/routes";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setIsSubmitting(true);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("We could not verify your session. Please try signing in again.");
      await supabase.auth.signOut({ scope: "local" });
      setIsSubmitting(false);
      return;
    }

    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    window.location.replace(next || "/dashboard");
  }

  useEffect(() => {
    const supabase = createClient();
    const searchParams = new URLSearchParams(window.location.search);
    const next = safeNextPath(searchParams.get("next"));
    const nextPathTimer = window.setTimeout(() => setNextPath(next), 0);

    async function initialiseSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (searchParams.get("reason") === "session_expired") {
        setMessage("Your session has expired. Please sign in again to continue.");
      }

      if (user) {
        window.location.replace(next || "/dashboard");
      }
    }

    initialiseSession();

    return () => {
      window.clearTimeout(nextPathTimer);
    };
  }, []);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Secure access</p>

        <h1>Sign in to manage your advert</h1>

        <p className="auth-sub">
          OwnerCars protects sellers by keeping contact details hidden and allowing
          only verified buyers to message through the platform.
        </p>

        <form onSubmit={handleLogin} className="auth-form">
          <label>
            Email address
            <input
              required
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label>
            Password
            <input
              required
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <a
            href="/forgot-password"
            style={{ fontSize: "0.85rem", color: "var(--color-muted, #888)", textDecoration: "none", textAlign: "right", display: "block", marginBottom: "4px" }}
          >
            Forgot password?
          </a>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>

          {message && <p className="auth-message">{message}</p>}
        </form>

        <div className="auth-divider">
          <span>New to OwnerCars?</span>
        </div>

        <a
          className="auth-secondary-link"
          href={
            nextPath
              ? `/create-account?next=${encodeURIComponent(nextPath)}`
              : "/create-account"
          }
        >
          Create your account
        </a>
      </section>
    </main>
  );
}
