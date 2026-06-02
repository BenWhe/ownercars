"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signOutAndClearSession } from "@/lib/auth/client";

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Support form
  const [supportSubject, setSupportSubject] = useState("Problem with my advert");
  const [supportBody, setSupportBody] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");

  useEffect(() => {
    async function loadUser() {
      // Use the Supabase client directly — getUser() returns full metadata
      // including user_metadata and email_confirmed_at.
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setEmail(user.email ?? null);
        setFirstName(user.user_metadata?.first_name ?? "");
        setEmailConfirmed(!!user.email_confirmed_at);
      }

      setLoading(false);
    }

    loadUser();
  }, []);

  async function handleSaveFirstName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName.trim() },
    });

    setSaving(false);
    setSaveMessage(error ? error.message : "First name saved.");
  }

  async function handleSupportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSupportSending(true);
    setSupportMessage("");

    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: supportSubject, body: supportBody }),
    });

    setSupportSending(false);

    if (res.ok) {
      setSupportMessage("Message sent. We'll be in touch within 2 business days.");
      setSupportBody("");
    } else {
      const result = await res.json().catch(() => ({}));
      setSupportMessage(
        result.error ?? "Something went wrong. Please email support@ownercars.co.uk directly."
      );
    }
  }

  async function handleLogout() {
    await signOutAndClearSession();
  }

  if (loading) {
    return (
      <main>
        <section className="dashboard-hero">
          <p className="eyebrow">Your account</p>
          <h1>Loading…</h1>
        </section>
      </main>
    );
  }

  if (!email) {
    return (
      <main>
        <section className="dashboard-hero">
          <p className="eyebrow">Your account</p>
          <h1>Not signed in</h1>
          <a className="button primary" href="/login">Sign in</a>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Your account</p>
        <h1>Account settings</h1>
      </section>

      <section className="form-section">
        {/* Personal details */}
        <div className="advert-form" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 20 }}>
            Personal details
          </h2>

          <p style={{ color: "var(--muted)", marginBottom: 24 }}>{email}</p>

          <form onSubmit={handleSaveFirstName}>
            <label>
              First name
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (saveMessage) setSaveMessage("");
                }}
                placeholder="Your first name"
              />
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
              <button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              {saveMessage && (
                <p style={{ margin: 0, fontSize: 14, color: saveMessage.startsWith("First") ? "var(--accent)" : "#dc2626" }}>
                  {saveMessage}
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Account status */}
        <div className="advert-form" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 20 }}>
            Account status
          </h2>

          <div style={{ display: "grid", gap: 10 }}>
            <StatusRow label="Account created" complete />
            <StatusRow label="Email verified" complete={emailConfirmed} />
          </div>
        </div>

        {/* Contact support */}
        <div className="advert-form" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 20 }}>
            Contact support
          </h2>

          <form onSubmit={handleSupportSubmit}>
            <label style={{ marginBottom: 16 }}>
              Subject
              <select
                value={supportSubject}
                onChange={(e) => setSupportSubject(e.target.value)}
              >
                <option>Problem with my advert</option>
                <option>Payment issue</option>
                <option>Report a buyer</option>
                <option>Account issue</option>
                <option>Other</option>
              </select>
            </label>

            <label style={{ marginBottom: 16 }}>
              Message
              <textarea
                required
                minLength={20}
                value={supportBody}
                onChange={(e) => {
                  setSupportBody(e.target.value);
                  if (supportMessage) setSupportMessage("");
                }}
                placeholder="Describe your issue in as much detail as possible…"
              />
            </label>

            <button type="submit" disabled={supportSending}>
              {supportSending ? "Sending…" : "Send message"}
            </button>

            {supportMessage && (
              <p style={{
                marginTop: 12,
                fontSize: 14,
                color: supportMessage.startsWith("Message sent") ? "var(--accent)" : "#dc2626",
              }}>
                {supportMessage}
              </p>
            )}
          </form>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a className="button primary" href="/dashboard">Dashboard</a>
          <button
            onClick={handleLogout}
            style={{
              border: "1px solid #fca5a5",
              borderRadius: 999,
              background: "transparent",
              color: "#dc2626",
              padding: "15px 22px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
      </section>
    </main>
  );
}

function StatusRow({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "14px 18px",
        fontSize: 15,
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 800, color: complete ? "#16a34a" : "#94a3b8" }}>
        {complete ? "✓ Complete" : "Pending"}
      </span>
    </div>
  );
}
