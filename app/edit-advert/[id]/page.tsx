"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LISTING_PRICE_GBP } from "@/lib/payments/config";

export default function EditAdvertPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [paid, setPaid] = useState(false);
  const [message, setMessage] = useState("Loading advert...");
  const [photos, setPhotos] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAdvert() {
      const res = await fetch(`/api/adverts/${params.id}`);

      if (res.status === 401) {
        setMessage("You must be logged in to edit this advert.");
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

      const data = result.advert;
      setTitle(data.title || "");
      setPrice(String(data.price || ""));
      setMileage(String(data.mileage || ""));
      setDescription(data.description || "");
      setStatus(data.status || "draft");
      setPaid(Boolean(data.paid));
      setMessage("");
      await fetchPhotos();
    }

    if (params.id) fetchAdvert();
  }, [params.id]);

  async function fetchPhotos() {
    const { data } = await supabase
      .from("advert_photos")
      .select("*")
      .eq("advert_id", params.id)
      .order("sort_order", { ascending: true });

    setPhotos(data || []);
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || !params.id) return;

    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );

    if (imageFiles.length === 0) return;

    if (photos.length + imageFiles.length > 10) {
      setMessage("You can upload up to 10 photos per advert.");
      return;
    }

    setMessage("Uploading photos...");

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("advertId", params.id as string);
      formData.append("sortOrder", String(photos.length + i));

      const res = await fetch("/api/upload-photo", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        setMessage(result.error || "Photo upload failed. Please try again.");
        return;
      }
    }

    setMessage("");
    await fetchPhotos();
  }

  async function deletePhoto(photoId: string) {
    const res = await fetch("/api/upload-photo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    });

    const result = await res.json();

    if (!res.ok) {
      setMessage(result.error || "Could not delete photo. Please try again.");
      return;
    }

    await fetchPhotos();
  }

  async function movePhoto(index: number, direction: "left" | "right") {
    const newIndex = direction === "left" ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= photos.length) return;

    const currentPhoto = photos[index];
    const targetPhoto = photos[newIndex];

    const { error: firstError } = await supabase
      .from("advert_photos")
      .update({ sort_order: targetPhoto.sort_order })
      .eq("id", currentPhoto.id);

    if (firstError) {
      setMessage(firstError.message);
      return;
    }

    const { error: secondError } = await supabase
      .from("advert_photos")
      .update({ sort_order: currentPhoto.sort_order })
      .eq("id", targetPhoto.id);

    if (secondError) {
      setMessage(secondError.message);
      return;
    }

    await fetchPhotos();
  }

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const res = await fetch(`/api/adverts/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        price: Number(price),
        mileage: Number(mileage),
        description,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setMessage(result.error || "Could not save changes.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Edit advert</p>
        <h1>Update your listing</h1>
        <p>Keep your advert accurate so buyers see the latest price, mileage and description.</p>
      </section>

      <section className="form-section">
        {message && <p>{message}</p>}

        {!message && (status === "draft" || status === "pending_payment") && (
          <div className="draft-warning">
            <h3>This advert is not live yet</h3>
            <p>
              Your advert is not published yet. Add photos, then continue to publish
              for the £{LISTING_PRICE_GBP.toFixed(2)} launch price.
            </p>
            <Link href={`/publish-advert/${params.id}`}>
              Continue to publish
            </Link>
          </div>
        )}

        {!message && (
          <form className="advert-form" onSubmit={handleUpdate}>
            <label>
              Advert title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2019 BMW 3 Series"
              />
            </label>

            <label>
              Price
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="18995"
                type="number"
              />
            </label>

            <label>
              Mileage
              <input
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                placeholder="42000"
                type="number"
              />
            </label>

            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the vehicle..."
              />
            </label>

            <h3 style={{ marginTop: "24px" }}>Photos</h3>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => uploadPhotos(e.target.files)}
            />

            {photos.length === 0 && (
              <p style={{ color: "var(--muted)" }}>
                No photos uploaded yet.
              </p>
            )}

            {photos.length > 0 && (
              <div className="photo-manage-grid">
                {photos.map((photo, index) => (
                  <div className="photo-manage-card" key={photo.id}>
                    <img src={photo.image_url} alt="Advert photo" />

                    <div className="photo-manage-actions">
                      {index !== 0 && (
                        <button
                          type="button"
                          onClick={() => movePhoto(index, "left")}
                        >
                          Make main
                        </button>
                      )}

                      <button
                        type="button"
                        className="remove-photo-button"
                        onClick={() => deletePhoto(photo.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button type="submit">Save changes</button>
          </form>
        )}
      </section>
    </main>
  );
}
