import type { MetadataRoute } from "next";
import { SERVICES } from "@/content/services";
import { AREAS } from "@/content/areas";
import { absoluteUrl } from "@/lib/seo";

/**
 * Public pages only. No "last modified" dates: a build timestamp on every URL would tell
 * search engines that everything changed on each deploy, and they'd stop trusting it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1 },
    { path: "/services", priority: 0.9 },
    ...SERVICES.map((s) => ({ path: s.href, priority: 0.9 })),
    ...AREAS.map((a) => ({ path: a.href, priority: 0.8 })),
    { path: "/holiday-homes", priority: 0.7 },
    { path: "/about", priority: 0.7 },
    { path: "/contact", priority: 0.7 },
    { path: "/privacy", priority: 0.3 },
  ];
  return pages.map(({ path, priority }) => ({ url: absoluteUrl(path), priority }));
}
