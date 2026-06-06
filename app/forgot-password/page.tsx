"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const result = await res.json();

    setIsSubmitting(false);

    if (result.success) {
      setSubmitted(true);
    } else {
      setMessage(result.error || "Something went wrong. Please try again.");
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">OwnerCars</p>

        <h1>Reset your password</h1>

        <p className="auth-sub">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {submitted ? (
          <p className="auth-message">
            If an account exists for that email, a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
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

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send reset link"}
            </button>

            {message && <p className="auth-message">{message}</p>}
          </form>
        )}

        <div className="auth-divider">
          <span>Remembered it?</span>
        </div>

        <a className="auth-secondary-link" href="/login">
          Back to sign in
        </a>
      </section>
    </main>
  );
}
