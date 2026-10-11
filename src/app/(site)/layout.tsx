import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { JsonLd } from "@/components/site/json-ld";
import { SERVICES } from "@/content/services";
import { businessJsonLd, websiteJsonLd } from "@/lib/seo";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-mist">
      <JsonLd
        items={[
          businessJsonLd(SERVICES.map((s) => ({ name: s.title, path: s.href, description: s.metaDescription }))),
          websiteJsonLd(),
        ]}
      />
      <a href="#main" className="sr-only z-50 rounded bg-forest px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
