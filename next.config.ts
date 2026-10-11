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
        missing: [{ type: "host", value: escapedHost }],
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
  async redirects() {
    // Addresses from the old GoDaddy website, so existing links and search results still work.
    return [
      { source: "/contact-us", destination: "/contact", permanent: true },
      { source: "/home", destination: "/", permanent: true },
      { source: "/about-us", destination: "/about", permanent: true },
    ];
  },
};

export default nextConfig;
