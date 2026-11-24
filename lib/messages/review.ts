import "server-only";

import { vehicleName } from "@/lib/seo/vehicle";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildFromHeader } from "@/lib/email/welcomePublished";
import { notifyRecipientOfMessage } from "@/lib/messages/notifyRecipient";
import type { RequestContext } from "@/lib/security/requestContext";

// Review hold for buyer messages.
//
// A buyer's message is held (status "pending", invisible to the seller) when:
//   - new_account: the account has never had a message approved, or
//   - non_uk: it was sent from outside the UK, or
//   - duplicate: the same text was sent about a different advert recently, or
//   - rapid: the account has messaged 3+ different adverts in 15 minutes.
// Sellers replying on their own adverts are never held. Suspended accounts
// can't send at all. Approving a message delivers it, emails the seller and
// marks the account trusted.

export type HoldReason = "new_account" | "non_uk" | "duplicate" | "rapid";
export type TrustStatus = "new" | "trusted" | "suspended";

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  new_account: "New account (no approved messages yet)",
  non_uk: "Sent from outside the UK",
  duplicate: "Same text sent about another advert",
  rapid: "Messaged 3+ adverts within 15 minutes",
};

const UK_COUNTRY_CODES = new Set(["GB", "IM", "JE", "GG"]);
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ownercars.co.uk";
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL ?? "contact@ownercars.co.uk";

export async function getTrustStatus(admin: SupabaseClient, userId: string): Promise<TrustStatus> {
  const { data } = await admin.from("account_trust").select("status").eq("user_id", userId).maybeSingle();
  return (data?.status as TrustStatus) ?? "new";
}

async function setTrustStatus(
  admin: SupabaseClient,
  userId: string,
  status: TrustStatus,
  reviewerId: string | null,
  note?: string
) {
  await admin.from("account_trust").upsert(
    { user_id: userId, status, updated_at: new Date().toISOString(), updated_by: reviewerId, note: note ?? null },
    { onConflict: "user_id" }
  );
}

function normaliseText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Decides whether a buyer's message should be held for review, and why. */
export async function assessHold(
  admin: SupabaseClient,
  { advertId, senderId, body, context, trust }: {
    advertId: string;
    senderId: string;
    body: string;
    context: RequestContext;
    trust: TrustStatus;
  }
): Promise<HoldReason[]> {
  const reasons: HoldReason[] = [];
  if (trust !== "trusted") reasons.push("new_account");
  if (context.country && !UK_COUNTRY_CODES.has(context.country.toUpperCase())) reasons.push("non_uk");

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("messages")
    .select("advert_id, body, created_at")
    .eq("sender_id", senderId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  const normalised = normaliseText(body);
  if (normalised.length >= 15 && (recent ?? []).some((m) => m.advert_id !== advertId && normaliseText(m.body) === normalised)) {
    reasons.push("duplicate");
  }

  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  const advertsRecently = new Set(
    (recent ?? []).filter((m) => new Date(m.created_at).getTime() >= fifteenMinutesAgo).map((m) => m.advert_id)
  );
  advertsRecently.add(advertId);
  if (advertsRecently.size >= 3) reasons.push("rapid");

  return reasons;
}

// ---- Signed links for the review email -----------------------------------
// The email links open a confirmation page (never act on GET, so mail
// scanners that pre-open links can't approve anything). The token proves the
// link came from us; it's bound to one message and expires after 14 days.

function signingKey(): string {
  const key = process.env.MODERATION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("No signing key configured");
  return `ownercars-moderation-v1:${key}`;
}

export function signReviewToken(messageId: string, ttlDays = 14): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60;
  const mac = createHmac("sha256", signingKey()).update(`${messageId}.${exp}`).digest("base64url");
  return `${exp}.${mac}`;
}

export function verifyReviewToken(messageId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const [expStr, mac] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !mac || exp < Date.now() / 1000) return false;
  const expected = createHmac("sha256", signingKey()).update(`${messageId}.${exp}`).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function reviewLink(messageId: string): string {
  return `${SITE_URL}/admin/review/${messageId}?t=${encodeURIComponent(signReviewToken(messageId))}`;
}

// ---- Admin -----------------------------------------------------------------

export async function isAdmin(admin: SupabaseClient, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await admin.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

async function getUserEmail(admin: SupabaseClient, userId: string): Promise<{ email: string | null; createdAt: string | null }> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return { email: data?.user?.email ?? null, createdAt: data?.user?.created_at ?? null };
  } catch {
    return { email: null, createdAt: null };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Emails the admin address about a held message, with a review link. Never throws. */
export async function notifyAdminOfHeldMessage(admin: SupabaseClient, messageId: string): Promise<void> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.RECONFIRMATION_EMAIL_FROM;
    if (!resendApiKey || !from) return;

    const { data: msg } = await admin
      .from("messages")
      .select("id, advert_id, sender_id, body, hold_reasons, sender_ip, sender_country, sender_city, created_at, adverts(year, make, model)")
      .eq("id", messageId)
      .maybeSingle();
    if (!msg) return;

    const sender = await getUserEmail(admin, msg.sender_id);
    const advert = (Array.isArray(msg.adverts) ? msg.adverts[0] : msg.adverts) as
      | { year?: number; make?: string; model?: string }
      | null;
    const advertTitle = advert ? vehicleName({ ...advert, title: "an advert" }) : "an advert";
    const reasons = ((msg.hold_reasons ?? []) as HoldReason[]).map((r) => HOLD_REASON_LABELS[r] ?? r);
    const where = [msg.sender_city, msg.sender_country].filter(Boolean).join(", ") || "unknown";
    const link = reviewLink(msg.id);
    const dashboard = `${SITE_URL}/admin/security`;

    const lines = [
      `A message about ${advertTitle} is waiting for review. The seller won't see it until you approve it.`,
      "",
      `From: ${sender.email ?? "unknown"} (account created ${sender.createdAt ? new Date(sender.createdAt).toUTCString() : "unknown"})`,
      `Sent from: ${where} (IP ${msg.sender_ip ?? "unknown"})`,
      `Why it was held: ${reasons.join("; ") || "unknown"}`,
      "",
      "Message:",
      msg.body,
      "",
      `Review it: ${link}`,
      `Security dashboard: ${dashboard}`,
    ];

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: buildFromHeader(from, "OwnerCars Security"),
        to: ADMIN_ALERT_EMAIL,
        subject: `Review needed: message about ${advertTitle}`,
        text: lines.join("\n"),
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111827;line-height:1.5">
          <p>A message about <strong>${escapeHtml(advertTitle)}</strong> is waiting for review. The seller won't see it until you approve it.</p>
          <p><strong>From:</strong> ${escapeHtml(sender.email ?? "unknown")}<br>
          <strong>Sent from:</strong> ${escapeHtml(where)} (IP ${escapeHtml(msg.sender_ip ?? "unknown")})<br>
          <strong>Why it was held:</strong> ${escapeHtml(reasons.join("; ") || "unknown")}</p>
          <blockquote style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-left:4px solid #2563EB">${escapeHtml(msg.body)}</blockquote>
          <p><a href="${link}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">Review message</a></p>
          <p><a href="${dashboard}">Open the security dashboard</a></p>
        </div>`,
      }),
    });
  } catch (err) {
    console.error("Failed to send held-message alert:", err);
  }
}

// ---- Decisions ---------------------------------------------------------------

export type ReviewAction = "approve" | "reject" | "reject_suspend";

export async function reviewMessage(
  admin: SupabaseClient,
  messageId: string,
  action: ReviewAction,
  reviewerId: string | null
): Promise<{ ok: boolean; error?: string; status?: string }> {
  const { data: msg } = await admin
    .from("messages")
    .select("id, advert_id, sender_id, recipient_id, body, status, adverts(year, make, model)")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return { ok: false, error: "Message not found." };
  if (msg.status !== "pending") return { ok: true, status: msg.status }; // already decided

  const now = new Date().toISOString();

  if (action === "approve") {
    // Only flip pending -> delivered, so two clicks can't double-send.
    const { data: updated } = await admin
      .from("messages")
      .update({ status: "delivered", reviewed_at: now, reviewed_by: reviewerId })
      .eq("id", messageId)
      .eq("status", "pending")
      .select("id");
    if (!updated?.length) return { ok: true, status: "delivered" };

    await setTrustStatus(admin, msg.sender_id, "trusted", reviewerId, "Message approved");

    const advert = (Array.isArray(msg.adverts) ? msg.adverts[0] : msg.adverts) as
      | { year?: number; make?: string; model?: string }
      | null;
    await notifyRecipientOfMessage({
      advertId: msg.advert_id,
      advertTitle: [advert?.year, advert?.make, advert?.model].filter(Boolean).join(" "),
      senderId: msg.sender_id,
      recipientId: msg.recipient_id,
      body: msg.body,
    });
    return { ok: true, status: "delivered" };
  }

  await admin
    .from("messages")
    .update({ status: "rejected", reviewed_at: now, reviewed_by: reviewerId })
    .eq("id", messageId)
    .eq("status", "pending");

  if (action === "reject_suspend") {
    await suspendAccount(admin, msg.sender_id, reviewerId, "Rejected message");
  }
  return { ok: true, status: "rejected" };
}

/**
 * Stops an account messaging (trust "suspended"), rejects anything it still
 * has pending, and bans it from signing in. Nothing is deleted, so the
 * evidence stays intact.
 */
export async function suspendAccount(admin: SupabaseClient, userId: string, reviewerId: string | null, note?: string) {
  await setTrustStatus(admin, userId, "suspended", reviewerId, note);
  await admin
    .from("messages")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: reviewerId })
    .eq("sender_id", userId)
    .eq("status", "pending");
  await setSignInBan(admin, userId, "876000h");
}

export async function unsuspendAccount(admin: SupabaseClient, userId: string, reviewerId: string | null) {
  await setTrustStatus(admin, userId, "new", reviewerId, "Suspension lifted");
  await setSignInBan(admin, userId, "none");
}

// The messaging suspension above is what matters; the sign-in ban is extra.
// A failure here is logged, never allowed to undo or hide the suspension.
async function setSignInBan(admin: SupabaseClient, userId: string, duration: string) {
  try {
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: duration });
    if (error) console.error("Sign-in ban update failed:", error.message);
  } catch (err) {
    console.error("Sign-in ban update failed:", err);
  }
}
