import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// The one address search engines should index. Copies of the site on any other address
// (the vercel.app address, preview links) are marked "noindex" so they never compete with it.
const canonicalHost = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.newforestestatemanagement.co.uk").host;
const escapedHost = canonicalHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const canonicalOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.newforestestatemanagement.co.uk").origin;

/** newforestholidaycleaning.co.uk, with or without www. */
const OLD_CLEANING_HOST = "(?:www\\.)?newforestholidaycleaning\\.co\\.uk";

/** Old page → new page. Anything else on the old site goes to the cleaning page (the last rule). */
const OLD_CLEANING_SITE: Array<[string, string]> = [
  ["/", "/services/holiday-let-cleaning"],
  ["/home", "/services/holiday-let-cleaning"],
  ["/services", "/services/holiday-let-cleaning"],
  ["/holiday-properties", "/holiday-homes"],
  ["/about", "/about"],
  ["/contact", "/contact"],
  ["/:path*", "/services/holiday-let-cleaning"],
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/:path*",
        // (The old cleaning domain only ever redirects, so it's left out too.)
        missing: [
          { type: "host", value: escapedHost },
          { type: "host", value: OLD_CLEANING_HOST },
        ],
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
  async redirects() {
    return [
      // New Forest Holiday Cleaning's old website (both www. and the bare domain, once the domain
      // points here). Every old page goes to its closest new page, so links, bookmarks and search
      // rankings carry over. 301s, the classic "moved permanently" that every search tool expects.
      // These come first, so they win over the rules below.
      ...OLD_CLEANING_SITE.map(([source, destination]) => ({
        source,
        has: [{ type: "host" as const, value: OLD_CLEANING_HOST }],
        destination: `${canonicalOrigin}${destination}`,
        statusCode: 301 as const,
      })),
      // Addresses from the old GoDaddy website, so existing links and search results still work.
      { source: "/contact-us", destination: "/contact", permanent: true },
      { source: "/home", destination: "/", permanent: true },
      { source: "/about-us", destination: "/about", permanent: true },
    ];
  },
};

export default nextConfig;
