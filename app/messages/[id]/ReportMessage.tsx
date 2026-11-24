"use client";

import { useState } from "react";
import { REPORT_REASONS, type ReportReason } from "@/lib/messages/reportReasons";

// "Report" link under a message you received. Opens a short reason list;
// the report goes to OwnerCars and the sender's messages are held for
// review until it has been looked at.
export default function ReportMessage({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  if (state === "done") {
    return <p className="message-report-done">Reported. Thank you, we&rsquo;ll look into it.</p>;
  }

  if (!open) {
    return (
      <button type="button" className="message-report-link" onClick={() => setOpen(true)}>
        Report this message
      </button>
    );
  }

  async function submit() {
    if (!reason) {
      setError("Please choose a reason.");
      return;
    }
    setState("sending");
    setError("");
    const res = await fetch("/api/messages/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, reason }),
    });
    if (res.ok) {
      setState("done");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not send your report.");
      setState("error");
    }
  }

  return (
    <div className="message-report-form">
      <p>Why are you reporting this message?</p>
      {(Object.keys(REPORT_REASONS) as ReportReason[]).map((key) => (
        <label key={key}>
          <input
            type="radio"
            name={`report-${messageId}`}
            value={key}
            checked={reason === key}
            onChange={() => setReason(key)}
          />{" "}
          {REPORT_REASONS[key]}
        </label>
      ))}
      <div className="message-report-actions">
        <button type="button" onClick={submit} disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send report"}
        </button>
        <button type="button" className="secondary-link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
