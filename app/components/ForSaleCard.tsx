"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { QRCodeCanvas } from "qrcode.react";

type ForSaleCardAdvert = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | string | null;
  price: number | string | null;
  mileage: number | string | null;
  fuel_type: string | null;
  gearbox: string | null;
  colour: string | null;
  advert_photos?: Array<{ image_url: string | null }>;
};

type ForSaleCardProps = {
  advert: ForSaleCardAdvert;
};

const BLACK = "#111111";
const BLUE = "#2563EB";

function formatWords(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";

  return String(value)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatNumber(value: number | string | null | undefined) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString();
}

function filePart(value: number | string | null | undefined, fallback: string) {
  return (
    formatWords(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}

function downloadFileName(advert: ForSaleCardAdvert) {
  return `ownercars-${filePart(advert.make, "car")}-${filePart(advert.model, "advert")}.png`;
}

export function ForSaleCard({ advert }: ForSaleCardProps) {
  const photoUrl = advert.advert_photos?.[0]?.image_url;
  const advertUrl = `https://www.ownercars.co.uk/advert/${advert.id}`;
  const title = `${advert.year || ""} ${formatWords(advert.make)} ${formatWords(advert.model)}`
    .replace(/—/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const detailPills = [
    `${formatNumber(advert.mileage)} miles`,
    formatWords(advert.fuel_type),
    formatWords(advert.gearbox),
    formatWords(advert.colour),
  ];

  return (
    <div
      style={{
        width: 360,
        height: 640,
        overflow: "hidden",
        background: "#ffffff",
        color: BLACK,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        border: "1px solid #E5E7EB",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Photo area — backgroundImage+backgroundSize:cover is used instead of
          <img objectFit:cover> because html2canvas does not support object-fit */}
      <div style={{ position: "relative", height: 202, minHeight: 202, maxHeight: 202, width: "100%", overflow: "hidden", background: "#E5E7EB", flexShrink: 0 }}>
        {photoUrl ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundImage: `url(${photoUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: BLUE,
            color: "#ffffff",
            borderRadius: 999,
            padding: "8px 14px",
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: "0.06em",
          }}
        >
          FOR SALE
        </div>
      </div>

      <div style={{ padding: "18px 22px 14px", flex: "1 1 auto" }}>
        <h2
          style={{
            margin: 0,
            color: BLACK,
            fontSize: 28,
            lineHeight: 1.02,
            letterSpacing: "-0.05em",
            fontWeight: 900,
          }}
        >
          {title || "OwnerCars advert"}
        </h2>

        <p
          style={{
            margin: "10px 0 14px",
            color: BLUE,
            fontSize: 31,
            lineHeight: 1,
            fontWeight: 900,
            letterSpacing: "-0.04em",
          }}
        >
          £{formatNumber(advert.price)}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {detailPills.map((detail, index) => (
            <div
              key={`${detail}-${index}`}
              style={{
                minHeight: 42,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                background: "#F3F4F6",
                color: BLACK,
                fontSize: 14,
                fontWeight: 800,
                textAlign: "center",
                padding: "8px 10px",
              }}
            >
              {detail}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          height: 120,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: BLUE,
          color: "#ffffff",
          gap: 7,
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: "0.02em",
        }}
      >
        <QRCodeCanvas
          value={advertUrl}
          size={80}
          bgColor="#ffffff"
          fgColor={BLACK}
          level="M"
          includeMargin={false}
          style={{ display: "block" }}
        />
        <div style={{ color: "#ffffff", lineHeight: 1, textAlign: "center" }}>Scan to view listing</div>
      </div>

      <div
        style={{
          height: 62,
          flexShrink: 0,
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          padding: "0 22px",
          background: BLACK,
        }}
      >
        <div style={{ color: "#ffffff", fontSize: 23, fontWeight: 900, letterSpacing: "-0.04em" }}>
          OwnerCars<span style={{ color: BLUE }}>.co.uk</span>
        </div>
        <div style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 800, textAlign: "right" }}>
          Private sellers only
        </div>
      </div>
    </div>
  );
}

export function DownloadForSaleCardButton({ advert }: ForSaleCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  async function downloadCard() {
    if (!cardRef.current || isDownloading) return;

    setIsDownloading(true);

    try {
      await document.fonts?.ready;

      // Preload the photo before capture — html2canvas captures the off-screen
      // card immediately on click and may race the browser's image load.
      const photoUrl = advert.advert_photos?.[0]?.image_url;
      if (photoUrl) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = photoUrl;
        });
      }

      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        width: 360,
        height: 640,
      });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = downloadFileName(advert);
      link.click();
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={downloadCard} disabled={isDownloading}>
        {isDownloading ? "Preparing..." : "For Sale card"}
      </button>
      <div
        aria-hidden="true"
        ref={cardRef}
        style={{
          position: "fixed",
          left: -10000,
          top: 0,
          width: 360,
          height: 640,
          pointerEvents: "none",
        }}
      >
        <ForSaleCard advert={advert} />
      </div>
    </>
  );
}
