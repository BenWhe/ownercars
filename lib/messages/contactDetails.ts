// Detects attempts to move a conversation off OwnerCars: phone numbers (in
// any common format, including written out in words), email addresses, links
// and messaging-app names. Used by every message send path; a message that
// matches is blocked and logged, never delivered.
//
// Deliberately strict: OwnerCars' promise to sellers is that contact stays on
// the platform, so a false positive just asks the sender to rephrase. Car
// details (prices, mileage, years, engine sizes) are short digit groups and
// don't trip the phone rule, which needs 10+ digits in one run.

export type ContactReason = "phone" | "phone_words" | "email" | "link" | "messaging_app" | "contact_request";

export type ContactCheck = {
  blocked: boolean;
  reasons: ContactReason[];
};

export const CONTACT_DETAILS_MESSAGE =
  "To keep everyone safe, phone numbers, email addresses, links and requests to move to WhatsApp or other apps can't be sent. Please keep the conversation on OwnerCars.";

// Values unused beyond membership; kept readable for future normalisation.
const NUMBER_WORDS: Record<string, string> = {
  zero: "0", oh: "0", nought: "0", o: "0",
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9",
};

// Digits separated by spaces, dashes or brackets, e.g. "07460 680 493",
// "+44 (0)7460-680493", "0 7 4 6 0 6 8 0 4 9 3". Slashes, dots, commas and
// colons break a run, so dates, times, prices and mileages ("24/11/2026
// 13:00", "£8,995", "44,980 miles") never add up to a phone number.
const DIGIT_RUN = /\+?\(?\d(?:[\s\-()]{0,3}\d)+/g;

const EMAIL = /[a-z0-9._%+-]+\s*@\s*[a-z0-9.-]+\.[a-z]{2,}/i;
// "name at gmail dot com", "name (at) hotmail (dot) co uk"
const EMAIL_SPELLED =
  /[a-z0-9._-]{2,}\s*[([{]?\s*\bat\b\s*[)\]}]?\s*[a-z0-9-]{2,}\s*[([{]?\s*\bdot\b\s*[)\]}]?\s*(com|co|net|org|uk|me)\b/i;

const LINK = /(https?:\/\/|www\.|\bwa\.me\b|\bt\.me\b|\bbit\.ly\b)/i;
const DOMAIN =
  /\b[a-z0-9-]{2,}\.(com|co\.uk|uk|net|org|io|me|ly|link|info|biz|app|xyz)\b/i;
const ALLOWED_DOMAINS = /\b(www\.)?ownercars\.co\.uk\b/gi;

const MESSAGING_APP =
  /\b(whats\s*-?\s*app|whatapp|watsapp|wats\s*app|whtsapp|w\/app|wapp|telegram|viber|wechat|imessage|signal\s+(me|app)|on\s+signal|snapchat|facebook\s+messenger)\b/i;

// "text me on…", "my mobile is…". "Message me on here / on OwnerCars" is fine.
const CONTACT_REQUEST =
  /\b(text|call|ring|phone|contact|reach|email|e-mail|dm|whatsapp)\s+me\s+(on|at|via)\b(?!\s+(here|this|ownercars|the\s+(site|platform|app)))|\bmy\s+(mobile|number|cell|phone|mob|email|e-mail)(\s+(number|no\.?))?\s*(is|:|-|=)/i;

function hasPhoneNumber(text: string): boolean {
  for (const match of text.match(DIGIT_RUN) ?? []) {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 10) return true;
  }
  return false;
}

function hasPhoneInWords(text: string): boolean {
  // Walk the words; a run of number words and digit groups (e.g. "zero seven
  // four six 0 six eight…") that contains at least three number words and
  // adds up to 7+ digits is treated as a phone number written out.
  const tokens = text.toLowerCase().split(/[\s,\-]+/).filter(Boolean);
  let digits = 0;
  let words = 0;
  for (const token of tokens) {
    if (Object.hasOwn(NUMBER_WORDS, token)) {
      digits += 1;
      words += 1;
    } else if (/^\d+$/.test(token)) {
      digits += token.length;
    } else {
      digits = 0;
      words = 0;
      continue;
    }
    if (words >= 3 && digits >= 7) return true;
  }
  return false;
}

export function checkContactDetails(body: string): ContactCheck {
  const reasons = new Set<ContactReason>();
  const text = body.normalize("NFKC");
  const withoutOwnLinks = text.replace(ALLOWED_DOMAINS, " ");

  if (hasPhoneNumber(text)) reasons.add("phone");
  if (hasPhoneInWords(text)) reasons.add("phone_words");
  if (EMAIL.test(text) || EMAIL_SPELLED.test(text)) reasons.add("email");
  if (LINK.test(withoutOwnLinks) || DOMAIN.test(withoutOwnLinks)) reasons.add("link");
  if (MESSAGING_APP.test(text)) reasons.add("messaging_app");
  if (CONTACT_REQUEST.test(text)) reasons.add("contact_request");

  return { blocked: reasons.size > 0, reasons: [...reasons] };
}
