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
  /\b(whats\s*-?\s*app|whatapp|watsapp|wats\s*app|whtsapp|w\s*[./]\s*app|wapp|telegram|viber|wechat|imessage|signal\s+(me|app)|on\s+signal|snapchat|facebook\s+messenger|instagram|insta|messenger)\b/i;

// Email providers named on their own ("my gmail is…", "find me on hotmail").
const EMAIL_PROVIDER = /\b(gmail|googlemail|hotmail|yahoo|icloud|protonmail|aol|btinternet)\b/i;

// A UK mobile number once disguises are undone: digits separated by dots,
// slashes, underscores or asterisks as well as spaces and dashes. Exact
// length (07 + 9 digits, or 44 7 + 9 digits) so dates and prices can't
// match: "07/12/2025 13:00" has a colon and too few digits.
const MOBILE_SEP = "[\\s.\\-()/_*]*";
const UK_MOBILE = new RegExp(
  `(?<!\\d)(?:\\+?${MOBILE_SEP}4${MOBILE_SEP}4${MOBILE_SEP}(?:\\(?0\\)?)?|0)${MOBILE_SEP}7(?:${MOBILE_SEP}\\d){9}(?!${MOBILE_SEP}\\d)`,
);

const WORD_DIGITS: [RegExp, string][] = [
  [/zero|nought/gi, "0"], [/one/gi, "1"], [/two/gi, "2"], [/three/gi, "3"], [/four/gi, "4"],
  [/five/gi, "5"], [/six/gi, "6"], [/seven/gi, "7"], [/eight/gi, "8"], [/nine/gi, "9"],
];

// Undo the usual disguises before looking for a mobile number: keycap emoji
// (0️⃣), number words run together ("zero7four4"), and the letters O, l and I
// used for 0 and 1 inside a run of digits ("O7447464O97").
function undisguiseDigits(text: string): string {
  let t = text.replace(/[\uFE0F\u20E3]/g, "");
  for (const [word, digit] of WORD_DIGITS) t = t.replace(word, digit);
  return t
    .split(/(\s+)/)
    .map((token) => (/\d/.test(token) && /^[\d.\-()/_*+oOlI|]+$/.test(token) ? token.replace(/[oO]/g, "0").replace(/[lI|]/g, "1") : token))
    .join("");
}

// "W h a t s A p p", "T.e.l.e.g.r.a.m": single letters with gaps between.
// Only runs of single characters are joined, so ordinary words next to each
// other ("what's appealing") are never merged.
function joinSpacedLetters(text: string): string {
  return text.replace(/\b(?:[a-z@][\s.\-_*]+){3,}[a-z@]\b/gi, (m) => m.replace(/[\s.\-_*]+/g, ""));
}

// wh@tsapp, wh4tsapp, te1egram
function undoLeetspeak(text: string): string {
  return text.replace(/@/g, "a").replace(/4/g, "a").replace(/3/g, "e").replace(/0/g, "o").replace(/1/g, "l").replace(/\$/g, "s");
}

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

  if (hasPhoneNumber(text) || UK_MOBILE.test(undisguiseDigits(text))) reasons.add("phone");
  if (hasPhoneInWords(text)) reasons.add("phone_words");
  if (EMAIL.test(text) || EMAIL_SPELLED.test(text) || EMAIL_PROVIDER.test(withoutOwnLinks)) reasons.add("email");
  if (LINK.test(withoutOwnLinks) || DOMAIN.test(withoutOwnLinks)) reasons.add("link");
  const lettersJoined = joinSpacedLetters(text);
  if (MESSAGING_APP.test(text) || MESSAGING_APP.test(lettersJoined) || MESSAGING_APP.test(undoLeetspeak(lettersJoined))) {
    reasons.add("messaging_app");
  }
  if (CONTACT_REQUEST.test(text)) reasons.add("contact_request");

  return { blocked: reasons.size > 0, reasons: [...reasons] };
}
