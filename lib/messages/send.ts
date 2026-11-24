import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";
import { checkContactDetails, CONTACT_DETAILS_MESSAGE, type ContactReason } from "@/lib/messages/contactDetails";
import type { RequestContext } from "@/lib/security/requestContext";
import { assessHold, getTrustStatus, type HoldReason } from "@/lib/messages/review";
import {
  checkFullName,
  isDisposableEmail,
  isLandmarkPostcode,
  NAME_PROBLEM_MESSAGES,
} from "@/lib/security/identityChecks";

// The single path for creating buyer/seller messages.
//
// Messages are inserted with the service-role key, and signed-in users have
// no INSERT permission on public.messages (see the security migrations), so
// every message has to pass the checks here. The permission check below
// reproduces the RLS insert policy that previously did this job:
//
//   1. a buyer may message the seller of a *published* advert, or
//   2. a seller may reply on their own advert (published or not) to someone
//      who has already messaged them about it.

export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type Permission = { allowed: false } | { allowed: true; senderIsSeller: boolean };

async function checkPermission(
  admin: SupabaseClient,
  { advertId, senderId, recipientId }: { advertId: string; senderId: string; recipientId: string }
): Promise<Permission> {
  if (!advertId || !senderId || !recipientId || senderId === recipientId) return { allowed: false };

  const { data: advert } = await admin
    .from("adverts")
    .select("id, seller_id, status")
    .eq("id", advertId)
    .maybeSingle();
  if (!advert) return { allowed: false };

  // 1. Buyer → seller about a published advert.
  if (advert.status === ADVERT_STATUS.PUBLISHED && advert.seller_id === recipientId) {
    return { allowed: true, senderIsSeller: false };
  }

  // 2. Seller → someone who has already messaged them about this advert.
  if (advert.seller_id === senderId) {
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("advert_id", advertId)
      .eq("sender_id", recipientId)
      .eq("recipient_id", senderId);
    return (count ?? 0) > 0 ? { allowed: true, senderIsSeller: true } : { allowed: false };
  }

  return { allowed: false };
}

export async function canSendMessage(
  admin: SupabaseClient,
  ids: { advertId: string; senderId: string; recipientId: string }
): Promise<boolean> {
  return (await checkPermission(admin, ids)).allowed;
}

type IdentityCheck =
  | { ok: true; flags: HoldReason[] }
  | { ok: false; status: number; error: string; code: string };

/**
 * A buyer must have confirmed their email and given a first name, surname
 * and postcode before messaging (genuine buyers can fix these, so they're
 * refused with an explanation). Details that look fake (landmark postcode,
 * made-up name, throwaway email) aren't refused, which would only tell a
 * scammer what to change: the message is held for review instead.
 */
async function checkBuyerIdentity(admin: SupabaseClient, senderId: string): Promise<IdentityCheck> {
  let user: { email?: string | null; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> } | null = null;
  try {
    const { data } = await admin.auth.admin.getUserById(senderId);
    user = data?.user ?? null;
  } catch {
    user = null;
  }
  if (!user) return { ok: false, status: 403, error: "Not authorised to send this message.", code: "NO_ACCOUNT" };

  if (!user.email_confirmed_at) {
    return {
      ok: false,
      status: 403,
      error: "Please confirm your email address before messaging sellers. Check your inbox for the link we sent you.",
      code: "EMAIL_UNCONFIRMED",
    };
  }

  const { data: profile } = await admin.from("profiles").select("full_name, postcode").eq("id", senderId).maybeSingle();
  const meta = user.user_metadata ?? {};
  const fullName = (profile?.full_name as string | null) ?? (meta.full_name as string | null) ?? null;
  const postcode = (profile?.postcode as string | null) ?? (meta.postcode as string | null) ?? null;

  const nameProblem = checkFullName(fullName);
  if (nameProblem && nameProblem !== "suspect") {
    return {
      ok: false,
      status: 403,
      error: `${NAME_PROBLEM_MESSAGES[nameProblem]} You can add it on your Account page before messaging sellers.`,
      code: "PROFILE_INCOMPLETE",
    };
  }
  if (!postcode) {
    return {
      ok: false,
      status: 403,
      error: "Please add your postcode to your account before messaging sellers.",
      code: "POSTCODE_REQUIRED",
    };
  }

  const flags: HoldReason[] = [];
  if (isLandmarkPostcode(postcode)) flags.push("fake_postcode");
  if (nameProblem === "suspect") flags.push("suspect_name");
  if (isDisposableEmail(user.email)) flags.push("disposable_email");
  return { ok: true, flags };
}

export type SendResult =
  | { ok: true; message: Record<string, unknown> }
  | { ok: false; status: number; error: string; code?: string };

/**
 * Checks the text for contact details (blocking and logging the attempt if
 * found), refuses suspended accounts, checks permission, decides whether a
 * buyer's message must be held for review, then inserts it with where it
 * came from. Held messages are stored as "pending" and are invisible to the
 * recipient until approved.
 */
export async function sendMessage(
  admin: SupabaseClient,
  input: {
    advertId: string;
    senderId: string;
    recipientId: string;
    body: string;
    context: RequestContext;
  }
): Promise<SendResult> {
  const { advertId, senderId, recipientId, body, context } = input;

  const contact = checkContactDetails(body);
  if (contact.blocked) {
    await logBlockedMessage(admin, { ...input, reasons: contact.reasons });
    return { ok: false, status: 422, error: CONTACT_DETAILS_MESSAGE, code: "CONTACT_DETAILS" };
  }

  const trust = await getTrustStatus(admin, senderId);
  if (trust === "suspended") {
    return {
      ok: false,
      status: 403,
      error: "This account can't send messages. If you think this is a mistake, email contact@ownercars.co.uk.",
      code: "ACCOUNT_SUSPENDED",
    };
  }

  const permission = await checkPermission(admin, { advertId, senderId, recipientId });
  if (!permission.allowed) {
    return { ok: false, status: 403, error: "Not authorised to send this message." };
  }

  // Sellers replying on their own advert are never held or identity-checked.
  let holdReasons: HoldReason[] = [];
  if (!permission.senderIsSeller) {
    const identity = await checkBuyerIdentity(admin, senderId);
    if (!identity.ok) {
      return { ok: false, status: identity.status, error: identity.error, code: identity.code };
    }
    holdReasons = await assessHold(admin, { advertId, senderId, body, context, trust, identityFlags: identity.flags });
  }

  const { data: message, error } = await admin
    .from("messages")
    .insert({
      advert_id: advertId,
      sender_id: senderId,
      recipient_id: recipientId,
      body,
      status: holdReasons.length ? "pending" : "delivered",
      hold_reasons: holdReasons,
      sender_ip: context.ip,
      sender_country: context.country,
      sender_region: context.region,
      sender_city: context.city,
      sender_user_agent: context.userAgent,
    })
    .select("id, advert_id, sender_id, recipient_id, body, created_at, read_at, status")
    .single();

  if (error || !message) {
    return { ok: false, status: 400, error: error?.message ?? "Could not send message." };
  }

  // Never hand the sender_* evidence columns back to a client.
  const { id, advert_id, sender_id, recipient_id, body: text, created_at, read_at, status } = message as Record<string, unknown>;
  return { ok: true, message: { id, advert_id, sender_id, recipient_id, body: text, created_at, read_at, status } };
}

async function logBlockedMessage(
  admin: SupabaseClient,
  input: {
    advertId: string;
    senderId: string;
    recipientId: string;
    body: string;
    context: RequestContext;
    reasons: ContactReason[];
  }
): Promise<void> {
  try {
    await admin.from("message_blocks").insert({
      advert_id: input.advertId,
      sender_id: input.senderId,
      recipient_id: input.recipientId,
      body: input.body,
      reasons: input.reasons,
      sender_ip: input.context.ip,
      sender_country: input.context.country,
      sender_region: input.context.region,
      sender_city: input.context.city,
      sender_user_agent: input.context.userAgent,
    });
  } catch (err) {
    // Logging must never turn a block into a send.
    console.error("Failed to log blocked message:", err);
  }
}
