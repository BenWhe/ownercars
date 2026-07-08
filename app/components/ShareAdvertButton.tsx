"use client";

import { useState } from "react";

const SITE_URL = "https://www.ownercars.co.uk";

type ShareAdvertButtonProps = {
  advertId: string;
  shareText: string;
};

export default function ShareAdvertButton({ advertId, shareText }: ShareAdvertButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const url = `${SITE_URL}/advert/${advertId}`;

  async function handleShareClick() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareText, text: shareText, url });
      } catch (error) {
        // AbortError just means the user dismissed the native share sheet.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
      return;
    }

    setMenuOpen((open) => !open);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch {
      setCopyStatus("Copy failed — copy the link from your browser.");
    }
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText
  )}&url=${encodeURIComponent(url)}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(
    `${shareText}\n\n${url}`
  )}`;

  return (
    <div className="share-advert-wrap">
      <button type="button" className="share-advert-button" onClick={handleShareClick}>
        Share this vehicle
      </button>

      {menuOpen && (
        <div className="share-advert-menu" role="menu">
          <button type="button" onClick={copyLink}>Copy link</button>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a href={twitterUrl} target="_blank" rel="noopener noreferrer">X</a>
          <a href={mailUrl}>Email</a>
        </div>
      )}

      {copyStatus && (
        <p className="share-advert-status" role="status" aria-live="polite">
          {copyStatus}
        </p>
      )}
    </div>
  );
}
