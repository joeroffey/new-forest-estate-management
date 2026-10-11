import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/portal", "/api", "/invite", "/setup", "/auth"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
