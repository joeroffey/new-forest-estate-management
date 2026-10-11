import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/logo";
import { site } from "@/lib/site";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-mist lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-forest-night text-mist lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="w-fit rounded-md">
          <Logo inverse />
        </Link>
        <LogoMark className="pointer-events-none absolute -right-24 -bottom-24 size-[34rem] text-forest opacity-60" title="" />
        <div className="relative max-w-sm">
          <p className="font-serif text-[2.4rem] leading-[1.1] tracking-[-0.02em] text-mist">Your bookings and invoices, in one place.</p>
          <p className="mt-4 leading-relaxed text-sage">
            Questions about your account? Call us on{" "}
            <a href={site.phoneHref} className="text-mist underline underline-offset-4">
              {site.phoneDisplay}
            </a>
            .
          </p>
        </div>
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="w-fit rounded-md lg:hidden">
          <Logo compact />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
        <p className="text-center text-xs text-ink-faint">
          <Link href="/" className="hover:text-forest">
            Back to {site.name}
          </Link>
        </p>
      </main>
    </div>
  );
}
