"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LISTING_PRICE_GBP, STANDARD_LISTING_PRICE_GBP } from "@/lib/payments/config";
import PhotoUploader from "@/app/components/PhotoUploader";

export default function PublishAdvertPage() {
  const params = useParams();
  const advertId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [advert, setAdvert] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState("");
  const [discountedPrice, setDiscountedPrice] = useState(LISTING_PRICE_GBP);
  const [promoMessage, setPromoMessage] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isStartingPayment, setIsStartingPayment] = useState(false);

  const [publishCredits, setPublishCredits] = useState(0);
  const [creditMessage, setCreditMessage] = useState("");
  const [isPublishingWithCredit, setIsPublishingWithCredit] = useState(false);

  const [message, setMessage] = useState("Loading advert...");
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    async function fetchAdvert() {
      const res = await fetch(`/api/adverts/${advertId}`);

      if (res.status === 401) {
        setMessage("You must be logged in.");
        return;
      }

      if (res.status === 403) {
        setMessage("Not authorised to manage this advert.");
        return;
      }

      const result = await res.json();

      if (!res.ok) {
        setMessage(result.error || "Could not load advert.");
        return;
      }

      setAdvert(result.advert);
      // Photos are included in the advert response — no separate browser-client call.
      setPhotos(result.advert?.advert_photos || []);
      if (!result.advert?.postcode || !result.advert?.nearest_town) {
        setLocationError(true);
      }
      if (result.advert?.payment_status === "failed") {
        setPaymentMessage(
          result.advert.payment_failure_reason ||
            "Payment failed. Your advert is still saved — please try again or use another card."
        );
      } else if (result.advert?.payment_status === "expired") {
        setPaymentMessage(
          "That checkout session expired. Your advert is still saved — please start checkout again."
        );
      } else if (result.advert?.payment_status === "cancelled") {
        setPaymentMessage(
          "Checkout was cancelled. Your advert is still saved — you can retry payment below."
        );
      }
      setMessage("");
    }

    if (advertId) fetchAdvert();
  }, [advertId]);

  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch("/api/account");
        if (!res.ok) return;
        const result = await res.json();
        setPublishCredits(result.profile?.publish_credits ?? 0);
      } catch {
        // Non-blocking — if this fails, the credit option just won't show
      }
    }

    fetchCredits();
  }, []);

  async function applyPromo() {
    const code = promoCode.trim().toUpperCase();

    if (!code) {
      setPromoMessage("Enter a promo code first.");
      return;
    }

    setIsApplyingPromo(true);
    setPromoMessage("Checking code...");
    setPaymentMessage("");

    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCode: code }),
      });

      const result = await res.json();

      if (!res.ok) {
        setDiscountedPrice(LISTING_PRICE_GBP);
        setAppliedPromoCode("");
        setPromoMessage(result.error || "That promo code couldn't be applied.");
        return;
      }

      setPromoCode(result.code);
      setAppliedPromoCode(result.code);
      setDiscountedPrice(result.finalAmountGbp);
      setPromoMessage(result.message || "Promo applied.");
    } catch {
      setDiscountedPrice(LISTING_PRICE_GBP);
      setAppliedPromoCode("");
      setPromoMessage("We couldn't check that promo code. Please try again.");
    } finally {
      setIsApplyingPromo(false);
    }
  }

  async function startPayment() {
    const code = appliedPromoCode;

    if (!advertId) {
      setPaymentMessage("We couldn't find this advert. Please refresh and try again.");
      return;
    }

    if (!advert?.postcode || !advert?.nearest_town) {
      setPaymentMessage("Please add the car's location before publishing.");
      return;
    }

    // If the user has typed a promo code but hasn't applied it, block checkout.
    // This prevents a mismatch between the displayed price and the charged amount.
    if (promoCode.trim() && !appliedPromoCode) {
      setPaymentMessage(
        "Please apply your promo code first, or clear the field to pay without a code."
      );
      return;
    }

    setIsStartingPayment(true);
    setMessage("");
    setPaymentMessage("Preparing secure checkout...");

    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          advertId,
          promoCode: code,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : null;

      if (!res.ok) {
        setPaymentMessage(
          data?.error ||
            "We couldn't start payment just now. Please try again in a moment."
        );
        return;
      }

      if (data?.url) {
        setPaymentMessage("Success — redirecting you now...");
        window.location.href = data.url;
        return;
      }

      setPaymentMessage(
        "Checkout did not return a payment link. Please try again in a moment."
      );
    } catch {
      setPaymentMessage(
        "We couldn't reach the payment service. Please check your connection and try again."
      );
    } finally {
      setIsStartingPayment(false);
    }
  }

  async function publishWithCredit() {
    if (!advertId) {
      setCreditMessage("We couldn't find this advert. Please refresh and try again.");
      return;
    }

    if (!advert?.postcode || !advert?.nearest_town) {
      setCreditMessage("Please add the car's location before publishing.");
      return;
    }

    setIsPublishingWithCredit(true);
    setMessage("");
    setCreditMessage("Publishing with your credit...");

    try {
      const res = await fetch("/api/publish-with-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advertId }),
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : null;

      if (!res.ok) {
        setCreditMessage(
          data?.error ||
            "We couldn't publish with a credit just now. Please try again."
        );
        return;
      }

      if (data?.url) {
        setCreditMessage("Success — redirecting you now...");
        window.location.href = data.url;
        return;
      }

      setCreditMessage(
        "Publishing did not return a redirect. Please try again in a moment."
      );
    } catch {
      setCreditMessage(
        "We couldn't reach the server. Please check your connection and try again."
      );
    } finally {
      setIsPublishingWithCredit(false);
    }
  }

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Publish advert</p>
        <h1>Publish your listing</h1>
        <p>
          Upload up to 10 photos, then publish using the £9.99 launch offer or by
          paying £24.99.
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

            {locationError ? (
              <p role="alert" className="auth-message" style={{ marginBottom: "20px" }}>
                Please add the car&apos;s location before publishing.{" "}
                <a href={`/edit-advert/${advertId}`} style={{ color: "inherit", textDecoration: "underline" }}>
                  Edit your advert
                </a>{" "}
                to add a postcode — we show the nearest town to buyers, never the full postcode.
              </p>
            ) : advert.nearest_town ? (
              <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "20px" }}>
                📍 Location: Near {advert.nearest_town}
              </p>
            ) : null}

            <h3>Photos</h3>
            <p style={{ color: "var(--muted)" }}>
              Upload up to 10 photos. The first photo will be used on browse and
              advert pages.
            </p>

            <PhotoUploader
              advertId={advertId ?? ""}
              photos={photos}
              onPhotosChange={setPhotos}
              maxPhotos={10}
            />

            <hr style={{ margin: "28px 0", borderTop: "1px solid var(--line)" }} />

            <h3>Launch offer</h3>
            <p style={{ color: "var(--muted)" }}>
              The launch price is £{LISTING_PRICE_GBP.toFixed(2)} to advertise until sold.
              Standard price is £{STANDARD_LISTING_PRICE_GBP.toFixed(2)}. If you have a separate promo code, you can apply it here.
            </p>

            <input
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                setAppliedPromoCode("");
                setDiscountedPrice(LISTING_PRICE_GBP);
                setPromoMessage("");
                setPaymentMessage("");
              }}
              placeholder="Enter promo code"
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                border: "1px solid var(--line)",
                marginBottom: "14px",
              }}
            />

            <button
              type="button"
              onClick={applyPromo}
              disabled={isApplyingPromo || isStartingPayment || isPublishingWithCredit}
            >
              {isApplyingPromo ? "Checking promo code..." : "Apply promo code"}
            </button>

            {promoMessage && (
              <p
                role="status"
                aria-live="polite"
                style={{
                  marginTop: "14px",
                  padding: "14px 16px",
                  borderRadius: "16px",
                  border: "1px solid rgba(17, 24, 39, 0.12)",
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))",
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                  color: "#111827",
                  fontWeight: 600,
                }}
              >
                {promoMessage}
              </p>
            )}

            {publishCredits >= 1 && (
              <>
                <hr style={{ margin: "28px 0", borderTop: "1px solid var(--line)" }} />

                <h3>Publish with a credit</h3>
                <p style={{ color: "var(--muted)" }}>
                  You have {publishCredits} publish credit{publishCredits === 1 ? "" : "s"}.
                </p>

                <button
                  type="button"
                  onClick={publishWithCredit}
                  disabled={isPublishingWithCredit || isStartingPayment || isApplyingPromo}
                  style={{ background: "#111827", marginTop: "8px" }}
                >
                  {isPublishingWithCredit ? "Publishing..." : "Publish with 1 credit"}
                </button>

                {creditMessage && (
                  <p
                    role="status"
                    aria-live="polite"
                    style={{
                      marginTop: "14px",
                      padding: "14px 16px",
                      borderRadius: "16px",
                      border: "1px solid rgba(17, 24, 39, 0.12)",
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))",
                      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                      color: "#111827",
                      fontWeight: 600,
                    }}
                  >
                    {creditMessage}
                  </p>
                )}
              </>
            )}

            <hr style={{ margin: "28px 0", borderTop: "1px solid var(--line)" }} />

            <h3>Pay £{discountedPrice.toFixed(2)}</h3>

            <p style={{ color: "var(--muted)" }}>
              Pay once and advertise until sold.
            </p>

            <button
              type="button"
              onClick={startPayment}
              disabled={isStartingPayment || isApplyingPromo || isPublishingWithCredit}
              style={{ background: "#111827", marginTop: "8px" }}
            >
              {isStartingPayment
                ? "Preparing checkout..."
                : `Pay £${discountedPrice.toFixed(2)} and publish`}
            </button>

            {paymentMessage && (
              <p
                role="status"
                aria-live="polite"
                style={{
                  marginTop: "14px",
                  padding: "14px 16px",
                  borderRadius: "16px",
                  border: "1px solid rgba(17, 24, 39, 0.12)",
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))",
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                  color: "#111827",
                  fontWeight: 600,
                }}
              >
                {paymentMessage}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
