"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SAVED_ADVERT_DRAFT_KEY = "ownercars:create-advert-draft";
const PENDING_ADVERT_SUBMIT_KEY = "ownercars_pending_advert_submit";

const LOGIN_RESUME_URL = "/login?next=/create-advert/resume";
const CREATE_ACCOUNT_RESUME_URL = "/create-account?next=/create-advert/resume";

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

type ResumeState =
  | "checking-account"
  | "loading-draft"
  | "creating-advert"
  | "redirecting"
  | "needs-auth"
  | "no-draft"
  | "error";

const TIMEOUT_MS = 10_000;

function logResumeDiagnostic(message: string, details?: unknown) {
  const timestamp = new Date().toISOString();
  const prefix = `[create-advert/resume ${timestamp}] ${message}`;

  if (details === undefined) {
    console.log(prefix);
    return;
  }

  console.log(prefix, details);
}

function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(`${label} timed out after 10 seconds.`));
    }, TIMEOUT_MS);

    Promise.resolve(promise)
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
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

export default function CreateAdvertResumePage() {
  const router = useRouter();
  const hasTriedResume = useRef(false);

  const [state, setState] = useState<ResumeState>("checking-account");
  const [error, setError] = useState("");

  async function resumeAdvert() {
    setState("checking-account");
    setError("");

    try {
      const supabase = createClient();
      logResumeDiagnostic("checking auth");
      const { data: userData, error: userError } = await withTimeout<
        Awaited<ReturnType<typeof supabase.auth.getUser>>
      >(supabase.auth.getUser(), "Checking your account");
      const user = userData.user;

      logResumeDiagnostic(user ? "auth result: user" : "auth result: null", {
        user: user
          ? {
              id: user.id,
              email: user.email,
              role: user.role,
            }
          : null,
        error: userError
          ? {
              name: userError.name,
              message: userError.message,
              status: userError.status,
            }
          : null,
      });

      if (userError || !user) {
        setError(userError?.message || "Please sign in or create an account to continue.");
        setState("needs-auth");
        return;
      }

      setState("loading-draft");
      const savedDraft = readSavedDraft();

      if (!savedDraft) {
        window.localStorage.removeItem(PENDING_ADVERT_SUBMIT_KEY);
        setState("no-draft");
        return;
      }

      setState("creating-advert");
      logResumeDiagnostic("attempting insert", { userId: user.id });
      const { data, error: insertError } = await withTimeout<
        Awaited<ReturnType<typeof createAdvertForUser>>
      >(createAdvertForUser(user.id, savedDraft), "Creating your advert");

      logResumeDiagnostic(insertError ? "insert result: error" : "insert result: data", {
        data,
        error: insertError
          ? {
              message: insertError.message,
              code: insertError.code,
              details: insertError.details,
              hint: insertError.hint,
            }
          : null,
      });

      if (insertError || !data?.id) {
        setError(insertError?.message || "We couldn’t save your advert. Please try again.");
        setState("error");
        return;
      }

      window.localStorage.removeItem(SAVED_ADVERT_DRAFT_KEY);
      window.localStorage.removeItem(PENDING_ADVERT_SUBMIT_KEY);
      setState("redirecting");
      router.replace(`/publish-advert/${data.id}`);
    } catch (err) {
      logResumeDiagnostic("resume error", {
        error: err instanceof Error ? { name: err.name, message: err.message } : err,
      });
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("error");
    }
  }

  useEffect(() => {
    logResumeDiagnostic("resume page mounted");
    if (hasTriedResume.current) return;
    hasTriedResume.current = true;
    resumeAdvert();
  }, []);

  return (
    <main className="auth-page">
      <section className="auth-card saving-advert-card">
        {state === "checking-account" && (
          <>
            <p className="eyebrow">OwnerCars account</p>
            <h1>Checking your account...</h1>
            <p className="auth-sub">
              We’re confirming your sign-in before saving your advert.
            </p>
          </>
        )}

        {state === "loading-draft" && (
          <>
            <p className="eyebrow">Saved advert</p>
            <h1>Loading saved advert...</h1>
            <p className="auth-sub">We’re retrieving the advert details saved on this device.</p>
          </>
        )}

        {state === "creating-advert" && (
          <>
            <p className="eyebrow">Saving your advert</p>
            <h1>Creating your advert...</h1>
            <p className="auth-sub">
              We’re securely adding your advert to your account so you can publish it.
            </p>
          </>
        )}

        {state === "redirecting" && (
          <>
            <p className="eyebrow">Advert saved</p>
            <h1>Redirecting to photo upload...</h1>
            <p className="auth-sub">Your advert is ready. We’re taking you to the next step.</p>
          </>
        )}

        {state === "needs-auth" && (
          <>
            <p className="eyebrow">Sign in needed</p>
            <h1>Continue your advert</h1>
            <p className="auth-sub">
              {error || "Sign in or create an account to save and publish your advert."}
            </p>
            <div className="save-advert-actions">
              <Link className="button primary" href={LOGIN_RESUME_URL}>
                Sign in
              </Link>
              <Link className="button secondary" href={CREATE_ACCOUNT_RESUME_URL}>
                Create account
              </Link>
            </div>
          </>
        )}

        {state === "no-draft" && (
          <>
            <p className="eyebrow">No draft found</p>
            <h1>No saved advert found</h1>
            <p className="auth-sub">
              We couldn’t find a saved advert on this device. Start a new advert when you’re ready.
            </p>
            <Link className="button primary" href="/create-advert">
              Back to create advert
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <p className="eyebrow">Needs another try</p>
            <h1>We couldn’t save your advert</h1>
            <p className="auth-message">{error}</p>
            <button type="button" onClick={resumeAdvert}>
              Try again
            </button>
          </>
        )}
      </section>
    </main>
  );
}
