"use client";

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth/routes";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
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

  async function handlePasswordReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email) {
      setResetMessage("Enter your email address above first.");
      return;
    }

    setIsSendingReset(true);
    setResetMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=1`,
    });

    setIsSendingReset(false);
    setResetMessage(
      error
        ? error.message
        : "If that email has an OwnerCars account, Supabase will send a password reset link."
    );
  }

  async function handleUpdatePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setIsSubmitting(true);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setMessage("Password updated. Taking you to your dashboard...");
    window.location.replace("/dashboard");
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

      if (searchParams.get("reset") === "1" && user) {
        setIsRecoverySession(true);
        setMessage("Enter a new password to finish your Supabase password reset.");
        return;
      }

      if (user && !searchParams.get("reset")) {
        window.location.replace(next || "/dashboard");
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "PASSWORD_RECOVERY" || (searchParams.get("reset") === "1" && session)) {
        setIsRecoverySession(true);
        setMessage("Enter a new password to finish your Supabase password reset.");
      }
    });

    initialiseSession();

    return () => {
      window.clearTimeout(nextPathTimer);
      subscription.unsubscribe();
    };
  }, []);

  const fromAdvert = !!nextPath?.includes("/advert/");

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Secure access</p>

        <h1>{isRecoverySession ? "Set a new password" : "Sign in to manage your advert"}</h1>

        <p className="auth-sub">
          OwnerCars protects sellers by keeping contact details hidden and allowing
          only verified buyers to message through the platform.
        </p>

        {fromAdvert && !isRecoverySession && (
          <p className="auth-context-banner">
            Your message is saved and ready to send. To protect sellers, only
            verified buyers can contact them — please sign in or create a free
            account to send your message.
          </p>
        )}

        {isRecoverySession ? (
          <form onSubmit={handleUpdatePassword} className="auth-form">
            <label>
              New password
              <input
                required
                minLength={6}
                type="password"
                placeholder="Enter a new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update password"}
            </button>

            {message && <p className="auth-message">{message}</p>}
          </form>
        ) : (
          <>
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

            <form onSubmit={handlePasswordReset} className="auth-inline-form">
              <button type="submit" disabled={isSendingReset}>
                {isSendingReset ? "Sending reset link..." : "Forgotten password?"}
              </button>
              {resetMessage && <p className="auth-message">{resetMessage}</p>}
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
          </>
        )}
      </section>
    </main>
  );
}
