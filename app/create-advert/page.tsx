"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateAdvertPage() {
  const supabase = createClient();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMessage("You must be logged in to create an advert.");
      return;
    }

    const { data, error } = await supabase
      .from("adverts")
      .insert({
        seller_id: user.id,
        title,
        price: Number(price),
        mileage: Number(mileage),
        description,
        status: "draft",
        paid: false,
        promo_code: null,
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
    } else {
      router.push(`/publish-advert/${data.id}`);
    }
  }

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Create advert</p>
        <h1>Sell your car privately for £9.99</h1>
        <p>
          Create your draft advert, then publish it using a launch promo code or by paying £9.99.
        </p>
      </section>

      <section className="form-section">
        <form className="advert-form" onSubmit={handleSubmit}>
          <label>
            Advert title
            <input
              required
              placeholder="e.g. BMW M2 Competition 2021"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label>
            Price
            <input
              required
              type="number"
              placeholder="39995"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>

          <label>
            Mileage
            <input
              required
              type="number"
              placeholder="24500"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
            />
          </label>

          <label>
            Description
            <textarea
              required
              placeholder="Describe the car, condition, service history, MOT, faults, reason for sale..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label>
            <input required type="checkbox" style={{ width: "auto", marginRight: "10px" }} />
            I confirm I am a private seller and the information in this advert is accurate.
          </label>

          <button type="submit">Create draft advert</button>

          {message && <p style={{ marginTop: "18px" }}>{message}</p>}
        </form>
      </section>
    </main>
  );
}