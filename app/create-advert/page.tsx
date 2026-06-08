"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

function capitaliseWords(str: string) {
  return str
    ?.split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const SAVED_ADVERT_DRAFT_KEY = "ownercars:create-advert-draft";
const PENDING_ADVERT_SUBMIT_KEY = "ownercars_pending_advert_submit";
const LOG_PREFIX = "[OC-01 create-advert debug]";

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

type AdvertDraftField = keyof AdvertDraft;
type FieldErrors = Partial<Record<AdvertDraftField, string>>;

export default function CreateAdvertPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasLoadedSavedDraft, setHasLoadedSavedDraft] = useState(false);
  const [showSaveAdvertPrompt, setShowSaveAdvertPrompt] = useState(false);

  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

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
  const [postcode, setPostcode] = useState("");
  const [postcodeError, setPostcodeError] = useState("");

  const currentDraft = useCallback((): AdvertDraft => {
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
  }, [
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
  ]);

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

  function advertInsertPayload(sellerId: string, draft: AdvertDraft) {
    return {
      seller_id: sellerId,
      seller_email: currentUser?.email,
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
    };
  }

  async function createAdvertForUser(sellerId: string, draft: AdvertDraft) {
    const supabase = createClient();
    const payload = advertInsertPayload(sellerId, draft);

    console.log(`${LOG_PREFIX} Supabase insert call`, {
      table: "adverts",
      method: "insert(...).select().single()",
      sellerId,
      payload,
    });

    const response = await supabase.from("adverts").insert(payload).select().single();

    console.log(`${LOG_PREFIX} Supabase insert response`, {
      data: response.data,
      error: response.error,
      status: response.status,
      statusText: response.statusText,
    });

    return response;
  }

  useEffect(() => {
    const savedDraft = readSavedDraft();
    const draftRestoreTimer = window.setTimeout(() => {
      if (savedDraft) applyDraft(savedDraft);
      setHasLoadedSavedDraft(true);
    }, 0);

    const {
      data: { subscription },
    } = createClient().auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      console.log(`${LOG_PREFIX} auth state changed`, {
        event,
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
      });
      setIsCheckingAuth(false);
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      window.clearTimeout(draftRestoreTimer);
      subscription.unsubscribe();
    };
  }, []);

  const saveDraftToLocalStorage = useCallback(() => {
    window.localStorage.setItem(
      SAVED_ADVERT_DRAFT_KEY,
      JSON.stringify(currentDraft())
    );
  }, [currentDraft]);

  useEffect(() => {
    if (!hasLoadedSavedDraft) return;
    saveDraftToLocalStorage();
  }, [hasLoadedSavedDraft, saveDraftToLocalStorage]);

  function clearFieldError(field: AdvertDraftField) {
    setMessage("");
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function fieldError(field: AdvertDraftField) {
    if (!fieldErrors[field]) return null;

    return (
      <p className="field-error" role="alert">
        {fieldErrors[field]}
      </p>
    );
  }

  function validateDraft() {
    const errors: FieldErrors = {};

    const requiredFields: Array<[AdvertDraftField, string, string]> = [
      ["make", make, "Enter the make."],
      ["model", model, "Enter the model."],
      ["year", year, "Enter the year."],
      ["mileage", mileage, "Enter the mileage."],
      ["fuelType", fuelType, "Select the fuel type."],
      ["gearbox", gearbox, "Select the gearbox."],
      ["price", price, "Enter the price."],
      ["bodyType", bodyType, "Select the body type."],
      ["colour", colour, "Enter the colour."],
      ["doors", doors, "Enter the number of doors."],
      ["seats", seats, "Enter the number of seats."],
      ["previouslyWrittenOff", previouslyWrittenOff, "Select the write-off status."],
      ["description", description.trim(), "Add a seller note."],
    ];

    requiredFields.forEach(([field, value, error]) => {
      if (!value) errors[field] = error;
    });

    const numericFields: Array<[AdvertDraftField, string, string]> = [
      ["year", year, "Enter a valid year."],
      ["mileage", mileage, "Enter a valid mileage."],
      ["price", price, "Enter a valid price."],
      ["doors", doors, "Enter a valid number of doors."],
      ["seats", seats, "Enter a valid number of seats."],
    ];

    numericFields.forEach(([field, value, error]) => {
      if (value && Number(value) <= 0) errors[field] = error;
    });

    if (!confirmedPrivateSeller) {
      errors.confirmedPrivateSeller =
        "Confirm you are a private seller before creating your draft advert.";
    }

    return errors;
  }

  async function handleCreateAdvertSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    console.log(`${LOG_PREFIX} create draft advert submitted`);

    setMessage("");

    const validationErrors = validateDraft();
    setFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      console.log(`${LOG_PREFIX} validation blocked submit`, validationErrors);
      setMessage("Please fix the highlighted fields. Your progress is still saved on this device.");
      return;
    }

    console.log(`${LOG_PREFIX} validation passed`);

    saveDraftToLocalStorage();

    // Geocode postcode if provided
    let geoPayload: { postcode?: string; latitude?: number; longitude?: number; nearest_town?: string } = {};
    if (postcode.trim()) {
      const geoRes = await fetch(`/api/geocode?postcode=${encodeURIComponent(postcode.trim())}`);
      const geoResult = await geoRes.json();
      if (!geoRes.ok) {
        setPostcodeError("Please enter a valid UK postcode.");
        return;
      }
      geoPayload = {
        postcode: geoResult.postcode,
        latitude: geoResult.latitude,
        longitude: geoResult.longitude,
        nearest_town: geoResult.nearest_town,
      };
    }

    try {
      const res = await fetch("/api/create-draft-advert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...currentDraft(), ...geoPayload }),
      });

      const result = await res.json();

      if (res.status === 401) {
        window.localStorage.setItem(PENDING_ADVERT_SUBMIT_KEY, "true");
        setShowSaveAdvertPrompt(true);
        return;
      }

      if (!res.ok) {
        setMessage(result.error || "Something went wrong saving your advert.");
        return;
      }

      window.localStorage.removeItem(SAVED_ADVERT_DRAFT_KEY);
      window.localStorage.removeItem(PENDING_ADVERT_SUBMIT_KEY);
      setShowSaveAdvertPrompt(false);
      router.push(`/publish-advert/${result.id}`);
    } catch (err) {
      setMessage("Something went wrong. Please try again.");
    }
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

        <form className="advert-form" onSubmit={handleCreateAdvertSubmit} noValidate>
          <label>
            Make
            <input
              value={make}
              onChange={(e) => { clearFieldError("make"); setMake(e.target.value); }}
              placeholder="BMW"
            />
            {fieldError("make")}
          </label>

          <label>
            Model
            <input
              value={model}
              onChange={(e) => { clearFieldError("model"); setModel(e.target.value); }}
              placeholder="3 Series"
            />
            {fieldError("model")}
          </label>

          <label>
            Year
            <input
              type="number"
              value={year}
              onChange={(e) => { clearFieldError("year"); setYear(e.target.value); }}
              placeholder="2019"
            />
            {fieldError("year")}
          </label>

          <label>
            Mileage
            <input
              required
              type="number"
              placeholder="24500"
              value={mileage}
              onChange={(e) => { clearFieldError("mileage"); setMileage(e.target.value); }}
            />
            {fieldError("mileage")}
          </label>

          <label>
            Fuel type
            <select
              value={fuelType}
              onChange={(e) => { clearFieldError("fuelType"); setFuelType(e.target.value); }}
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
            {fieldError("fuelType")}
          </label>

          <label>
            Gearbox
            <select
              value={gearbox}
              onChange={(e) => { clearFieldError("gearbox"); setGearbox(e.target.value); }}
              className={!gearbox ? "select-placeholder" : ""}
            >
              <option value="" disabled>
                Select gearbox
              </option>
              <option value="Manual">Manual</option>
              <option value="Automatic">Automatic</option>
              <option value="Semi-automatic">Semi-automatic</option>
            </select>
            {fieldError("gearbox")}
          </label>

          <label>
            Price
            <input
              required
              type="number"
              placeholder="39995"
              value={price}
              onChange={(e) => { clearFieldError("price"); setPrice(e.target.value); }}
            />
            {fieldError("price")}
          </label>

          <label>
            Body type
            <select
              value={bodyType}
              onChange={(e) => { clearFieldError("bodyType"); setBodyType(e.target.value); }}
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
            {fieldError("bodyType")}
          </label>

          <label>
            Colour
            <input
              value={colour}
              onChange={(e) => { clearFieldError("colour"); setColour(e.target.value); }}
              placeholder="Blue"
            />
            {fieldError("colour")}
          </label>

          <label>
            Doors
            <input
              type="number"
              value={doors}
              onChange={(e) => { clearFieldError("doors"); setDoors(e.target.value); }}
              placeholder="5"
            />
            {fieldError("doors")}
          </label>

          <label>
            Seats
            <input
              type="number"
              value={seats}
              onChange={(e) => { clearFieldError("seats"); setSeats(e.target.value); }}
              placeholder="5"
            />
            {fieldError("seats")}
          </label>

          <label>
            Previously written off?
            <select
              value={previouslyWrittenOff}
              onChange={(e) => { clearFieldError("previouslyWrittenOff"); setPreviouslyWrittenOff(e.target.value); }}
              className={!previouslyWrittenOff ? "select-placeholder" : ""}
            >
              <option value="" disabled>
                Select
              </option>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
            {fieldError("previouslyWrittenOff")}
          </label>

          <label>
            Note from the seller
            <textarea
              required
              maxLength={800}
              placeholder="Tell buyers what makes your car a great choice; condition, history, extras or anything worth highlighting."
              value={description}
              onChange={(e) => {
                clearFieldError("description");
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
            {fieldError("description")}
          </label>

          <label>
            Seller postcode
            <input
              type="text"
              value={postcode}
              onChange={(e) => { setPostcode(e.target.value); setPostcodeError(""); }}
              placeholder="e.g. DT6 3NP"
              maxLength={8}
            />
            <p className="field-hint">Never shown publicly — we display nearest town only.</p>
            {postcodeError && <p className="field-error" role="alert">{postcodeError}</p>}
          </label>

          <label className="checkbox-row">
            <input
              required
              type="checkbox"
              checked={confirmedPrivateSeller}
              onChange={(e) => { clearFieldError("confirmedPrivateSeller"); setConfirmedPrivateSeller(e.target.checked); }}
            />
            <span>
              I confirm I am a private seller and the information in this advert
              is accurate.
            </span>
            {fieldError("confirmedPrivateSeller")}
          </label>

          <p className="submit-reassurance">
            We’ll save your advert to your account before you publish.
          </p>

          <button type="submit">
            Create draft advert
          </button>

          {message && (
            <p role="alert" style={{ marginTop: "18px" }}>
              {message}
            </p>
          )}
        </form>

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
