"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PublishAdvertPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const advertId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [advert, setAdvert] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);

  const [promoCode, setPromoCode] = useState("");
  const [discountedPrice, setDiscountedPrice] = useState(9.99);
  const [promoMessage, setPromoMessage] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isStartingPayment, setIsStartingPayment] = useState(false);

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
        .eq("id", advertId)
        .eq("seller_id", user.id)
        .single();

      if (error) {
        setMessage(error.message);
      } else {
        setAdvert(data);
        setMessage("");
        await fetchPhotos();
      }
    }

    if (advertId) fetchAdvert();
  }, [advertId]);

  async function fetchPhotos() {
    const { data } = await supabase
      .from("advert_photos")
      .select("*")
      .eq("advert_id", advertId)
      .order("sort_order", { ascending: true });

    setPhotos(data || []);
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || !advertId) return;

    if (photos.length + files.length > 10) {
      setMessage("You can upload up to 10 photos per advert.");
      return;
    }

    setMessage("Uploading photos...");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split(".").pop();
      const filePath = `${advertId}/${Date.now()}-${i}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("advert-photos")
        .upload(filePath, file);

      if (uploadError) {
        setMessage(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("advert-photos")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("advert_photos").insert({
        advert_id: advertId,
        image_url: publicUrlData.publicUrl,
        sort_order: photos.length + i,
      });

      if (dbError) {
        setMessage(dbError.message);
        return;
      }
    }

    setMessage("");
    await fetchPhotos();
  }

  async function applyPromo() {
    const code = promoCode.trim().toUpperCase();

    if (!code) {
      setPromoMessage("Enter a promo code first.");
      return;
    }

    setIsApplyingPromo(true);
    setPromoMessage("Checking code...");
    setPaymentMessage("");

    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();

    setIsApplyingPromo(false);

    if (error) {
      setPromoMessage(
        "We couldn't check that code in the browser. You can still continue — it will be validated securely at payment."
      );
      return;
    }

    if (!data) {
      setDiscountedPrice(9.99);
      setPromoMessage("That promo code wasn't recognised.");
      return;
    }

    if (data.max_uses && data.uses >= data.max_uses) {
      setDiscountedPrice(9.99);
      setPromoMessage("This code has expired.");
      return;
    }

    if (data.discount_type === "free") {
      setDiscountedPrice(0);
    }

    if (data.discount_type === "fixed") {
      setDiscountedPrice(Math.max(0, 9.99 - data.discount_value));
    }

    setPromoCode(code);
    setPromoMessage("Promo applied. Final validation happens securely when you publish.");
  }

  async function startPayment() {
    const code = promoCode.trim().toUpperCase();

    if (!advertId) {
      setPaymentMessage("We couldn't find this advert. Please refresh and try again.");
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

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Publish advert</p>
        <h1>Publish your listing</h1>
        <p>
          Upload up to 10 photos, then publish using the £2.50 launch offer or by
          paying £9.99.
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

            <h3>Photos</h3>
            <p style={{ color: "var(--muted)" }}>
              Upload up to 10 photos. The first photo will be used on browse and
              advert pages.
            </p>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => uploadPhotos(e.target.files)}
            />

            {photos.length > 0 && (
              <div className="photo-preview-grid">
                {photos.map((photo) => (
                  <div className="photo-preview-item" key={photo.id}>
                    <img src={photo.image_url} alt="Advert photo" />
                    <button
                      type="button"
                      onClick={async () => {
                        const { error } = await supabase
                          .from("advert_photos")
                          .delete()
                          .eq("id", photo.id);

                        if (error) {
                          setMessage(error.message);
                        } else {
                          await fetchPhotos();
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            <hr style={{ margin: "28px 0", borderTop: "1px solid var(--line)" }} />

            <h3>Apply launch offer</h3>
            <p style={{ color: "var(--muted)" }}>
              Enter launch code LAUNCH250 to advertise until sold for £2.50.
              Standard price is £9.99
            </p>

            <input
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
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
              disabled={isApplyingPromo || isStartingPayment}
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

            <hr style={{ margin: "28px 0", borderTop: "1px solid var(--line)" }} />

            <h3>Pay £{discountedPrice.toFixed(2)}</h3>

            <p style={{ color: "var(--muted)" }}>
              Pay once and advertise until sold.
            </p>

            <button
              type="button"
              onClick={startPayment}
              disabled={isStartingPayment || isApplyingPromo}
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
