"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      setMessage("Invalid or expired reset link. Please request a new one.");
      return;
    }

    setIsSubmitting(true);

    const res = await fetch("/api/auth/update-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, access_token, refresh_token }),
    });

    const result = await res.json();
    setIsSubmitting(false);

    if (result.success) {
      setMessage("Password updated. Taking you to your account...");

      if (result.email) {
        const supabase = createClient();
        await supabase.auth.signInWithPassword({ email: result.email, password });
      }

      setTimeout(() => {
        window.location.replace("/account");
      }, 1200);
    } else {
      setMessage(result.error || "Something went wrong. Please try again.");
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">OwnerCars</p>

        <h1>Set a new password</h1>

        <p className="auth-sub">
          Choose a new password for your OwnerCars account.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            New password
            <input
              required
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <label>
            Confirm password
            <input
              required
              type="password"
              placeholder="Repeat your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update password"}
          </button>

          {message && (
            <p className={`auth-message${message.toLowerCase().includes('updated') ? ' auth-message--success' : ''}`}>
              {message}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
