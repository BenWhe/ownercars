import type { SupabaseClient } from "@supabase/supabase-js";

export type ScreenMessageReason =
  | "contact_details"
  | "first_message"
  | "burst"
  | "duplicate_text";

export type ScreenMessageInput = {
  senderId: string;
  advertId: string;
  body: string;
  admin: SupabaseClient;
};

export type ScreenMessageResult = {
  hold: boolean;
  reasons: ScreenMessageReason[];
};

const OFF_PLATFORM_KEYWORDS = [
  "whatsapp",
  "whats app",
  "watsapp",
  "wa.me",
  "telegram",
  "signal",
  "snapchat",
  "text me",
  "call me",
  "my number",
];

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

// A letter O only ever stands in for a leading zero in a phone number when
// it's actually next to a digit ("O7882733749") — leaving isolated Os (as in
// ordinary words, or a run of "Noooo") untouched avoids false positives.
function normaliseObfuscatedDigits(text: string): string {
  let result = text;
  for (let i = 0; i < 3; i++) {
    result = result
      .replace(/[oO](?=[\s.-]{0,2}\d)/g, "0")
      .replace(/(?<=\d[\s.-]{0,2})[oO]/g, "0");
  }
  return result;
}

// Covers 07…, +44 7…, 0044… and spaced/dashed/dotted variants of all three,
// because every one of them reduces to a run of 10+ digits once separators
// are stripped — the explicit UK prefixes don't need their own patterns.
function containsPhoneNumber(text: string): boolean {
  const normalised = normaliseObfuscatedDigits(text);
  const runs = normalised.match(/[0-9+][0-9+\s.-]*[0-9]/g) ?? [];
  return runs.some((run) => run.replace(/[^0-9]/g, "").length >= 10);
}

function containsOffPlatformKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return OFF_PLATFORM_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function containsContactDetails(text: string): boolean {
  return (
    containsPhoneNumber(text) ||
    EMAIL_PATTERN.test(text) ||
    containsOffPlatformKeyword(text)
  );
}

export function normaliseForDuplicateCheck(body: string): string {
  return body
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function screenMessage({
  senderId,
  advertId,
  body,
  admin,
}: ScreenMessageInput): Promise<ScreenMessageResult> {
  const reasons: ScreenMessageReason[] = [];

  if (containsContactDetails(body)) {
    reasons.push("contact_details");
  }

  // created_at is `timestamp without time zone` and the database runs UTC
  // (confirmed in Step 0), so Postgres drops the "Z" and keeps the wall-clock
  // numbers from toISOString() as-is — which already are the UTC numbers
  // `now()` would have written. A tz-aware offset here would compare wrong.
  const nowMs = Date.now();

  // first_message: no earlier *ordinary* delivered message from this sender.
  // event_type is not null for vault document_request/document_share system
  // messages, which must not count as this sender's "first message".
  const { count: deliveredCount } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", senderId)
    .eq("delivery_status", "delivered")
    .is("event_type", null);

  if (!deliveredCount) {
    reasons.push("first_message");
  }

  // burst: 3+ distinct adverts messaged by this sender in the last 10
  // minutes, including this one. Vault system messages are excluded for the
  // same reason as first_message — a seller sharing documents on several
  // live threads at once isn't burst spam.
  const tenMinutesAgo = new Date(nowMs - 10 * 60 * 1000).toISOString();
  const { data: recentMessages } = await admin
    .from("messages")
    .select("advert_id")
    .eq("sender_id", senderId)
    .is("event_type", null)
    .gte("created_at", tenMinutesAgo);

  const distinctAdverts = new Set((recentMessages ?? []).map((m) => m.advert_id));
  distinctAdverts.add(advertId);
  if (distinctAdverts.size >= 3) {
    reasons.push("burst");
  }

  // duplicate_text: this sender sent the same normalised body to a different
  // advert in the last 24 hours. Templated vault bodies ("Shared your V5C…")
  // would otherwise collide across unrelated threads, so excluded here too.
  const normalisedBody = normaliseForDuplicateCheck(body);
  const twentyFourHoursAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentBodies } = await admin
    .from("messages")
    .select("advert_id, body")
    .eq("sender_id", senderId)
    .is("event_type", null)
    .neq("advert_id", advertId)
    .gte("created_at", twentyFourHoursAgo);

  const hasDuplicate = (recentBodies ?? []).some(
    (m) => normaliseForDuplicateCheck(m.body) === normalisedBody
  );
  if (hasDuplicate) {
    reasons.push("duplicate_text");
  }

  return { hold: reasons.length > 0, reasons };
}
