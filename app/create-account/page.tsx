"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GoogleSignInButton from "@/app/components/GoogleSignInButton";

function safeNextPath(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default function CreateAccountPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      // Save first name to user metadata immediately after sign-up.
      await supabase.auth.updateUser({ data: { first_name: firstName.trim() } });

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

        <GoogleSignInButton nextPath={nextPath} />
        <div className="auth-divider">
          <span>or</span>
        </div>

        <form onSubmit={handleCreateAccount} className="auth-form">
          <label>
            First name
            <input
              required
              type="text"
              placeholder="Your first name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>

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