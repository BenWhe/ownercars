import type { Metadata } from "next";

// Single source for the canonical origin. Canonicals, sitemap URLs and JSON-LD
// ids are always built from this, never from the request host, so preview
// deployments and the apex domain can't leak into what search engines see.
export const SITE_URL = "https://www.ownercars.co.uk";
export const SITE_NAME = "OwnerCars";

type PageMetadataInput = {
  /** Page title without the " | OwnerCars" suffix (the root template adds it). */
  title: string;
  description: string;
  /** Path relative to SITE_URL, e.g. "/pricing". Used for canonical and og:url. */
  path: string;
  /** Use the title exactly as given (no " | OwnerCars" suffix). */
  absoluteTitle?: boolean;
  /** Keep out of search results (still crawlable, links still followed). */
  noindex?: boolean;
  /** Override the default site-wide social image. */
  image?: string;
};

// app/opengraph-image.png. Next.js only attaches the file-based image to pages
// that don't set their own openGraph object, so pageMetadata adds it explicitly.
const DEFAULT_SOCIAL_IMAGE = { url: "/opengraph-image.png", width: 1200, height: 630 };

/**
 * Builds a complete per-page metadata block.
 *
 * Next.js replaces (rather than merges) `openGraph` and `twitter` objects when a
 * page sets them, so every page goes through this helper to keep siteName,
 * locale and type consistent. Canonicals are set per page and never in the root
 * layout: a canonical in the layout would be inherited by any page that forgot
 * to set its own and point it at the homepage.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  noindex = false,
  image,
}: PageMetadataInput): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "en_GB",
      type: "website",
      images: [image ? { url: image } : DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image ?? DEFAULT_SOCIAL_IMAGE.url],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Metadata for utility pages (login, password reset…) that shouldn't be indexed. */
export function noindexMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: true },
  };
}
