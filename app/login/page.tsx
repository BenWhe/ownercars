"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Logged in successfully.");
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Account created. You can now log in.");
      setMode("login");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-bold tracking-tight text-blue-600">
            OwnerCars
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-700 md:flex">
            <Link href="/browse">Browse cars</Link>
            <Link href="/create-advert">Sell your car</Link>
            <Link href="/dashboard">Dashboard</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <p className="font-semibold text-blue-600">Secure access</p>
          <h1 className="mt-3 max-w-2xl text-5xl font-bold tracking-tight">
            Sign in to manage your private car advert.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            OwnerCars protects sellers by keeping contact details hidden and
            allowing verified buyers to message through the platform.
          </p>

          <div className="mt-8 grid max-w-xl gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-2xl">🔒</p>
              <h2 className="mt-3 font-bold">Details protected</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Your phone number and email stay hidden from buyers.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-2xl">✅</p>
              <h2 className="mt-3 font-bold">Verified buyers</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Buyers verify before messaging private sellers.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-6 flex rounded-full bg-slate-100 p-1">
            <button
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                mode === "login"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Login
            </button>

            <button
              onClick={() => {
                setMode("register");
                setMessage("");
              }}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                mode === "register"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Create account
            </button>
          </div>

          <h2 className="text-2xl font-bold">
            {mode === "login" ? "Welcome back" : "Create your OwnerCars account"}
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            {mode === "login"
              ? "Log in to view your dashboard and messages."
              : "Create an account to advertise or message sellers securely."}
          </p>

          <form
            onSubmit={mode === "login" ? handleLogin : handleSignup}
            className="mt-6 space-y-4"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Email address
              </span>
              <input
                required
                type="email"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Password
              </span>
              <input
                required
                type="password"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-full bg-blue-600 px-7 py-4 font-semibold text-white hover:bg-blue-700"
            >
              {mode === "login" ? "Login" : "Create account"}
            </button>
          </form>

          {message && (
            <p className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-800">
              {message}
            </p>
          )}

          <p className="mt-6 text-center text-xs leading-5 text-slate-500">
            By using OwnerCars, you agree to use the platform honestly and only
            advertise as a genuine private seller.
          </p>
        </div>
      </section>
    </main>
  );
}