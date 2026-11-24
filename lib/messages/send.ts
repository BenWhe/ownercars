import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";
import { checkContactDetails, CONTACT_DETAILS_MESSAGE, type ContactReason } from "@/lib/messages/contactDetails";
import type { RequestContext } from "@/lib/security/requestContext";

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

export async function canSendMessage(
  admin: SupabaseClient,
  { advertId, senderId, recipientId }: { advertId: string; senderId: string; recipientId: string }
): Promise<boolean> {
  if (!advertId || !senderId || !recipientId || senderId === recipientId) return false;

  const { data: advert } = await admin
    .from("adverts")
    .select("id, seller_id, status")
    .eq("id", advertId)
    .maybeSingle();
  if (!advert) return false;

  // 1. Buyer → seller about a published advert.
  if (advert.status === ADVERT_STATUS.PUBLISHED && advert.seller_id === recipientId) {
    return true;
  }

  // 2. Seller → someone who has already messaged them about this advert.
  if (advert.seller_id === senderId) {
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("advert_id", advertId)
      .eq("sender_id", recipientId)
      .eq("recipient_id", senderId);
    return (count ?? 0) > 0;
  }

  return false;
}

export type SendResult =
  | { ok: true; message: Record<string, unknown> }
  | { ok: false; status: number; error: string; code?: string };

/**
 * Checks the text for contact details (blocking and logging the attempt if
 * found), checks permission, then inserts the message with where it came from.
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

  if (!(await canSendMessage(admin, { advertId, senderId, recipientId }))) {
    return { ok: false, status: 403, error: "Not authorised to send this message." };
  }

  const { data: message, error } = await admin
    .from("messages")
    .insert({
      advert_id: advertId,
      sender_id: senderId,
      recipient_id: recipientId,
      body,
      sender_ip: context.ip,
      sender_country: context.country,
      sender_region: context.region,
      sender_city: context.city,
      sender_user_agent: context.userAgent,
    })
    .select("id, advert_id, sender_id, recipient_id, body, created_at, read_at")
    .single();

  if (error || !message) {
    return { ok: false, status: 400, error: error?.message ?? "Could not send message." };
  }

  // Never hand the sender_* evidence columns back to a client.
  const { id, advert_id, sender_id, recipient_id, body: text, created_at, read_at } = message as Record<string, unknown>;
  return { ok: true, message: { id, advert_id, sender_id, recipient_id, body: text, created_at, read_at } };
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
