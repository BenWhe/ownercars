"use client";

import { useEffect, useState, FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import GoogleSignInButton from "@/app/components/GoogleSignInButton";

function safeNextPath(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default function CreateAccountPage() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [nextPath, setNextPath] = useState<string | null>(null);

  // Confirmation screen state
  const [signUpComplete, setSignUpComplete] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNextPath(safeNextPath(new URLSearchParams(window.location.search).get("next")));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function handleCreateAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const supabase = createClient();

    // Pass first_name in options.data so it's stored in user_metadata
    // even before email confirmation (no separate updateUser call needed).
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName.trim() },
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setSignedUpEmail(email);
      setSignUpComplete(true);
    }
  }

  async function handleResend() {
    setResending(true);
    setResendMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: signedUpEmail,
    });

    setResending(false);
    setResendMessage(error ? error.message : "Verification email resent — check your inbox.");
  }

  // ── Email verification confirmation screen ───────────────────────────────────
  if (signUpComplete) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">Almost there</p>

          <h1>Check your email</h1>

          <p className="auth-sub">
            We&apos;ve sent a verification link to <strong>{signedUpEmail}</strong>.
            Click the link to activate your account before signing in.
          </p>

          <p style={{ fontSize: 14, color: "var(--muted)", margin: "12px 0 20px" }}>
            Can&apos;t find the email? Check your spam or junk folder.
          </p>

          {resendMessage && (
            <p className="auth-message" style={{ color: resendMessage.startsWith("Verification") ? "var(--accent)" : undefined, marginBottom: 12 }}>
              {resendMessage}
            </p>
          )}

          <button
            type="button"
            className="button secondary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? "Sending…" : "Resend verification email"}
          </button>

          <div className="auth-divider">
            <span>Already verified?</span>
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

  // ── Sign-up form ─────────────────────────────────────────────────────────────
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
