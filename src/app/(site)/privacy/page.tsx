import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", description: `How ${site.name} uses your information.` };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-5 pt-10 pb-24 sm:px-8 md:pt-16">
      <h1 className="font-serif text-[clamp(2.2rem,4.6vw,3.6rem)] leading-tight tracking-[-0.02em] text-forest-deep">Privacy notice</h1>
      <div className="prose-site mt-8 space-y-6 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-forest-deep [&_li]:ml-5 [&_li]:list-disc [&_li]:text-ink-soft [&_ul]:mt-3 [&_ul]:space-y-1">
        <p>
          This notice explains how {site.name} (&quot;we&quot;) collects and uses personal information through this
          website and our owner portal.
        </p>
        <h2>What we collect</h2>
        <ul>
          <li>Details you send through the contact form: your name, email, phone number and message.</li>
          <li>For property owners we work with: name, contact details, billing address, property details, booking details and invoices.</li>
          <li>Booking details you give us about guests, such as the number of guests and any notes, so our team can prepare the property.</li>
        </ul>
        <h2>How we use it</h2>
        <p>
          We use this information to reply to enquiries, provide our services, schedule changeovers and cleaning, send
          invoices and keep proper business records. We rely on the contract we have with you and our legitimate
          interest in running the business.
        </p>
        <h2>Who we share it with</h2>
        <p>
          We use trusted providers to run this website and portal: hosting, a secure database, email delivery, and
          scheduling tools used by our team (including a WhatsApp group for our cleaners and our booking calendar).
          They only process data on our instructions. We never sell your information.
        </p>
        <h2>Cookies</h2>
        <p>
          We only use cookies that are needed to keep you signed in to the owner portal. We don&apos;t use advertising
          or tracking cookies.
        </p>
        <h2>How long we keep it</h2>
        <p>
          We keep enquiries for as long as needed to respond, and customer and invoice records for as long as the law
          requires for accounting purposes (normally six years).
        </p>
        <h2>Your rights</h2>
        <p>
          You can ask to see, correct or delete the information we hold about you, or object to how we use it. To do
          so, call us on {site.phoneDisplay}
          {site.email ? ` or email ${site.email}` : ""}, or write to us at {site.address.line1}, {site.address.town},{" "}
          {site.address.postcode}. You can also complain to the Information Commissioner&apos;s Office (ico.org.uk).
        </p>
      </div>
    </article>
  );
}
