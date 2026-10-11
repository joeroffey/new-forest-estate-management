import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.newforestestatemanagement.co.uk").replace(/\/+$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/portal", "/api", "/invite", "/setup", "/auth"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
