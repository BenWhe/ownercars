"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateAccountPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleCreateAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Account created. You can now sign in.");
      setTimeout(() => router.push("/login"), 1200);
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

          <button type="submit">Create account</button>

          {message && <p className="auth-message">{message}</p>}
        </form>

        <div className="auth-divider">
          <span>Already have an account?</span>
        </div>

        <a className="auth-secondary-link" href="/login">
          Sign in
        </a>
      </section>
    </main>
  );
}