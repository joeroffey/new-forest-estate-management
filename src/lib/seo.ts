import type { Metadata } from "next";
import { site, townWithCounty } from "@/lib/site";

/**
 * The one public address of the website. Every canonical link, the sitemap and the
 * structured data point here, so search engines index a single copy of each page.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.newforestestatemanagement.co.uk").replace(/\/+$/, "");

export function absoluteUrl(path = "/"): string {
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

const OG_IMAGE = { url: "/brand/og-image.png", width: 1200, height: 630, alt: site.name };

/**
 * Title, description, canonical link and social previews for a public page.
 * Titles are given in full (no brand suffix added) and kept under about 60 characters,
 * because Google shows the site name separately above each result.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_GB",
      siteName: site.name,
      url: path,
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}

/* --------------------------------------------------------------------- Structured data */

export const BUSINESS_ID = `${SITE_URL}/#business`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

type Json = Record<string, unknown>;

/** The business itself: name, address, phone, hours, areas and services. */
export function businessJsonLd(services: Array<{ name: string; path: string; description: string }>): Json {
  const business: Json = {
    "@type": "RealEstateAgent",
    "@id": BUSINESS_ID,
    name: site.name,
    alternateName: [...site.formerNames],
    description: site.description,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/apple-touch-icon.png"),
    image: absoluteUrl("/brand/og-image.png"),
    telephone: site.phoneHref.replace(/^tel:/, ""),
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.line1,
      addressLocality: site.address.town,
      addressRegion: site.address.county,
      postalCode: site.address.postcode,
      addressCountry: "GB",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "17:00",
      },
    ],
    areaServed: [
      { "@type": "AdministrativeArea", name: "New Forest" },
      ...site.areas.map((name) => ({ "@type": "Place", name: townWithCounty(name) })),
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Property management and cleaning services",
      itemListElement: services.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.name, description: s.description, url: absoluteUrl(s.path) },
      })),
    },
  };
  if (site.email) business.email = site.email;
  if (site.sameAs.length) business.sameAs = [...site.sameAs];
  return business;
}

export function websiteJsonLd(): Json {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl("/"),
    name: site.name,
    inLanguage: "en-GB",
    publisher: { "@id": BUSINESS_ID },
  };
}

/** "Home › Services › Holiday let management" trail for search results. */
export function breadcrumbJsonLd(trail: Array<{ name: string; path: string }>): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...trail].map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(faqs: Array<{ q: string; a: string }>): Json {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function serviceJsonLd({ name, description, path, serviceType, areas }: { name: string; description: string; path: string; serviceType: string; areas: string[] }): Json {
  return {
    "@type": "Service",
    "@id": `${absoluteUrl(path)}#service`,
    name,
    description,
    serviceType,
    url: absoluteUrl(path),
    provider: { "@id": BUSINESS_ID },
    areaServed: areas.map((name) => ({ "@type": "Place", name: townWithCounty(name) })),
  };
}
