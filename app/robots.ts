import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.ownercars.co.uk";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/account",
        "/messages",
        "/payment-success",
        "/payment-cancelled",
        "/adverts/reconfirm",
        "/edit-advert/",
        "/publish-advert/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
