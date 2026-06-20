"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

// ─── Card design constants ────────────────────────────────────────────────────
// All values are CSS units (logical pixels). Multiply by S (the draw scale)
// when writing to the canvas.

const BLACK = "#111111";
const BLUE = "#2563EB";
const GRAY_BG = "#E5E7EB";        // photo placeholder / pill background (#F3F4F6 for spec pills)
const SPEC_PILL_BG = "#F3F4F6";
const MUTED = "#9CA3AF";
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// Card layout (CSS px)
const CARD_W = 360;
const CARD_H = 640;
const PHOTO_H = 202;
const QR_SECTION_H = 120;
const FOOTER_H = 62;
const CONTENT_Y = PHOTO_H;
const QR_SECTION_Y = CARD_H - FOOTER_H - QR_SECTION_H;  // 458
const FOOTER_Y = CARD_H - FOOTER_H;                        // 578

// Content area padding / spacing (CSS px)
const PAD_X = 22;
const CONTENT_PAD_TOP = 18;
const TITLE_FONT = 28;
const TITLE_LINE_H = TITLE_FONT * 1.05;    // slightly generous for multi-line
const PRICE_FONT = 31;
const PRICE_MARGIN_TOP = 10;
const PILLS_MARGIN_TOP = 14;
const SPEC_PILL_H = 42;
const SPEC_PILL_GAP = 10;
const SPEC_FONT = 14;

// FOR SALE badge (CSS px)
const BADGE_FONT = 14;
const BADGE_PAD_X = 14;
const BADGE_PAD_Y = 8;
const BADGE_H = BADGE_FONT + BADGE_PAD_Y * 2;  // 30

// QR section (CSS px)
const QR_SIZE_CSS = 80;
const QR_LABEL_FONT = 12;
const QR_GAP = 7;

// Footer (CSS px)
const FOOTER_BRAND_FONT = 23;
const FOOTER_META_FONT = 12;

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Text helpers ─────────────────────────────────────────────────────────────

function formatWords(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatNumber(value: number | string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
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

function buildTitle(advert: ForSaleCardAdvert) {
  return `${advert.year || ""} ${formatWords(advert.make)} ${formatWords(advert.model)}`
    .replace(/—/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDetailPills(advert: ForSaleCardAdvert) {
  return [
    `${formatNumber(advert.mileage)} miles`,
    formatWords(advert.fuel_type),
    formatWords(advert.gearbox),
    formatWords(advert.colour),
  ];
}

// ─── Canvas drawing primitives ────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Draw text that wraps at word boundaries across at most maxLines lines.
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2
) {
  const words = text.split(" ");
  let line = "";
  let drawn = 0;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y + drawn * lineHeight);
      drawn++;
      if (drawn >= maxLines) return;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, y + drawn * lineHeight);
}

// Load an image and draw it cover-cropped into the given rect.
async function drawCoverPhoto(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number, y: number, w: number, h: number
) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      const dx = x + (w - dw) / 2;
      const dy = y + (h - dh) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
      resolve();
    };
    img.onerror = () => {
      // Gray placeholder if photo fails to load
      ctx.fillStyle = GRAY_BG;
      ctx.fillRect(x, y, w, h);
      resolve();
    };
    img.src = src;
  });
}

// ─── Core canvas card draw ────────────────────────────────────────────────────

async function drawCard(
  canvas: HTMLCanvasElement,
  advert: ForSaleCardAdvert,
  qrEl: HTMLCanvasElement | null
) {
  const S = canvas.width / CARD_W;   // draw scale derived from actual canvas size
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = CARD_W * S;
  const H = CARD_H * S;

  // ── 1. White background ──────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // ── 2. Photo ─────────────────────────────────────────────────────────────
  const photoUrl = advert.advert_photos?.[0]?.image_url;
  if (photoUrl) {
    await drawCoverPhoto(ctx, photoUrl, 0, 0, W, PHOTO_H * S);
  } else {
    ctx.fillStyle = GRAY_BG;
    ctx.fillRect(0, 0, W, PHOTO_H * S);
  }

  // ── 3. "FOR SALE" pill ────────────────────────────────────────────────────
  const badgeFontPx = BADGE_FONT * S;
  ctx.font = `900 ${badgeFontPx}px ${FONT}`;
  ctx.letterSpacing = `${0.06 * badgeFontPx}px`;
  const badgeTextW = ctx.measureText("FOR SALE").width;
  ctx.letterSpacing = "0px";

  const badgePX = BADGE_PAD_X * S;
  const badgePY = BADGE_PAD_Y * S;
  const badgeW = badgeTextW + badgePX * 2;
  const badgeH = BADGE_H * S;
  const badgeX = 16 * S;
  const badgeY = 16 * S;

  ctx.fillStyle = BLUE;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${badgeFontPx}px ${FONT}`;
  ctx.letterSpacing = `${0.06 * badgeFontPx}px`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("FOR SALE", badgeX + badgePX, badgeY + badgeH / 2);
  ctx.letterSpacing = "0px";

  // ── 4. Content area ───────────────────────────────────────────────────────
  const padX = PAD_X * S;
  const contentMaxW = (CARD_W - PAD_X * 2) * S;

  // Title
  const titleFontPx = TITLE_FONT * S;
  ctx.font = `900 ${titleFontPx}px ${FONT}`;
  ctx.letterSpacing = `${-0.05 * titleFontPx}px`;
  ctx.fillStyle = BLACK;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const titleY = (CONTENT_Y + CONTENT_PAD_TOP) * S;
  drawWrappedText(ctx, buildTitle(advert) || "OwnerCars advert", padX, titleY, contentMaxW, TITLE_LINE_H * S);
  ctx.letterSpacing = "0px";

  // How many lines did the title take? Re-measure to find breakpoint.
  const titleLines = (() => {
    const words = (buildTitle(advert) || "OwnerCars advert").split(" ");
    let line = "", count = 1;
    for (const word of words) {
      const c = line ? `${line} ${word}` : word;
      if (ctx.measureText(c).width > contentMaxW && line) { count++; line = word; }
      else { line = c; }
    }
    return Math.min(count, 2);
  })();

  // Price
  const priceFontPx = PRICE_FONT * S;
  ctx.font = `900 ${priceFontPx}px ${FONT}`;
  ctx.letterSpacing = `${-0.04 * priceFontPx}px`;
  ctx.fillStyle = BLUE;
  const priceY = titleY + titleLines * TITLE_LINE_H * S + PRICE_MARGIN_TOP * S;
  ctx.fillText(`£${formatNumber(advert.price)}`, padX, priceY);
  ctx.letterSpacing = "0px";

  // Spec pills (2-column grid)
  const specFontPx = SPEC_FONT * S;
  const pillsY = priceY + PRICE_FONT * S + PILLS_MARGIN_TOP * S;
  const pillGap = SPEC_PILL_GAP * S;
  const pillH = SPEC_PILL_H * S;
  const pillW = (contentMaxW - pillGap) / 2;
  const pills = buildDetailPills(advert);

  ctx.font = `800 ${specFontPx}px ${FONT}`;
  ctx.letterSpacing = "0px";

  for (let i = 0; i < pills.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const px = padX + col * (pillW + pillGap);
    const py = pillsY + row * (pillH + pillGap);

    ctx.fillStyle = SPEC_PILL_BG;
    roundRect(ctx, px, py, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.fillStyle = BLACK;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(pills[i], px + pillW / 2, py + pillH / 2, pillW - 16 * S);
  }

  ctx.textAlign = "left";

  // ── 5. QR / blue section ──────────────────────────────────────────────────
  const qrSecY = QR_SECTION_Y * S;
  const qrSecH = QR_SECTION_H * S;

  ctx.fillStyle = BLUE;
  ctx.fillRect(0, qrSecY, W, qrSecH);

  const qrDrawSize = QR_SIZE_CSS * S;
  const qrLabelFontPx = QR_LABEL_FONT * S;
  const qrGap = QR_GAP * S;
  const qrBlockH = qrDrawSize + qrGap + qrLabelFontPx;
  const qrBlockY = qrSecY + (qrSecH - qrBlockH) / 2;
  const qrX = (W - qrDrawSize) / 2;

  if (qrEl) {
    // White background behind QR so it reads clearly on blue
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX, qrBlockY, qrDrawSize, qrDrawSize);
    ctx.drawImage(qrEl, qrX, qrBlockY, qrDrawSize, qrDrawSize);
  }

  ctx.font = `900 ${qrLabelFontPx}px ${FONT}`;
  ctx.letterSpacing = `${0.02 * qrLabelFontPx}px`;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.fillText("Scan to view listing", W / 2, qrBlockY + qrDrawSize + qrGap);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "left";

  // ── 6. Black footer ───────────────────────────────────────────────────────
  const footerY = FOOTER_Y * S;
  const footerH = FOOTER_H * S;

  ctx.fillStyle = BLACK;
  ctx.fillRect(0, footerY, W, footerH);

  const brandFontPx = FOOTER_BRAND_FONT * S;
  ctx.font = `900 ${brandFontPx}px ${FONT}`;
  ctx.letterSpacing = `${-0.04 * brandFontPx}px`;
  ctx.textBaseline = "middle";
  const footerMidY = footerY + footerH / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillText("OwnerCars", padX, footerMidY);
  const brandW = ctx.measureText("OwnerCars").width;

  ctx.fillStyle = BLUE;
  ctx.fillText(".co.uk", padX + brandW, footerMidY);
  ctx.letterSpacing = "0px";

  const metaFontPx = FOOTER_META_FONT * S;
  ctx.font = `800 ${metaFontPx}px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  ctx.fillText("Private sellers only", W - padX, footerMidY);
  ctx.textAlign = "left";
}

// ─── React components ─────────────────────────────────────────────────────────

// ForSaleCard is kept as the visual DOM preview of the card (used on dashboard).
export function ForSaleCard({ advert }: ForSaleCardProps) {
  const photoUrl = advert.advert_photos?.[0]?.image_url;
  const advertUrl = `https://www.ownercars.co.uk/advert/${advert.id}`;
  const title = buildTitle(advert);
  const detailPills = buildDetailPills(advert);

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        overflow: "hidden",
        background: "#ffffff",
        color: BLACK,
        fontFamily: FONT,
        border: "1px solid #E5E7EB",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ position: "relative", height: PHOTO_H, minHeight: PHOTO_H, maxHeight: PHOTO_H, width: "100%", overflow: "hidden", background: GRAY_BG, flexShrink: 0 }}>
        {photoUrl ? (
          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundImage: `url(${photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        ) : null}
        <div style={{ position: "absolute", top: 16, left: 16, background: BLUE, color: "#ffffff", borderRadius: 999, padding: "8px 14px", fontSize: BADGE_FONT, fontWeight: 900, letterSpacing: "0.06em" }}>
          FOR SALE
        </div>
      </div>

      <div style={{ padding: `${CONTENT_PAD_TOP}px ${PAD_X}px 14px`, flex: "1 1 auto" }}>
        <h2 style={{ margin: 0, color: BLACK, fontSize: TITLE_FONT, lineHeight: 1.02, letterSpacing: "-0.05em", fontWeight: 900 }}>
          {title || "OwnerCars advert"}
        </h2>
        <p style={{ margin: `${PRICE_MARGIN_TOP}px 0 ${PILLS_MARGIN_TOP}px`, color: BLUE, fontSize: PRICE_FONT, lineHeight: 1, fontWeight: 900, letterSpacing: "-0.04em" }}>
          £{formatNumber(advert.price)}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SPEC_PILL_GAP }}>
          {detailPills.map((detail, i) => (
            <div key={`${detail}-${i}`} style={{ minHeight: SPEC_PILL_H, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: SPEC_PILL_BG, color: BLACK, fontSize: SPEC_FONT, fontWeight: 800, textAlign: "center", padding: "8px 10px" }}>
              {detail}
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: QR_SECTION_H, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BLUE, color: "#ffffff", gap: QR_GAP, fontSize: QR_LABEL_FONT, fontWeight: 900, letterSpacing: "0.02em" }}>
        <QRCodeCanvas value={advertUrl} size={QR_SIZE_CSS} bgColor="#ffffff" fgColor={BLACK} level="M" includeMargin={false} style={{ display: "block" }} />
        <div style={{ color: "#ffffff", lineHeight: 1, textAlign: "center" }}>Scan to view listing</div>
      </div>

      <div style={{ height: FOOTER_H, flexShrink: 0, marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: `0 ${PAD_X}px`, background: BLACK }}>
        <div style={{ color: "#ffffff", fontSize: FOOTER_BRAND_FONT, fontWeight: 900, letterSpacing: "-0.04em" }}>
          OwnerCars<span style={{ color: BLUE }}>.co.uk</span>
        </div>
        <div style={{ color: MUTED, fontSize: FOOTER_META_FONT, fontWeight: 800, textAlign: "right" }}>
          Private sellers only
        </div>
      </div>
    </div>
  );
}

export function DownloadForSaleCardButton({ advert }: ForSaleCardProps) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const advertUrl = `https://www.ownercars.co.uk/advert/${advert.id}`;

  async function downloadCard() {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      // Ensure web fonts are loaded before measuring/drawing text
      await document.fonts?.ready;

      // Output at 4× the CSS card dimensions (1440×2560) for crisp social sharing.
      // Fixed scale avoids DPR variance across devices — the downloaded image is
      // always the same resolution regardless of which display it's generated on.
      const SCALE = 4;
      const canvas = document.createElement("canvas");
      canvas.width = CARD_W * SCALE;
      canvas.height = CARD_H * SCALE;

      await drawCard(canvas, advert, qrRef.current);

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
      {/* Hidden QRCodeCanvas — drawn via drawImage into the card canvas.
          QRCodeCanvas is ForwardRef so qrRef points to the <canvas> DOM element.
          Size 320 = 4× the 80px CSS size, sharp at any capture scale. */}
      <div aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
        <QRCodeCanvas
          ref={qrRef}
          value={advertUrl}
          size={320}
          bgColor="#ffffff"
          fgColor={BLACK}
          level="M"
          includeMargin={false}
        />
      </div>
    </>
  );
}
