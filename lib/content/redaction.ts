const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// UK mobile numbers starting 07, and UK landlines starting 01/02.
// Allows common separators such as spaces, dashes, dots and brackets.
const UK_PHONE_REGEX = /(?:\+44\s?\(?0?\)?\s?|0)(?:7\d{2}|1\d{2}|2\d{2})[\s().-]*\d[\d\s().-]{5,}\d/g;

export const CONTACT_REDACTION_NOTICE =
  "Contact details removed — use the message system to connect.";

export function redactContactDetails(value: string | null | undefined) {
  const original = value || "";
  let redacted = original
    .replace(EMAIL_REGEX, "")
    .replace(UK_PHONE_REGEX, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    text: redacted,
    redacted: redacted !== original.trim(),
  };
}
