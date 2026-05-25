export const protectedPathPrefixes = [
  "/account",
  "/dashboard",
  "/edit-advert",
  "/messages",
  "/payment-success",
  "/publish-advert",
] as const;

export function isProtectedPath(pathname: string) {
  return protectedPathPrefixes.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function safeNextPath(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

export function loginPathFor(pathname: string, reason = "session_expired") {
  const params = new URLSearchParams({ next: pathname, reason });
  return `/login?${params.toString()}`;
}
