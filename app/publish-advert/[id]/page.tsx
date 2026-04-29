"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PublishAdvertPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const [advert, setAdvert] = useState<any>(null);
  const [promoCode, setPromoCode] = useState("");
  const [message, setMessage] = useState("Loading advert...");

  useEffect(() => {
    async function fetchAdvert() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setMessage("You must be logged in.");
        return;
      }

      const { data, error } = await supabase
        .from("adverts")
        .select("*")
        .eq("id", params.id)
        .eq("seller_id", user.id)
        .single();

      if (error) {
        setMessage(error.message);
      } else {
        setAdvert(data);
        setMessage("");
      }
    }

    if (params.id) fetchAdvert();
  }, [params.id]);

  async function applyPromo() {
    if (promoCode.trim().toUpperCase() !== "LAUNCH") {
      setMessage("Promo code not recognised.");
      return;
    }

    const { error } = await supabase
      .from("adverts")
      .update({
        status: "live",
        promo_code: promoCode.trim().toUpperCase(),
        paid: false,
      })
      .eq("id", params.id);

    if (error) {
      setMessage(error.message);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Publish advert</p>
        <h1>Publish your listing</h1>
        <p>
          Advertise until sold for £9.99, or use a valid launch promo code to
          publish your advert free.
        </p>
      </section>

      <section className="form-section">
        {message && <p>{message}</p>}

        {advert && (
          <div className="advert-form">
            <h2>{advert.title}</h2>
            <p className="listing-price">
              £{Number(advert.price).toLocaleString()}
            </p>
            <p>{Number(advert.mileage).toLocaleString()} miles</p>

            <hr style={{ margin: "24px 0", borderTop: "1px solid var(--line)" }} />

            <h3>Launch promo code</h3>
            <p style={{ color: "var(--muted)" }}>
              Have an early access promo code? Enter it below to publish free.
            </p>

            <input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter promo code"
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                border: "1px solid var(--line)",
                marginBottom: "14px",
              }}
            />

            <button type="button" onClick={applyPromo}>
              Apply promo code and publish
            </button>

            <hr style={{ margin: "28px 0", borderTop: "1px solid var(--line)" }} />

            <h3>Pay £9.99</h3>
            <p style={{ color: "var(--muted)" }}>
              Payment will be connected next.
            </p>

            <button
  type="button"
  onClick={async () => {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ advertId: params.id }),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      setMessage(data.error || "Could not start payment.");
    }
  }}
  style={{ background: "#111827", marginTop: "8px" }}
>
  Pay £9.99 and publish
</button>
          </div>
        )}
      </section>
    </main>
  );
}