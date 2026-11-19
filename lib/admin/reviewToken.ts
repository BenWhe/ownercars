import { createHmac, timingSafeEqual } from "crypto";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function sign(messageId: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`${messageId}.${expiresAt}`).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** Builds the `t=` token for an admin review link: HMAC-SHA256 over messageId + expiry. */
export function buildReviewToken(messageId: string): string | null {
  const secret = process.env.ADMIN_REVIEW_SECRET;
  if (!secret) return null;

  const expiresAt = Date.now() + FOURTEEN_DAYS_MS;
  return `${expiresAt}.${sign(messageId, expiresAt, secret)}`;
}

export function verifyReviewToken(messageId: string, token: string): boolean {
  const secret = process.env.ADMIN_REVIEW_SECRET;
  if (!secret) return false;

  const [expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!expiresAt || !signature || Date.now() > expiresAt) return false;

  return timingSafeEqualHex(signature, sign(messageId, expiresAt, secret));
}
