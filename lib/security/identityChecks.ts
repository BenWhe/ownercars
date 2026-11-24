// Checks on the details people give at sign-up. Used in the sign-up form
// (to help genuine users), the account page, and on the server when a buyer
// sends a message (where it matters). Pure functions: safe in the browser.
//
// None of these prove identity. A scammer who types "James Wilson" and a real
// postcode will pass; the aim is to catch the lazy fakes that every scam
// account so far has used (e.g. Buckingham Palace's postcode) and make them
// visible on the security dashboard.

// ---- Names -----------------------------------------------------------------

const NAME_PART = /^[\p{L}][\p{L}'’\-. ]*[\p{L}.]$|^[\p{L}]{2,}$/u;
const KEYBOARD_RUNS = ["qwert", "asdf", "zxcv", "werty", "sdfg", "xcvb", "hjkl", "uiop", "1234"];
const PLACEHOLDER_NAMES = new Set([
  "test", "tester", "testing", "asdf", "admin", "user", "none", "na", "n/a", "xxx", "xx", "x",
  "fake", "buyer", "seller", "car", "cars", "owner", "private", "name", "firstname", "surname",
  "lastname", "unknown", "anonymous", "anon", "abc", "aaa", "mr", "mrs", "ms", "dr",
]);

function looksLikeJunk(part: string): boolean {
  const p = part.toLowerCase().replace(/['’\-. ]/g, "");
  if (PLACEHOLDER_NAMES.has(p)) return true;
  if (KEYBOARD_RUNS.some((run) => p.includes(run))) return true;
  if (/(.)\1{3,}/.test(p)) return true; // aaaa
  if (p.length >= 4 && !/[aeiouyàáâäãåèéêëìíîïòóôöõùúûüýÿ]/.test(p)) return true; // no vowels
  if (/[bcdfghjklmnpqrstvwxz]{6,}/.test(p)) return true; // 6+ consonants in a row
  return false;
}

export type NameProblem = "missing" | "invalid_characters" | "too_short" | "suspect";

/** "missing"/"invalid_characters"/"too_short" must be fixed; "suspect" is held for review. */
export function checkName(first: string, last: string): NameProblem | null {
  const f = first.trim();
  const l = last.trim();
  if (!f || !l) return "missing";
  if (f.length < 2 || l.length < 2) return "too_short";
  if (f.length > 40 || l.length > 40 || !NAME_PART.test(f) || !NAME_PART.test(l)) return "invalid_characters";
  if (f.toLowerCase() === l.toLowerCase()) return "suspect";
  if (looksLikeJunk(f) || looksLikeJunk(l)) return "suspect";
  return null;
}

/** Splits a stored full name ("Mary Jane Smith") into first name and the rest. */
export function splitFullName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function checkFullName(full: string | null | undefined): NameProblem | null {
  const { first, last } = splitFullName(full);
  return checkName(first, last);
}

export const NAME_PROBLEM_MESSAGES: Record<Exclude<NameProblem, "suspect">, string> = {
  missing: "Please enter your first name and surname.",
  too_short: "Please enter your full first name and surname.",
  invalid_characters: "Names can only contain letters, spaces, hyphens and apostrophes.",
};

// ---- Postcodes -------------------------------------------------------------

// Real postcodes that are famous, or that appear as examples in guides and
// documentation, so people (and scammers) type them instead of their own.
// Add to this list when a new one turns up on the dashboard.
const LANDMARK_OR_DUMMY_POSTCODES = new Set([
  "SW1A1AA", // Buckingham Palace (used by three scam accounts by Nov 2026)
  "SW1A2AA", // 10 Downing Street
  "SW1A0AA", // Houses of Parliament
  "SW1A0PW", // Houses of Parliament
  "W1A1AA", // BBC Broadcasting House
  "W1A0AX", // BBC (common example)
  "EC2R8AH", // Bank of England
  "EC1A1BB", // common example postcode
  "EC4M7AN", // St Paul's area example
  "M11AE", // common example postcode
  "B338TH", // common example postcode
  "CR26XH", // common example postcode
  "DN551PT", // common example postcode
  "CR92BY", // Lunar House, Home Office, Croydon
]);

export function normalisePostcode(postcode: string | null | undefined): string {
  return (postcode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isLandmarkPostcode(postcode: string | null | undefined): boolean {
  return LANDMARK_OR_DUMMY_POSTCODES.has(normalisePostcode(postcode));
}

// ---- Email -----------------------------------------------------------------

// Common throwaway-inbox providers. Not exhaustive; add new ones as they
// appear on the dashboard.
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "sharklasers.com",
  "grr.la", "10minutemail.com", "10minutemail.net", "temp-mail.org", "tempmail.com", "tempmail.net",
  "temp-mail.io", "tempmailo.com", "tempr.email", "yopmail.com", "yopmail.net", "trashmail.com",
  "trashmail.de", "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mintemail.com",
  "throwawaymail.com", "fakeinbox.com", "mohmal.com", "emailondeck.com", "spamgourmet.com",
  "moakt.com", "burnermail.io", "mailnesia.com", "mytemp.email", "tmpmail.org", "tmpmail.net",
  "minuteinbox.com", "inboxkitten.com", "discard.email", "mailpoof.com", "33mail.com",
  "spambox.us", "emailfake.com", "fakemail.net", "luxusmail.org", "1secmail.com", "1secmail.org",
  "1secmail.net", "harakirimail.com", "mailcatch.com", "tempinbox.com", "crazymailing.com",
]);

export function isDisposableEmail(email: string | null | undefined): boolean {
  const domain = (email ?? "").toLowerCase().trim().split("@")[1];
  return !!domain && DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
