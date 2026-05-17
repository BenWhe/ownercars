"use client";

import { useState } from "react";

const OWNER_CARS_DOMAIN = "https://www.ownercars.co.uk";
const PROMOTE_REASSURANCE_COPY =
  "Promote your advert safely. Share your OwnerCars listing instead of exposing your personal details.";

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

  async function copyAdvertLink(message = "Advert link copied.") {
    try {
      await navigator.clipboard.writeText(url);
      setStatus(message);
    } catch {
      setStatus("Copy failed. Please copy the link from your browser.");
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
        setStatus("Share sheet opened.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    await copyAdvertLink("Sharing is not available here, so the advert link was copied.");
  }

  return (
    <section className={`promote-advert-card${compact ? " compact" : ""}`}>
      <div>
        <p className="promote-kicker">Promote your advert</p>
        <h3>Share your listing</h3>
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

      {status && <p className="promote-status">{status}</p>}
    </section>
  );
}
