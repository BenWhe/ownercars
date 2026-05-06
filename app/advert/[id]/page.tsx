"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function capitaliseWords(str?: string) {
  if (!str) return "";
  return str
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function advertDisplayTitle(advert: any) {
  const title = `${advert.year || ""} ${capitaliseWords(
    advert.make
  )} ${capitaliseWords(advert.model)}`.trim();

  return title || advert.title || "Private car advert";
}

export default function AdvertPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [advert, setAdvert] = useState<any>(null);
  const [message, setMessage] = useState("Loading advert...");
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    async function fetchAdvert() {
      const { data, error } = await supabase
        .from("adverts")
        .select("*, advert_photos(*)")
        .eq("id", params.id)
        .eq("status", "live")
        .maybeSingle();

      if (error) {
        setMessage(error.message);
      } else if (!data) {
        setMessage("This advert isn’t live yet.");
      } else {
        setAdvert(data);
        setMessage("");
      }
    }

    if (params.id) fetchAdvert();
  }, [params.id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (activeIndex === null || !advert?.advert_photos?.length) return;

      if (e.key === "Escape") {
        setActiveIndex(null);
      }

      if (e.key === "ArrowLeft") {
        setActiveIndex(
          (activeIndex - 1 + advert.advert_photos.length) %
            advert.advert_photos.length
        );
      }

      if (e.key === "ArrowRight") {
        setActiveIndex((activeIndex + 1) % advert.advert_photos.length);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, advert]);

  async function handleMessageSeller() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      router.push("/login");
      return;
    }

    if (!advert?.seller_id) {
      alert("Seller details missing.");
      return;
    }

    if (user.id === advert.seller_id) {
      alert("You cannot message your own advert.");
      return;
    }

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("advert_id", advert.id)
      .eq("buyer_id", user.id)
      .eq("seller_id", advert.seller_id)
      .maybeSingle();

    if (existing) {
      router.push(`/messages/${existing.id}`);
      return;
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        advert_id: advert.id,
        buyer_id: user.id,
        seller_id: advert.seller_id,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    router.push(`/messages/${data.id}`);
  }

  if (message) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">Advert unavailable</p>
          <h1>{message}</h1>
          <p className="auth-sub">This advert has not been published yet.</p>

          <div style={{ display: "grid", gap: "10px", marginTop: "20px" }}>
            <a
              href={`/publish-advert/${params.id}`}
              className="auth-secondary-link"
            >
              Continue publishing
            </a>

            <a href="/dashboard" className="auth-secondary-link">
              Go to dashboard
            </a>
          </div>
        </section>
      </main>
    );
  }

  const displayTitle = advertDisplayTitle(advert);

  return (
    <main>
      <section className="form-section">
        <div className="advert-form">
          {advert.advert_photos?.[0]?.image_url ? (
            <img
              className="advert-photo-main-img"
              src={advert.advert_photos[0].image_url}
              alt={displayTitle}
              onClick={() => setActiveIndex(0)}
              style={{ cursor: "zoom-in" }}
            />
          ) : (
            <div className="advert-photo-main"></div>
          )}

          {advert.advert_photos?.length > 1 && (
            <div className="advert-thumbs">
              {advert.advert_photos.slice(1, 5).map((photo: any, i: number) => (
                <img
                  key={photo.id}
                  src={photo.image_url}
                  alt={`${displayTitle} thumbnail ${i + 2}`}
                  onClick={() => setActiveIndex(i + 1)}
                  style={{ cursor: "zoom-in" }}
                />
              ))}
            </div>
          )}

          <div className="advert-heading-block">
            <p className="advert-kicker">Private seller advert</p>

            <h1 className="advert-title">{displayTitle}</h1>

            <div className="advert-summary-row">
              <span className="advert-price">
                £{Number(advert.price).toLocaleString()}
              </span>

              <span className="advert-mileage">
                {Number(advert.mileage).toLocaleString()} miles
              </span>
            </div>

            <div className="advert-actions">
              <button
                className="secure-message-button"
                onClick={handleMessageSeller}
              >
                Message seller
              </button>
            </div>
          </div>

          <div className="spec-grid">
            <div>
              <strong>Make</strong>
              <span>{advert.make ? capitaliseWords(advert.make) : "—"}</span>
            </div>

            <div>
              <strong>Model</strong>
              <span>{advert.model ? capitaliseWords(advert.model) : "—"}</span>
            </div>

            <div>
              <strong>Year</strong>
              <span>{advert.year || "—"}</span>
            </div>

            <div>
              <strong>Gearbox</strong>
              <span>{advert.gearbox || "—"}</span>
            </div>

            <div>
              <strong>Body type</strong>
              <span>{advert.body_type || "—"}</span>
            </div>

            <div>
              <strong>Colour</strong>
              <span>{advert.colour ? capitaliseWords(advert.colour) : "—"}</span>
            </div>

            <div>
              <strong>Doors</strong>
              <span>{advert.doors || "—"}</span>
            </div>

            <div>
              <strong>Seats</strong>
              <span>{advert.seats || "—"}</span>
            </div>

            <div>
              <strong>Fuel type</strong>
              <span>{advert.fuel_type || "—"}</span>
            </div>

            <div>
              <strong>Written off?</strong>
              <span>{advert.previously_written_off || "—"}</span>
            </div>
          </div>

          <div className="advert-description">
            {advert.description
              ?.replace(/\n{3,}/g, "\n\n")
              .split("\n")
              .map((line: string, i: number) =>
                line.trim() === "" ? (
                  <div key={i} className="advert-description-gap" />
                ) : (
                  <p key={i}>{line}</p>
                )
              )}
          </div>
        </div>
      </section>

      {activeIndex !== null && (
        <div
          className="lightbox"
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;

            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX.current - touchEndX;

            if (Math.abs(diff) > 50) {
              if (diff > 0) {
                setActiveIndex((activeIndex + 1) % advert.advert_photos.length);
              } else {
                setActiveIndex(
                  (activeIndex - 1 + advert.advert_photos.length) %
                    advert.advert_photos.length
                );
              }
            }

            touchStartX.current = null;
          }}
        >
          <button className="lightbox-close" onClick={() => setActiveIndex(null)}>
            ✕
          </button>

          <div className="lightbox-counter">
            {activeIndex + 1} / {advert.advert_photos.length}
          </div>

          <button
            className="lightbox-prev"
            onClick={() =>
              setActiveIndex(
                (activeIndex - 1 + advert.advert_photos.length) %
                  advert.advert_photos.length
              )
            }
          >
            ‹
          </button>

          <img
            src={advert.advert_photos[activeIndex].image_url}
            className="lightbox-image"
            alt={displayTitle}
          />

          <button
            className="lightbox-next"
            onClick={() =>
              setActiveIndex((activeIndex + 1) % advert.advert_photos.length)
            }
          >
            ›
          </button>
        </div>
      )}
    </main>
  );
}