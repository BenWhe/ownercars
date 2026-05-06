"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function capitaliseWords(str: string) {
  return str
    ?.split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function CreateAdvertPage() {
  const supabase = createClient();
  const router = useRouter();

  
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

const [make, setMake] = useState("");
const [model, setModel] = useState("");
const [year, setYear] = useState("");
const [gearbox, setGearbox] = useState("");
const [bodyType, setBodyType] = useState("");
const [colour, setColour] = useState("");
const [doors, setDoors] = useState("");
const [seats, setSeats] = useState("");
const [fuelType, setFuelType] = useState("");
const [previouslyWrittenOff, setPreviouslyWrittenOff] = useState("");

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
        title: `${year} ${make} ${model}`.trim(),
        make,
        model,
        year: Number(year),
        mileage: Number(mileage),
        fuel_type: fuelType,
        gearbox,
        
        price: Number(price),

        body_type: bodyType,
        colour,
        doors: Number(doors),
        seats: Number(seats),
        
        previously_written_off: previouslyWrittenOff,
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

const formReady =
  make &&
  model &&
  year &&
  mileage &&
  fuelType &&
  gearbox &&
  price &&
  description.length > 0;

  return (
    <main>
      <section className="dashboard-hero">
  <p className="eyebrow">Create advert</p>

  <h1>
  Sell your car privately for{" "}
  <span className="no-break">£9.99</span>
</h1>

  <p className="dashboard-subtitle">
    Create your draft advert, then publish it using our{" "}
    <span className="price-highlight">£2.50</span>{" "}
    <span className="price-label">launch offer</span>.
    Standard £9.99 price.
  </p>
</section>

      <section className="form-section">

<div className="preview-card">
  <p className="preview-label">Advert preview</p>

<h2 className="preview-title">
  {make || model || year
    ? `${year ? `${year} ` : ""}${capitaliseWords(make || "")}${
        make && model ? " " : ""
      }${capitaliseWords(model || "")}`
    : "Start by entering make, model and year"}
</h2>

  <p className="preview-subtitle">
    {mileage || fuelType || gearbox
      ? `${mileage ? `${Number(mileage).toLocaleString()} miles` : "Mileage"} · ${
          fuelType || "Fuel type"
        } · ${gearbox || "Gearbox"}`
      : "Mileage · Fuel type · Gearbox"}
  </p>
</div>

        <form className="advert-form" onSubmit={handleSubmit}>
          
          <label>
  Make
  <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="BMW" />
</label>

<label>
  Model
  <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="3 Series" />
</label>

<label>
  Year
  <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2019" />
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
  Fuel type
  <select
  value={fuelType}
  onChange={(e) => setFuelType(e.target.value)}
  className={!fuelType ? "select-placeholder" : ""}
>
  <option value="" disabled>
    Select fuel type
  </option>
  <option value="Petrol">Petrol</option>
  <option value="Diesel">Diesel</option>
  <option value="Electric">Electric</option>
  <option value="Hybrid">Hybrid</option>
</select>
</label>

<label>
  Gearbox
  <select
  value={gearbox}
  onChange={(e) => setGearbox(e.target.value)}
  className={!gearbox ? "select-placeholder" : ""}
>
  <option value="" disabled>
    Select gearbox
  </option>
  <option value="Manual">Manual</option>
  <option value="Automatic">Automatic</option>
  <option value="Semi-automatic">Semi-automatic</option>
</select>
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
  Body type
  <select
  value={bodyType}
  onChange={(e) => setBodyType(e.target.value)}
  className={!bodyType ? "select-placeholder" : ""}
>
  <option value="" disabled>
    Select body type
  </option>
  <option value="Hatchback">Hatchback</option>
  <option value="Saloon">Saloon</option>
  <option value="SUV">SUV</option>
  <option value="Estate">Estate</option>
  <option value="Coupe">Coupe</option>
  <option value="Convertible">Convertible</option>
  <option value="MPV">MPV</option>
  <option value="Pickup">Pickup</option>
  <option value="Van">Van</option>
  <option value="Other">Other</option>
</select>
</label>

<label>
  Colour
  <input value={colour} onChange={(e) => setColour(e.target.value)} placeholder="Blue" />
</label>

<label>
  Doors
  <input type="number" value={doors} onChange={(e) => setDoors(e.target.value)} placeholder="5" />
</label>

<label>
  Seats
  <input type="number" value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="5" />
</label>



<label>
  Previously written off?
  <select
  value={previouslyWrittenOff}
  onChange={(e) => setPreviouslyWrittenOff(e.target.value)}
  className={!previouslyWrittenOff ? "select-placeholder" : ""}
>
  <option value="" disabled>
    Select
  </option>
  <option value="No">No</option>
  <option value="Yes">Yes</option>
</select>
</label>

          <label>
  Note from the seller
  <textarea
    required
    maxLength={800}
    placeholder="Tell buyers what makes your car a great choice; condition, history, extras or anything worth highlighting."
    value={description}
    onChange={(e) => {
  const cleaned = e.target.value.replace(/\n{3,}/g, "\n\n");
  setDescription(cleaned);
}}
  />
  <div className="field-meta">
    <p className="field-hint">
      This is the only free-form part of your advert — make it count.
    </p>
   <p
  className={`char-count ${
    description.length > 720
      ? "char-count-danger"
      : description.length > 600
      ? "char-count-warning"
      : ""
  }`}
>
  {description.length}/800
</p>
  </div>
</label>

          <label className="checkbox-row">
  <input required type="checkbox" />
  <span>I confirm I am a private seller and the information in this advert is accurate.</span>
</label>


          <button
  type="submit"
  disabled={!formReady}
  className={!formReady ? "button-disabled" : ""}
>
  Create draft advert
</button>

          {message && <p style={{ marginTop: "18px" }}>{message}</p>}
        </form>
      </section>
    </main>
  );
}