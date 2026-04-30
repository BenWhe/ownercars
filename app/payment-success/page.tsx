"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Payment complete</p>
        <h1>Thanks — your payment has been received.</h1>
        <p>Your advert should appear as live once Stripe confirms the payment.</p>
      </section>
    </main>
  );
}