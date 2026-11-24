"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkName, NAME_PROBLEM_MESSAGES } from "@/lib/security/identityChecks";

function safeNextPath(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default function CreateAccountPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameError, setNameError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [postcode, setPostcode] = useState("");
  const [postcodeError, setPostcodeError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "notice">("error");
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
    setNameError("");

    // First name and surname are required. Only problems a genuine person
    // can fix are reported here; names that merely look made up are allowed
    // and flagged for review when the account first messages a seller.
    const nameProblem = checkName(firstName, lastName);
    if (nameProblem && nameProblem !== "suspect") {
      setNameError(NAME_PROBLEM_MESSAGES[nameProblem]);
      return;
    }
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    // Postcode is required and must be a real UK postcode
    if (!postcode.trim()) {
      setPostcodeError("Please enter your postcode.");
      return;
    }
    const geoCheck = await fetch(`/api/geocode?postcode=${encodeURIComponent(postcode.trim())}`);
    if (!geoCheck.ok) {
      setPostcodeError("Please enter a valid UK postcode.");
      return;
    }

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          postcode: postcode.trim(),
          full_name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("for security purposes") || msg.includes("after")) {
        setMessageType("notice");
        setMessage("Please wait a few seconds and try again.");
      } else if (msg.includes("already registered") || msg.includes("already been registered")) {
        setMessageType("error");
        setMessage("An account with this email already exists. Try logging in instead.");
      } else if (msg.includes("password")) {
        setMessageType("error");
        setMessage("Please choose a password with at least 6 characters.");
      } else {
        setMessageType("error");
        setMessage("Something went wrong creating your account. Please try again.");
      }
    } else {
      // Save name (and postcode, if given) to the profile when the user has a
      // session (auto-confirm enabled). Without a session the values are still
      // captured in user_metadata at signup above and can be synced later.
      if (data.session) {
        try {
          const profileUpdate: {
            full_name: string;
            postcode?: string;
            latitude?: number;
            longitude?: number;
          } = { full_name: fullName };

          if (postcode.trim()) {
            const geoRes = await fetch(`/api/geocode?postcode=${encodeURIComponent(postcode.trim())}`);
            const geoResult = await geoRes.json();
            if (geoRes.ok) {
              profileUpdate.postcode = geoResult.postcode;
              profileUpdate.latitude = geoResult.latitude;
              profileUpdate.longitude = geoResult.longitude;
            }
          }

          await fetch("/api/account", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(profileUpdate),
          });
        } catch {
          // Non-blocking — name/postcode can be set from the account page
        }
      }

      const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));

      setMessageType("success");
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
            First name
            <input
              type="text"
              placeholder="e.g. Jane"
              value={firstName}
              onChange={(e) => { setFirstName(e.target.value); setNameError(""); }}
              autoComplete="given-name"
              maxLength={40}
            />
          </label>

          <label>
            Surname
            <input
              type="text"
              placeholder="e.g. Smith"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); setNameError(""); }}
              autoComplete="family-name"
              maxLength={40}
            />
            <p className="field-hint">For our records. Never shown on adverts or to other users.</p>
            {nameError && <p className="field-error" role="alert">{nameError}</p>}
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

          <label>
            Your postcode
            <input
              type="text"
              placeholder="e.g. DT6 3NP"
              value={postcode}
              onChange={(e) => { setPostcode(e.target.value); setPostcodeError(""); }}
              maxLength={8}
            />
            <p className="field-hint">Your home postcode. Used to show distances to adverts and to help buyers find cars near them. Never shown to anyone.</p>
            {postcodeError && <p className="field-error" role="alert">{postcodeError}</p>}
          </label>

          <button type="submit">Create account</button>

          <p className="auth-legal-notice">
            By creating an account you agree to our{" "}
            <a href="/terms">Terms of Service</a> and{" "}
            <a href="/privacy">Privacy Policy</a>.
          </p>

          {message && <p className={`auth-message${messageType !== "error" ? ` auth-message--${messageType}` : ""}`}>{message}</p>}
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