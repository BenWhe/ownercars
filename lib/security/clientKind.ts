// Sessions recorded by Supabase Auth carry the user agent of whatever made
// the request. Real browsers (desktop and mobile, including in-app browsers)
// all send a "Mozilla/5.0 …" user agent. Anything else ("node", curl, a
// mail provider's link checker) is a program, and the IP address belongs to
// whatever server ran it, so it can't be treated as the account holder's
// own connection.

export function isBrowserUserAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent && /^Mozilla\/\d/.test(userAgent.trim());
}

export const NON_BROWSER_NOTE =
  "not a web browser: an automated tool or a link-checking service, so this IP may not be the account holder's own connection";
