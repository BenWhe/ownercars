"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function PaymentCancelledContent() {
  const searchParams = useSearchParams();
  const advertId = searchParams.get("advert_id");
  const [message, setMessage] = useState(
    "Your card has not been charged. You can safely retry checkout when you're ready."
  );

  useEffect(() => {
    if (!advertId) return;

    let isActive = true;

    async function markCancelled() {
      try {
        const res = await fetch("/api/payment-cancelled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ advertId }),
        });

        if (!isActive) return;

        if (!res.ok) {
          setMessage(
            "Your card has not been charged. If this advert still says pending payment, open it from your dashboard and retry checkout."
          );
        }
      } catch {
        if (!isActive) return;
        setMessage(
          "Your card has not been charged. If this advert still says pending payment, open it from your dashboard and retry checkout."
        );
      }
    }

    markCancelled();

    return () => {
      isActive = false;
    };
  }, [advertId]);

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Payment not completed</p>
        <h1>No problem — your advert is still saved.</h1>
        <p>{message}</p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {advertId && (
            <Link className="button primary" href={`/publish-advert/${advertId}`}>
              Try payment again
            </Link>
          )}
          <Link className="button" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function PaymentCancelledPage() {
  return (
    <Suspense
      fallback={
        <main>
          <section className="dashboard-hero">
            <p className="eyebrow">Payment not completed</p>
            <h1>No problem — your advert is still saved.</h1>
            <p>Your card has not been charged.</p>
          </section>
        </main>
      }
    >
      <PaymentCancelledContent />
    </Suspense>
  );
}
