"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState(
    "Confirming your payment with Stripe..."
  );

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    let isActive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function confirmPayment(attempt = 1) {
      if (!sessionId) {
        setMessage("Payment received. Returning you to your dashboard...");
        timer = setTimeout(() => router.push("/dashboard"), 2000);
        return;
      }

      try {
        const res = await fetch("/api/confirm-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const result = await res.json();

        if (!isActive) return;

        if (res.ok && result.status === "published") {
          setMessage("Your advert is live now. Returning you to your dashboard...");
          timer = setTimeout(() => router.push("/dashboard"), 2000);
          return;
        }

        if (res.ok && result.status === "awaiting_webhook" && attempt < 5) {
          setMessage(
            "Payment confirmed. Waiting for Stripe's secure webhook to publish your advert..."
          );
          timer = setTimeout(() => confirmPayment(attempt + 1), 2000);
          return;
        }

        setMessage(
          result.message ||
            "Stripe has received your payment. Your advert will go live as soon as confirmation finishes."
        );
        timer = setTimeout(() => router.push("/dashboard"), 4000);
      } catch {
        if (!isActive) return;
        setMessage(
          "Stripe has received your payment. Your advert will go live as soon as confirmation finishes."
        );
        timer = setTimeout(() => router.push("/dashboard"), 4000);
      }
    }

    confirmPayment();

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [router, searchParams]);

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Payment complete</p>
        <h1>Thanks — your payment has been received.</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <main>
          <section className="dashboard-hero">
            <p className="eyebrow">Payment complete</p>
            <h1>Thanks — your payment has been received.</h1>
            <p>Confirming your payment with Stripe...</p>
          </section>
        </main>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
