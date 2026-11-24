import type { NextConfig } from "next";

// Baseline security headers. A full Content-Security-Policy is left for a
// separate change: it needs testing against Stripe, Supabase and analytics.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\")" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["duls-mac-mini.local"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
