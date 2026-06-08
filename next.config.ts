import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["duls-mac-mini.local"],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
