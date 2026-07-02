import { LISTING_PRICE_AMOUNT_PENCE } from "@/lib/payments/config";

export type PromoCodeRecord = {
  id: string;
  code: string;
  active: boolean | null;
  uses: number | null;
  max_uses: number | null;
  discount_type: string | null;
  discount_value: number | null;
  expires_at?: string | null;
};

export type PromoValidationResult =
  | {
      ok: true;
      promo: PromoCodeRecord;
      normalizedCode: string;
      finalAmountPence: number;
    }
  | {
      ok: false;
      normalizedCode: string;
      message: string;
    };

export function normalizePromoCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function escapePostgrestLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export function isPromoExpired(promo: PromoCodeRecord, now = new Date()) {
  if (!promo.expires_at) return false;

  const expiresAt = new Date(promo.expires_at);
  return Number.isFinite(expiresAt.getTime()) && expiresAt <= now;
}

export function isPromoUseLimitReached(promo: PromoCodeRecord) {
  const maxUses = promo.max_uses;

  if (maxUses === null || maxUses === undefined) return false;

  return (promo.uses ?? 0) >= maxUses;
}

export function calculatePromoAmountPence(
  promo: PromoCodeRecord,
  baseAmountPence = LISTING_PRICE_AMOUNT_PENCE
) {
  if (promo.discount_type === "free") {
    return 0;
  }

  if (promo.discount_type === "fixed" && promo.discount_value) {
    return Math.max(0, baseAmountPence - Math.round(promo.discount_value * 100));
  }

  if (promo.discount_type === "percentage" && promo.discount_value != null) {
    const clampedPercent = Math.min(100, Math.max(0, promo.discount_value));
    return Math.max(0, Math.round(baseAmountPence * (1 - clampedPercent / 100)));
  }

  return baseAmountPence;
}

export function validatePromoRecord(
  promo: PromoCodeRecord | null,
  normalizedCode: string,
  now = new Date()
): PromoValidationResult {
  if (!promo || !promo.active) {
    return {
      ok: false,
      normalizedCode,
      message: "That promo code wasn't recognised.",
    };
  }

  if (isPromoExpired(promo, now)) {
    return {
      ok: false,
      normalizedCode,
      message: "This promo code has expired.",
    };
  }

  if (isPromoUseLimitReached(promo)) {
    return {
      ok: false,
      normalizedCode,
      message: "This promo code has reached its usage limit.",
    };
  }

  return {
    ok: true,
    promo,
    normalizedCode,
    finalAmountPence: calculatePromoAmountPence(promo),
  };
}
