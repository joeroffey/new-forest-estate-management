import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-mist px-6 text-center">
      <LogoMark className="size-24 text-forest" />
      <h1 className="mt-6 font-serif text-4xl text-forest-deep">We can&apos;t find that page</h1>
      <p className="mt-3 max-w-md leading-relaxed text-ink-soft">The link may be old or mistyped. Try the home page, or log in to your account.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClasses("primary", "lg")}>Go to the home page</Link>
        <Link href="/login" className={buttonClasses("secondary", "lg")}>Log in</Link>
      </div>
    </main>
  );
}
