"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdvertPage() {
  const supabase = createClient();
  const params = useParams();

  const [advert, setAdvert] = useState<any>(null);
  const [message, setMessage] = useState("Loading advert...");

  useEffect(() => {
    async function fetchAdvert() {
      const { data, error } = await supabase
        .from("adverts")
        .select("*, advert_photos(*)")
        .eq("id", params.id)
        .eq("status", "live")
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

  if (message) {
    return (
      <main>
        <section className="dashboard-hero">
          <h1>{message}</h1>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="form-section">
        <div className="advert-form">
          {/* MAIN IMAGE */}
          {advert.advert_photos?.[0]?.image_url ? (
            <img
              className="advert-photo-main-img"
              src={advert.advert_photos[0].image_url}
              alt={advert.title}
            />
          ) : (
            <div className="advert-photo-main"></div>
          )}

          {/* THUMBNAILS */}
          {advert.advert_photos?.length > 1 && (
            <div className="advert-thumbs">
              {advert.advert_photos.slice(1, 5).map((photo: any) => (
                <img key={photo.id} src={photo.image_url} />
              ))}
            </div>
          )}

          <h1>{advert.title}</h1>
          <p className="listing-price">
            £{Number(advert.price).toLocaleString()}
          </p>
          <p>{Number(advert.mileage).toLocaleString()} miles</p>

          <p style={{ marginTop: "20px" }}>{advert.description}</p>
        </div>
      </section>
    </main>
  );
}