"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Confirming payment...");

  useEffect(() => {
    async function confirmPayment() {
      const sessionId = searchParams.get("session_id");

      if (!sessionId) {
        setMessage("Missing payment session.");
        return;
      }

      const res = await fetch("/api/confirm-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage("Payment confirmed. Your advert is now live.");
        setTimeout(() => router.push("/dashboard"), 1500);
      } else {
        setMessage(data.error || "Payment could not be confirmed.");
      }
    }

    confirmPayment();
  }, [searchParams, router]);

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Payment complete</p>
        <h1>{message}</h1>
      </section>
    </main>
  );
}