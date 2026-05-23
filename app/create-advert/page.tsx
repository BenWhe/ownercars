"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function capitaliseWords(str: string) {
  return str
    ?.split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const SAVED_ADVERT_DRAFT_KEY = "ownercars:create-advert-draft";
const PENDING_ADVERT_SUBMIT_KEY = "ownercars_pending_advert_submit";

type AdvertDraft = {
  make: string;
  model: string;
  year: string;
  mileage: string;
  fuelType: string;
  gearbox: string;
  price: string;
  bodyType: string;
  colour: string;
  doors: string;
  seats: string;
  previouslyWrittenOff: string;
  confirmedPrivateSeller: boolean;
  description: string;
};

export default function CreateAdvertPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showSaveAdvertPrompt, setShowSaveAdvertPrompt] = useState(false);

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
  const [confirmedPrivateSeller, setConfirmedPrivateSeller] = useState(false);

  function currentDraft(): AdvertDraft {
    return {
      make,
      model,
      year,
      mileage,
      fuelType,
      gearbox,
      price,
      bodyType,
      colour,
      doors,
      seats,
      previouslyWrittenOff,
      confirmedPrivateSeller,
      description,
    };
  }

  function applyDraft(draft: Partial<AdvertDraft>) {
    setMake(draft.make || "");
    setModel(draft.model || "");
    setYear(draft.year || "");
    setMileage(draft.mileage || "");
    setFuelType(draft.fuelType || "");
    setGearbox(draft.gearbox || "");
    setPrice(draft.price || "");
    setBodyType(draft.bodyType || "");
    setColour(draft.colour || "");
    setDoors(draft.doors || "");
    setSeats(draft.seats || "");
    setPreviouslyWrittenOff(draft.previouslyWrittenOff || "");
    setConfirmedPrivateSeller(Boolean(draft.confirmedPrivateSeller));
    setDescription(draft.description || "");
  }

  function readSavedDraft() {
    const savedDraft = window.localStorage.getItem(SAVED_ADVERT_DRAFT_KEY);
    if (!savedDraft) return null;

    try {
      return JSON.parse(savedDraft) as AdvertDraft;
    } catch {
      window.localStorage.removeItem(SAVED_ADVERT_DRAFT_KEY);
      return null;
    }
  }

  async function createAdvertForUser(sellerId: string, draft: AdvertDraft) {
    const supabase = createClient();

    return supabase
      .from("adverts")
      .insert({
        seller_id: sellerId,
        title: `${draft.year} ${draft.make} ${draft.model}`.trim(),
        make: draft.make,
        model: draft.model,
        year: Number(draft.year),
        mileage: Number(draft.mileage),
        fuel_type: draft.fuelType,
        gearbox: draft.gearbox,
        price: Number(draft.price),
        body_type: draft.bodyType,
        colour: draft.colour,
        doors: Number(draft.doors),
        seats: Number(draft.seats),
        previously_written_off: draft.previouslyWrittenOff,
        description: draft.description,
        status: "draft",
        paid: false,
        promo_code: null,
      })
      .select()
      .single();
  }

  useEffect(() => {
    const savedDraft = readSavedDraft();
    if (savedDraft) applyDraft(savedDraft);

    const supabase = createClient();

    async function checkAuth() {
      try {
        await supabase.auth.getUser();
      } finally {
        setIsCheckingAuth(false);
      }
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setIsCheckingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  function saveDraftToLocalStorage() {
    window.localStorage.setItem(
      SAVED_ADVERT_DRAFT_KEY,
      JSON.stringify(currentDraft())
    );
  }

  function validateDraft() {
    const missingFields = [
      ["make", make],
      ["model", model],
      ["year", year],
      ["mileage", mileage],
      ["fuel type", fuelType],
      ["gearbox", gearbox],
      ["price", price],
      ["body type", bodyType],
      ["colour", colour],
      ["doors", doors],
      ["seats", seats],
      ["write-off status", previouslyWrittenOff],
      ["seller note", description.trim()],
    ]
      .filter(([, value]) => !value)
      .map(([label]) => label);

    if (missingFields.length > 0) {
      return `Please complete: ${missingFields.join(", ")}.`;
    }

    if (!confirmedPrivateSeller) {
      return "Please confirm you are a private seller before creating your draft advert.";
    }

    return "";
  }

  async function handleCreateAdvertClick() {
    setMessage("");

    const validationError = validateDraft();
    if (validationError) {
      setMessage(validationError);
      return;
    }

    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;

    if (userError || !user) {
      saveDraftToLocalStorage();
      window.localStorage.setItem(PENDING_ADVERT_SUBMIT_KEY, "true");
      setShowSaveAdvertPrompt(true);
      return;
    }

    setShowSaveAdvertPrompt(false);

    const { data, error } = await createAdvertForUser(user.id, currentDraft());

    if (error) {
      setMessage(error.message);
      return;
    }

    window.localStorage.removeItem(SAVED_ADVERT_DRAFT_KEY);
    window.localStorage.removeItem(PENDING_ADVERT_SUBMIT_KEY);
    router.push(`/publish-advert/${data.id}`);
  }

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Create advert</p>

        <h1>
          Sell your car privately for <span className="no-break">£9.99</span>
        </h1>

        <p className="dashboard-subtitle">
          Create your draft advert, then publish it using our{" "}
          <span className="price-highlight">£2.50</span>{" "}
          <span className="price-label">launch offer</span>. Standard £9.99
          price.
        </p>
      </section>

      <section className="form-section">
        {isCheckingAuth && <p className="auth-check-note">Checking your account quietly — you can keep creating your advert.</p>}

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
              ? `${
                  mileage ? `${Number(mileage).toLocaleString()} miles` : "Mileage"
                } · ${fuelType || "Fuel type"} · ${gearbox || "Gearbox"}`
              : "Mileage · Fuel type · Gearbox"}
          </p>
        </div>

        <div className="advert-form">
          <label>
            Make
            <input
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="BMW"
            />
          </label>

          <label>
            Model
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="3 Series"
            />
          </label>

          <label>
            Year
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2019"
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
            <input
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              placeholder="Blue"
            />
          </label>

          <label>
            Doors
            <input
              type="number"
              value={doors}
              onChange={(e) => setDoors(e.target.value)}
              placeholder="5"
            />
          </label>

          <label>
            Seats
            <input
              type="number"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              placeholder="5"
            />
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
            <input
              required
              type="checkbox"
              checked={confirmedPrivateSeller}
              onChange={(e) => setConfirmedPrivateSeller(e.target.checked)}
            />
            <span>
              I confirm I am a private seller and the information in this advert
              is accurate.
            </span>
          </label>

          <p className="submit-reassurance">
            We’ll save your advert to your account before you publish.
          </p>

          <button type="button" onClick={handleCreateAdvertClick}>
            Create draft advert
          </button>

          {message && (
            <p role="alert" style={{ marginTop: "18px" }}>
              {message}
            </p>
          )}
        </div>

        {showSaveAdvertPrompt && (
          <div
            className="save-advert-modal-backdrop"
            role="presentation"
            onClick={() => setShowSaveAdvertPrompt(false)}
          >
            <div
              className="save-advert-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-advert-title"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="eyebrow">Almost there</p>
              <h2 id="save-advert-title">Save your advert</h2>
              <p>
                Create or sign in to your OwnerCars account so your advert is
                saved safely and only you can manage it.
              </p>
              <div className="save-advert-actions">
                <Link className="button primary" href="/login?next=/create-advert/resume">
                  Sign in and continue
                </Link>
                <Link
                  className="button secondary"
                  href="/create-account?next=/create-advert/resume"
                >
                  Create account and continue
                </Link>
              </div>
              <button
                className="save-advert-close"
                type="button"
                onClick={() => setShowSaveAdvertPrompt(false)}
              >
                Keep editing
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}