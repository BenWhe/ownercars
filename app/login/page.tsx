"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function safeNextPath(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    window.location.href = next || "/dashboard";
  }

  useEffect(() => {
    createClient();
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

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>

          {message && <p className="auth-message">{message}</p>}
        </form>

        <div className="auth-divider">
          <span>New to OwnerCars?</span>
        </div>

        <a className="auth-secondary-link" href="/create-account">
          Create your account
        </a>
      </section>
    </main>
  );
}
