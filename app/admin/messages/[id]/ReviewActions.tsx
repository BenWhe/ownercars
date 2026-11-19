"use client";

import { useState } from "react";

type Status = "held" | "delivered" | "rejected";

export default function ReviewActions({
  messageId,
  token,
  initialStatus,
}: {
  messageId: string;
  token: string;
  initialStatus: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [pending, setPending] = useState<"release" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function act(action: "release" | "reject") {
    setPending(action);
    setError("");

    try {
      const res = await fetch(`/api/admin/messages/${messageId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Could not complete that action.");
        return;
      }

      setStatus(result.delivery_status);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  if (status === "delivered") {
    return <p className="auth-message auth-message--success">✓ Released — delivered to the recipient.</p>;
  }

  if (status === "rejected") {
    return <p className="auth-message">Rejected — hidden from the recipient.</p>;
  }

  return (
    <div>
      <div className="save-advert-actions">
        <button
          className="button primary"
          type="button"
          onClick={() => act("release")}
          disabled={pending !== null}
        >
          {pending === "release" ? "Releasing…" : "Release"}
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() => act("reject")}
          disabled={pending !== null}
        >
          {pending === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
      {error && <p className="auth-message" role="alert">{error}</p>}
    </div>
  );
}
