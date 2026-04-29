"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function EditAdvertPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("Loading advert...");

  useEffect(() => {
    async function fetchAdvert() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setMessage("You must be logged in to edit this advert.");
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
        setTitle(data.title || "");
        setPrice(String(data.price || ""));
        setMileage(String(data.mileage || ""));
        setDescription(data.description || "");
        setMessage("");
      }
    }

    if (params.id) fetchAdvert();
  }, [params.id]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    const { error } = await supabase
      .from("adverts")
      .update({
        title,
        price: Number(price),
        mileage: Number(mileage),
        description,
      })
      .eq("id", params.id)
      .eq("seller_id", user.id);

    if (error) {
      setMessage(error.message);
    } else {
      router.push("/dashboard");
    }
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

            <button type="submit">Save changes</button>
          </form>
        )}
      </section>
    </main>
  );
}