"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props =
  | { kind: "message"; messageId: string; token?: string; onDone?: (status: string) => void }
  | { kind: "account"; userId: string; suspended: boolean };

export default function ModerationButtons(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function act(action: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setResult(null);
    const payload =
      props.kind === "message"
        ? { action, messageId: props.messageId, token: props.token }
        : { action, userId: props.userId };
    const res = await fetch("/api/admin/moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setResult(data.error ?? "Something went wrong.");
      return;
    }
    const status = data.status ?? (action === "unsuspend" ? "unsuspended" : action === "suspend" ? "suspended" : "done");
    setResult(
      status === "delivered" ? "Approved and delivered." : status === "rejected" ? "Rejected." : status === "suspended" ? "Account suspended." : status === "unsuspended" ? "Suspension lifted." : "Done."
    );
    if (props.kind === "message") props.onDone?.(status);
    router.refresh();
  }

  if (props.kind === "account") {
    return (
      <div className="sec-actions">
        {props.suspended ? (
          <button className="sec-btn" disabled={busy} onClick={() => act("unsuspend", "Lift the suspension? The account will be able to sign in again, and its messages will be held for review.")}>
            Lift suspension
          </button>
        ) : (
          <button className="sec-btn danger" disabled={busy} onClick={() => act("suspend", "Suspend this account? It will be signed out, can't sign in or message, and anything pending is rejected. Nothing is deleted.")}>
            Suspend account
          </button>
        )}
        {result && <span className="sec-result">{result}</span>}
      </div>
    );
  }

  return (
    <div className="sec-actions">
      <button className="sec-btn approve" disabled={busy} onClick={() => act("approve")}>
        Approve and deliver
      </button>
      <button className="sec-btn" disabled={busy} onClick={() => act("reject")}>
        Reject
      </button>
      <button className="sec-btn danger" disabled={busy} onClick={() => act("reject_suspend", "Reject this message and suspend the account? Nothing is deleted.")}>
        Reject and suspend account
      </button>
      {result && <span className="sec-result">{result}</span>}
    </div>
  );
}
