"use client";

import { useState } from "react";

const OWNER_CARS_DOMAIN = "https://www.ownercars.co.uk";
const PROMOTE_REASSURANCE_COPY =
  "Share your secure OwnerCars listing with friends, social media and buyer groups — without exposing your personal details.";

function advertUrl(advertId: string) {
  return `${OWNER_CARS_DOMAIN}/advert/${advertId}`;
}

type PromoteAdvertToolsProps = {
  advertId: string;
  title: string;
  compact?: boolean;
};

export default function PromoteAdvertTools({
  advertId,
  title,
  compact = false,
}: PromoteAdvertToolsProps) {
  const [status, setStatus] = useState("");
  const url = advertUrl(advertId);

  async function copyAdvertLink(message = "✓ Link copied") {
    try {
      await navigator.clipboard.writeText(url);
      setStatus(message);
    } catch {
      setStatus("Copy failed — please copy the link from your browser.");
    }
  }

  async function shareAdvert() {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `View my OwnerCars advert: ${title}`,
          url,
        });
        setStatus("✓ Share sheet opened");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    await copyAdvertLink("✓ Link copied");
  }

  return (
    <section className={`promote-advert-card${compact ? " compact" : ""}`}>
      <div>
        <p className="promote-kicker">Promote your advert</p>
        <h3>Help sell your car faster</h3>
        <p>{PROMOTE_REASSURANCE_COPY}</p>
      </div>

      <div className="promote-actions">
        <button type="button" onClick={() => copyAdvertLink()}>
          Copy advert link
        </button>
        <button type="button" onClick={shareAdvert}>
          Share advert
        </button>
      </div>

      {status && (
        <p className="promote-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </section>
  );
}
