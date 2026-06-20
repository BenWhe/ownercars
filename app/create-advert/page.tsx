"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import PhotoUploader from "@/app/components/PhotoUploader";

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
  engineSize: string;
  registration: string;
  previouslyWrittenOff: string;
  confirmedPrivateSeller: boolean;
  description: string;
};

type AdvertDraftField = keyof AdvertDraft;
type FieldErrors = Partial<Record<AdvertDraftField, string>>;

type LookupStatus = "idle" | "loading" | "found" | "notfound" | "error";

type PrefilledMarkers = {
  make: boolean;
  model: boolean;
  colour: boolean;
  engineSize: boolean;
};

export default function CreateAdvertPage() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
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
  const [engineSize, setEngineSize] = useState("");
  const [previouslyWrittenOff, setPreviouslyWrittenOff] = useState("");
  const [confirmedPrivateSeller, setConfirmedPrivateSeller] = useState(false);
  const [postcode, setPostcode] = useState("");
  const [postcodeError, setPostcodeError] = useState("");
  const [postcodePrefilled, setPostcodePrefilled] = useState(false);

  // Reg-lookup
  const [registration, setRegistration] = useState("");
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [lookupMessage, setLookupMessage] = useState("");
  const [prefilled, setPrefilled] = useState<PrefilledMarkers>({
    make: false,
    model: false,
    colour: false,
    engineSize: false,
  });
  const [mileageFromMot, setMileageFromMot] = useState(false);
  const [noMotHistory, setNoMotHistory] = useState(false);
  const vehicleCardRef = useRef<HTMLDivElement | null>(null);

  // Set after a successful draft-save so the photo uploader can attach to the advert
  const [savedAdvertId, setSavedAdvertId] = useState<string | null>(null);
  const [savedPhotos, setSavedPhotos] = useState<any[]>([]);
  const photoCardRef = useRef<HTMLDivElement | null>(null);

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
      engineSize,
      registration,
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
    engineSize,
    registration,
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
    setEngineSize(draft.engineSize || "");
    setRegistration(draft.registration || "");
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
    });

    return () => {
      window.clearTimeout(draftRestoreTimer);
      subscription.unsubscribe();
    };
  }, []);

  // Prefill postcode from seller's profile on mount.
  // Uses /api/account (server-side auth) — never a direct client-side Supabase call,
  // which hangs on Vercel preview deployments.
  useEffect(() => {
    async function prefillPostcode() {
      try {
        const res = await fetch("/api/account");
        if (!res.ok) return;
        const result = await res.json();

        const profilePostcode: string | null = result.profile?.postcode ?? null;
        const metaPostcode: string | null = result.user?.user_metadata?.postcode ?? null;
        const source = profilePostcode || metaPostcode || null;

        if (!source) return;

        setPostcode((current) => current || source);
        setPostcodePrefilled(true);
      } catch {
        // Non-blocking
      }
    }
    prefillPostcode();
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
      <p className="ca-field-error" role="alert">
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

  async function handleRegLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const reg = registration.trim();
    if (!reg) {
      setLookupStatus("error");
      setLookupMessage("Enter your registration to search.");
      return;
    }

    setLookupStatus("loading");
    setLookupMessage("");

    try {
      const res = await fetch("/api/vehicle-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: reg }),
      });
      const result = await res.json();

      if (!res.ok) {
        setLookupStatus("error");
        setLookupMessage(
          result.error ||
            "We couldn't look up that registration. Please enter your car's details manually below."
        );
        return;
      }

      if (!result.found) {
        setLookupStatus("notfound");
        setLookupMessage(
          "We couldn't find that registration. Please enter your car's details manually below."
        );
        return;
      }

      // Reset all lookup-owned fields before applying new data so a second
      // lookup for a different car never retains values from the first.
      setMake("");
      setModel("");
      setYear("");
      setFuelType("");
      setColour("");
      setEngineSize("");
      setMileage("");
      setMileageFromMot(false);

      const nextPrefilled: PrefilledMarkers = { make: false, model: false, colour: false, engineSize: false };
      let hasMotMileage = false;

      if (result.make) {
        setMake(result.make);
        nextPrefilled.make = true;
        clearFieldError("make");
      }
      if (result.model) {
        setModel(result.model);
        nextPrefilled.model = true;
        clearFieldError("model");
      }
      if (result.year) {
        setYear(String(result.year));
        clearFieldError("year");
      }
      if (result.fuelType) {
        setFuelType(result.fuelType);
        clearFieldError("fuelType");
      }
      if (result.colour) {
        setColour(result.colour);
        nextPrefilled.colour = true;
        clearFieldError("colour");
      }
      if (result.engineSize) {
        setEngineSize(`${result.engineSize} cc`);
        nextPrefilled.engineSize = true;
      }
      if (result.lastMileage && result.lastMileage.value) {
        const { value, unit } = result.lastMileage;
        const miles =
          typeof unit === "string" && unit.toLowerCase() === "km"
            ? Math.round(value * 0.621371)
            : value;
        setMileage(String(miles));
        setMileageFromMot(true);
        hasMotMileage = true;
        clearFieldError("mileage");
      }

      setNoMotHistory(!hasMotMileage);
      setPrefilled(nextPrefilled);
      setLookupStatus("found");
      setLookupMessage("");
    } catch {
      setLookupStatus("error");
      setLookupMessage(
        "We couldn't look up that registration right now. Please enter your car's details manually below."
      );
    }
  }

  function enterManually() {
    vehicleCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleCreateAdvertSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    console.log(`${LOG_PREFIX} create draft advert submitted`);

    setMessage("");

    const validationErrors = validateDraft();
    setFieldErrors(validationErrors);

    // Postcode is not part of AdvertDraft so validated separately
    if (!postcode.trim()) {
      setPostcodeError("Enter the postcode where the car is kept.");
    }

    if (Object.keys(validationErrors).length > 0 || !postcode.trim()) {
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
      setSavedAdvertId(result.id);
      // Scroll to the photos section so the uploader is immediately visible
      setTimeout(() => {
        photoCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch {
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <main>
      <div className="ca-wrap">
        <p className="ca-eyebrow">Create advert</p>
        <h1 className="ca-h1">Sell your car privately</h1>
        <p className="ca-sub">
          Start with your registration and we&apos;ll fill in the details. Publish for our{" "}
          <span className="ca-b">£9.99</span> launch price — your advert runs until it sells.
        </p>

        {isCheckingAuth && (
          <p className="ca-reg-hint" style={{ color: "var(--muted)", marginTop: "14px" }}>
            Checking your account quietly — you can keep creating your advert.
          </p>
        )}

        {/* REG LOOKUP HERO */}
        <div className="ca-reg-card">
          <p className="ca-reg-label">Quick start</p>
          <h2>Enter your registration</h2>
          <p className="ca-reg-intro">
            We&apos;ll pull your car&apos;s make, model, year and more — so you don&apos;t have to type it all in.
          </p>

          <form className="ca-reg-row" onSubmit={handleRegLookup}>
            <div className="ca-reg-plate">
              <span className="ca-gb">GB</span>
              <input
                type="text"
                placeholder="AB12 CDE"
                value={registration}
                maxLength={8}
                onChange={(e) => {
                  setRegistration(e.target.value.toUpperCase());
                  if (lookupStatus !== "idle") {
                    setLookupStatus("idle");
                    setLookupMessage("");
                    setNoMotHistory(false);
                  }
                }}
                aria-label="Vehicle registration"
              />
            </div>
            <button type="submit" className="ca-reg-find" disabled={lookupStatus === "loading"}>
              {lookupStatus === "loading" ? "Finding…" : "Find my car"}
            </button>
          </form>

          <p className="ca-reg-hint">
            🔒 Your registration is used only to fetch details — it&apos;s never shown in your advert.
          </p>

          {(lookupStatus === "found" || lookupStatus === "notfound" || lookupStatus === "error") && (
            <div
              className={`ca-found${
                lookupStatus === "notfound" || lookupStatus === "error" ? " ca-error" : ""
              }`}
              role="status"
            >
              {lookupStatus === "found"
                ? "✓ Found it — we've filled in the details below. Check them over and adjust anything that's changed."
                : lookupMessage}
            </div>
          )}

          <p className="ca-reg-manual">
            <button type="button" onClick={enterManually}>
              Can&apos;t find it? Enter the details manually →
            </button>
          </p>
        </div>

        <form onSubmit={handleCreateAdvertSubmit} noValidate>
          {/* VEHICLE DETAILS */}
          <div className="ca-card" ref={vehicleCardRef}>
            <h3>Your vehicle</h3>
            <p className="ca-card-sub">
              Pre-filled from your registration where we can — edit anything that&apos;s not right.
            </p>
            <div className="ca-grid">
              <div className="ca-field ca-full">
                <label>Make</label>
                <input
                  value={make}
                  onChange={(e) => {
                    clearFieldError("make");
                    setMake(e.target.value);
                    setPrefilled((p) => ({ ...p, make: false }));
                  }}
                  placeholder="BMW"
                />
                {prefilled.make && <div className="ca-prefilled">✓ From your registration</div>}
                {fieldError("make")}
              </div>

              <div className="ca-field ca-full">
                <label>Model</label>
                <input
                  value={model}
                  onChange={(e) => {
                    clearFieldError("model");
                    setModel(e.target.value);
                    setPrefilled((p) => ({ ...p, model: false }));
                  }}
                  placeholder="3 Series"
                />
                {prefilled.model && <div className="ca-prefilled">✓ From your registration</div>}
                {fieldError("model")}
              </div>

              <div className="ca-field">
                <label>Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => { clearFieldError("year"); setYear(e.target.value); }}
                  placeholder="2019"
                />
                {fieldError("year")}
              </div>

              <div className="ca-field">
                <label>Mileage</label>
                <input
                  type="number"
                  value={mileage}
                  onChange={(e) => {
                    clearFieldError("mileage");
                    setMileage(e.target.value);
                    setMileageFromMot(false);
                  }}
                  placeholder="e.g. 24,500"
                />
                {mileageFromMot && <div className="ca-hint">From last MOT — update to current</div>}
                {noMotHistory && (
                  <p className="auth-message auth-message--notice" role="status">
                    This car has no MOT history yet, so we&apos;ve filled in what we can — please enter the current mileage yourself.
                  </p>
                )}
                {fieldError("mileage")}
              </div>

              <div className="ca-field">
                <label>Fuel type</label>
                <select
                  value={fuelType}
                  onChange={(e) => { clearFieldError("fuelType"); setFuelType(e.target.value); }}
                >
                  <option value="" disabled>Select fuel type</option>
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Electric">Electric</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
                {fieldError("fuelType")}
              </div>

              <div className="ca-field">
                <label>Gearbox</label>
                <select
                  value={gearbox}
                  onChange={(e) => { clearFieldError("gearbox"); setGearbox(e.target.value); }}
                >
                  <option value="" disabled>Select gearbox</option>
                  <option value="Manual">Manual</option>
                  <option value="Automatic">Automatic</option>
                  <option value="Semi-automatic">Semi-automatic</option>
                </select>
                {fieldError("gearbox")}
              </div>

              <div className="ca-field">
                <label>Body type</label>
                <select
                  value={bodyType}
                  onChange={(e) => { clearFieldError("bodyType"); setBodyType(e.target.value); }}
                >
                  <option value="" disabled>Select body type</option>
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
              </div>

              <div className="ca-field">
                <label>Colour</label>
                <input
                  value={colour}
                  onChange={(e) => {
                    clearFieldError("colour");
                    setColour(e.target.value);
                    setPrefilled((p) => ({ ...p, colour: false }));
                  }}
                  placeholder="Blue"
                />
                {prefilled.colour && <div className="ca-prefilled">✓ From your registration</div>}
                {fieldError("colour")}
              </div>

              <div className="ca-field">
                <label>Doors</label>
                <input
                  type="number"
                  value={doors}
                  onChange={(e) => { clearFieldError("doors"); setDoors(e.target.value); }}
                  placeholder="5"
                />
                {fieldError("doors")}
              </div>

              <div className="ca-field">
                <label>Seats</label>
                <input
                  type="number"
                  value={seats}
                  onChange={(e) => { clearFieldError("seats"); setSeats(e.target.value); }}
                  placeholder="5"
                />
                {fieldError("seats")}
              </div>

              <div className="ca-field ca-full">
                <label>Engine size</label>
                <input
                  value={engineSize}
                  onChange={(e) => {
                    setEngineSize(e.target.value);
                    setPrefilled((p) => ({ ...p, engineSize: false }));
                  }}
                  placeholder="e.g. 1998 cc"
                />
                {prefilled.engineSize && <div className="ca-prefilled">✓ From your registration</div>}
              </div>

              <div className="ca-field ca-full">
                <label>Previously written off?</label>
                <select
                  value={previouslyWrittenOff}
                  onChange={(e) => { clearFieldError("previouslyWrittenOff"); setPreviouslyWrittenOff(e.target.value); }}
                >
                  <option value="" disabled>Select</option>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
                {fieldError("previouslyWrittenOff")}
              </div>
            </div>
          </div>

          {/* PRICE */}
          <div className="ca-card">
            <h3>Price</h3>
            <p className="ca-card-sub">What you&apos;d like to sell it for.</p>
            <div className="ca-field ca-price-wrap">
              <span className="ca-sym">£</span>
              <input
                type="number"
                value={price}
                onChange={(e) => { clearFieldError("price"); setPrice(e.target.value); }}
                placeholder="39,995"
              />
              {fieldError("price")}
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="ca-card">
            <h3>Note from the seller</h3>
            <p className="ca-card-sub">The only free-form part of your advert — make it count.</p>
            <div className="ca-field">
              <textarea
                maxLength={800}
                placeholder="Tell buyers what makes your car a great choice; condition, history, extras or anything worth highlighting."
                value={description}
                onChange={(e) => {
                  clearFieldError("description");
                  const cleaned = e.target.value.replace(/\n{3,}/g, "\n\n");
                  setDescription(cleaned);
                }}
              />
              <div className="ca-hint">{description.length} / 800</div>
              {fieldError("description")}
            </div>
          </div>

          {/* LOCATION */}
          <div className="ca-card">
            <h3>Where is the car located?</h3>
            <p className="ca-card-sub">
              We show buyers the nearest town only — your postcode is never visible.
            </p>
            <div className="ca-field">
              <input
                type="text"
                value={postcode}
                onChange={(e) => { setPostcode(e.target.value); setPostcodeError(""); setPostcodePrefilled(false); }}
                placeholder="e.g. DT6 3NP"
                maxLength={8}
              />
              {postcodePrefilled ? (
                <div className="ca-hint">
                  We&apos;ve used your account postcode. Change it if the car is kept somewhere else.
                </div>
              ) : (
                <div className="ca-hint">
                  Enter the postcode where the car is kept. We show nearest town to buyers — your postcode is never visible.
                </div>
              )}
              {postcodeError && <div className="ca-field-error" role="alert">{postcodeError}</div>}
            </div>
          </div>

          {/* PHOTOS */}
          <div className="ca-card" ref={photoCardRef}>
            <h3>Photos</h3>
            <p className="ca-card-sub">Up to 10. The first photo is your main image.</p>
            {savedAdvertId ? (
              <PhotoUploader
                advertId={savedAdvertId}
                photos={savedPhotos}
                onPhotosChange={setSavedPhotos}
                maxPhotos={10}
              />
            ) : (
              <div className="ca-photo-drop">
                <strong>Save your advert details to unlock photo upload</strong>
                Once you hit &ldquo;Create draft advert&rdquo; below, the photo uploader will appear here — JPG, PNG or HEIC straight from your phone.
              </div>
            )}
          </div>

          {/* CONFIRM + SUBMIT — hidden after draft is saved */}
          {!savedAdvertId && (
            <div className="ca-card">
              <label className="ca-confirm">
                <input
                  type="checkbox"
                  checked={confirmedPrivateSeller}
                  onChange={(e) => { clearFieldError("confirmedPrivateSeller"); setConfirmedPrivateSeller(e.target.checked); }}
                />
                <span>I confirm I am a private seller and the information in this advert is accurate.</span>
              </label>
              {fieldError("confirmedPrivateSeller")}

              <div className="ca-submit-row">
                <button type="submit" className="ca-btn-submit">Create draft advert</button>
                <p className="ca-save-note">We&apos;ll save your advert to your account before you publish.</p>
              </div>

              {message && (
                <p role="alert" className="ca-form-message">{message}</p>
              )}
            </div>
          )}

          {/* PUBLISH CTA — shown after draft is saved */}
          {savedAdvertId && (
            <div className="ca-card ca-publish-cta">
              <p className="ca-publish-cta-msg">✓ Advert saved — add your photos above, then continue to publish.</p>
              <Link href={`/publish-advert/${savedAdvertId}`} className="ca-btn-submit">
                Continue to publish →
              </Link>
            </div>
          )}
        </form>
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
    </main>
  );
}
