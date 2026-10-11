export interface Faq {
  q: string;
  a: string;
}

export interface ContentSection {
  heading: string;
  body: string[];
  list?: string[];
}

export interface Service {
  slug: string;
  href: string;
  /** Name used in headings and menus. */
  title: string;
  /** Lower-case name for sentences: "Ask about holiday let management". */
  short: string;
  /** One-paragraph pitch for the home and services pages. */
  summary: string;
  /** Bullet list for the home and services pages. */
  included: string[];
  /** Search engine title (about 60 characters at most) and description (about 155). */
  metaTitle: string;
  metaDescription: string;
  serviceType: string;
  h1: string;
  intro: string[];
  sections: ContentSection[];
  faqs: Faq[];
}

/**
 * The three services. Edit the wording here and the home page, services page, each
 * service's own page, the sitemap and the search engine data all update together.
 */
export const SERVICES: Service[] = [
  {
    slug: "holiday-rental-management",
    href: "/services/holiday-rental-management",
    title: "Holiday Rental Management",
    short: "holiday let management",
    summary:
      "Make the most of your holiday rental income. Our full management covers advertising, cleaning, laundry and maintenance, with a personal approach that gives guests a stay worth coming back to.",
    included: [
      "Changeovers and cleaning between every stay",
      "Laundry and linen",
      "Maintenance and repairs",
      "Advertising your property",
      "Beds set up for each group",
      "Online booking and monthly invoices",
    ],
    metaTitle: "Holiday Let Management in the New Forest & Hampshire Coast",
    metaDescription:
      "Changeovers, cleaning, laundry and maintenance for holiday lets across the New Forest and coast, with online booking and one monthly invoice.",
    serviceType: "Holiday let management",
    h1: "Holiday let management in the New Forest",
    intro: [
      "Holiday lets are where New Forest Estate Management began, with a single rental property, and they are still at the heart of what we do. We look after everything that happens between one group of guests leaving and the next arriving, so your property is clean, set up and ready on time, every time.",
      "We work with owners across the New Forest and along the Hampshire coast, from cottages in Brockenhurst and Burley to seaside homes in Milford on Sea, Barton on Sea and Lymington. Some owners live nearby. Many live elsewhere and rely on us to be their team on the ground.",
    ],
    sections: [
      {
        heading: "What's included",
        body: ["Every property is different, so we agree the details with you when we first visit. Most owners ask us to take care of:"],
        list: [
          "Changeovers and cleaning between every stay, to the same standard each time",
          "Laundry and linen, so beds are freshly made and towels are ready",
          "Beds set up for each group, whether that's twins, doubles or an extra bed",
          "Extras such as travel cots, high chairs, dog beds and welcome packs",
          "Maintenance and repairs, reported to you and arranged",
          "Help advertising your property",
          "An online account for your bookings, and one invoice a month",
        ],
      },
      {
        heading: "How changeovers work",
        body: [
          "A changeover is the few hours between check-out and check-in. Guests usually leave by 10am and the next arrive from 4pm, though we work to the times you set for your property. In that window the property is cleaned from top to bottom, the beds are changed, the bathrooms and kitchen are reset, and anything the next guests need is put in place.",
          "Same-day turnarounds, where one group leaves and another arrives on the same day, are common in the New Forest, especially at weekends and in the school holidays. Our booking system flags them automatically, so the team knows that clean can't wait.",
          "If we spot something that needs attention, such as a dripping tap, a broken lamp or something a guest has left behind, we tell you and, with your agreement, get it sorted.",
        ],
      },
      {
        heading: "Book changeovers online, not by email",
        body: [
          "Every owner gets their own secure online account. Instead of filling in a booking sheet and emailing it across, you enter each stay: the arrival and departure dates, the number of adults, children and dogs, how the beds should be set up and anything else we should know. You can add a single booking or a whole season in one go.",
          "As soon as a booking is added, changed or cancelled, the cleaning team is told. Bookings from Airbnb, Booking.com, Vrbo, direct guests and your own family stays all go in the same place, so nothing falls through the gaps.",
        ],
      },
      {
        heading: "One clear invoice a month",
        body: [
          "Each month you receive one invoice by email, listing the work done for each stay. Every invoice is also kept in your online account, so you can see at a glance what has been paid and what is due. Payment is by bank transfer.",
        ],
      },
      {
        heading: "Why a local team makes the difference",
        body: [
          "We're based on Marine Drive East in Barton on Sea, a short drive from the properties we look after. Being local means we can get to a property quickly when something needs attention, and we understand the rhythm of the New Forest holiday season, from packed summer weekends to quieter winter breaks.",
        ],
      },
    ],
    faqs: [
      {
        q: "What does holiday let management include?",
        a: "Changeovers and cleaning between stays, laundry and linen, setting up the beds for each group, maintenance and repairs, and help advertising your property. Bookings are managed through your own online account and you receive one invoice a month. We agree exactly what you need when we first visit your property.",
      },
      {
        q: "How do I tell you about new bookings?",
        a: "Log in to your owner account and add the stay: the dates, the number of guests and dogs, and the bed setup. You can add several stays at once. Our team is told straight away, and any changes or cancellations you make are passed on automatically.",
      },
      {
        q: "Can you handle same-day turnarounds?",
        a: "Yes. Same-day turnarounds are part of everyday life for New Forest holiday lets. Our system flags them as soon as the bookings are entered, so the clean is scheduled between the morning check-out and the afternoon arrival.",
      },
      {
        q: "Do you look after dog-friendly holiday lets?",
        a: "Yes. Tell us how many dogs are coming when you add a booking. We allow for them in the clean and can put out dog beds and bowls for the next guests.",
      },
      {
        q: "How much does holiday let management cost?",
        a: "It depends on the size of the property, how often it's let and what you'd like us to do, so we give you a clear quote after looking round. You're invoiced once a month for the work done, and you pay by bank transfer.",
      },
      {
        q: "Which areas do you cover?",
        a: "We're based in Barton on Sea and look after holiday lets across the New Forest and the coast, including Lymington, Milford on Sea, Keyhaven, New Milton, Highcliffe, Christchurch, Brockenhurst, Sway, Lyndhurst, Beaulieu and Burley. If you're not sure whether we cover your area, give us a call.",
      },
      {
        q: "Do I need to live locally?",
        a: "No. Many of the owners we work with live elsewhere. Your online account shows every booking and invoice, and we keep you informed whenever something needs a decision.",
      },
    ],
  },
  {
    slug: "estate-management",
    href: "/services/estate-management",
    title: "Property Estate Management",
    short: "estate management",
    summary:
      "Steady, careful management for homes and estates, whether you live nearby or at a distance. We keep an eye on the property and deal with what needs doing, so you don't have to.",
    included: [
      "Regular property checks",
      "Maintenance arranged and overseen",
      "Trusted local tradespeople",
      "Clear reporting to owners",
    ],
    metaTitle: "Property & Estate Management in the New Forest",
    metaDescription:
      "Local management for homes and estates in the New Forest: regular checks, maintenance arranged with trusted tradespeople and clear reports to owners.",
    serviceType: "Residential property and estate management",
    h1: "Property and estate management in the New Forest",
    intro: [
      "Owning a home or an estate in the New Forest is a pleasure, but it comes with upkeep, and that's hard to keep on top of if you live away or simply don't have the time. We act as your local team: keeping an eye on the property, dealing with what needs doing, and making sure small problems are found before they become big ones.",
      "You get one point of contact who knows your property, its quirks and the people who work on it.",
    ],
    sections: [
      {
        heading: "What we look after",
        body: ["Every property is different, so we agree a plan with you. It's usually built around:"],
        list: [
          "Regular property checks, inside and out",
          "Maintenance and repairs, arranged and overseen",
          "Trusted local tradespeople, chosen for the job",
          "Clear reporting, so you always know the property's condition",
          "A single point of contact for everything",
        ],
      },
      {
        heading: "Regular checks that catch problems early",
        body: [
          "A property that stands empty for weeks at a time, or a large house with outbuildings and grounds, needs someone to walk round it regularly. On each visit we look for the things that turn into expensive repairs if they're left: signs of leaks or damp, blocked gutters and drains, storm damage, heating problems and anything that affects security.",
          "We agree with you how often we visit, and the schedule can change with the seasons, with more frequent checks over the winter, when storms and cold weather are most likely to cause damage.",
        ],
      },
      {
        heading: "Maintenance handled from start to finish",
        body: [
          "When something needs doing, we arrange it. We use trusted local tradespeople, book the work in, let them in and check that the job has been done properly. If you already have people you trust, we're happy to work with them.",
          "We agree with you in advance how decisions and costs are approved, so routine jobs can be dealt with quickly and anything larger comes to you first.",
        ],
      },
      {
        heading: "Reporting you can rely on",
        body: [
          "The hardest part of owning property at a distance is not knowing what's going on. We keep you informed: what we found, what we did and what we recommend. If something needs a decision, we ask. If something goes wrong, we tell you straight away.",
        ],
      },
      {
        heading: "Holiday lets and homes under one roof",
        body: [
          "Many owners let their property to holiday guests for part of the year and use it themselves the rest of the time. Because we manage holiday lets too, we can look after the property whichever way it's being used, with the same team and the same standards.",
        ],
      },
    ],
    faqs: [
      {
        q: "Who is estate management for?",
        a: "Owners of homes, second homes and estates in and around the New Forest who want a reliable local team to look after their property, whether they live abroad, elsewhere in the UK, or nearby but short of time.",
      },
      {
        q: "How often will you visit my property?",
        a: "We agree that with you. Some properties need a check every week, others every month, and many benefit from extra visits in the winter or after a storm.",
      },
      {
        q: "Do you use your own tradespeople?",
        a: "We work with trusted local tradespeople, and we arrange and oversee the work. If you already have people you use and trust, we're happy to work with them instead.",
      },
      {
        q: "How do you keep me updated?",
        a: "After each visit, and whenever work is carried out, we tell you what we found and what was done. If anything needs your decision, we contact you before going ahead.",
      },
      {
        q: "Can you also manage my property as a holiday let?",
        a: "Yes. We manage holiday lets too, so if you let your property to guests for part of the year we can also take care of the changeovers, cleaning and bookings.",
      },
    ],
  },
  {
    slug: "commercial-property-management",
    href: "/services/commercial-property-management",
    title: "Commercial Property Management",
    short: "commercial property management",
    summary:
      "With over 10 years of experience in property management, we help commercial owners make the most of their rental income and take the stress out of running a building.",
    included: ["Property marketing", "Tenant screening", "Rent collection", "Property maintenance"],
    metaTitle: "Commercial Property Management in the New Forest",
    metaDescription:
      "Commercial property management across the New Forest and Hampshire coast: marketing, tenant screening, rent collection and maintenance from one team.",
    serviceType: "Commercial property management",
    h1: "Commercial property management",
    intro: [
      "With over 10 years of experience in property management, we help commercial owners get the most from their rental income and take the stress out of running a building. We look after the day-to-day running of your property so that you can step back, knowing it's in good hands.",
      "From finding the right tenant to collecting the rent and keeping the building in good condition, the work is handled by one local team.",
    ],
    sections: [
      {
        heading: "What's included",
        body: ["We tailor the service to your property, and it typically covers:"],
        list: [
          "Marketing your property to find the right tenant",
          "Tenant screening before a tenancy is agreed",
          "Rent collection, with payments tracked and followed up",
          "Maintenance arranged and overseen",
          "One local point of contact",
        ],
      },
      {
        heading: "Finding the right tenant",
        body: [
          "An empty unit costs money every week it stands vacant, but the wrong tenant can cost far more. We market your property to reach suitable businesses and screen applicants before a tenancy is agreed, so you can be confident about who is moving in.",
        ],
      },
      {
        heading: "Rent collection",
        body: [
          "We collect the rent and keep track of every payment, following up promptly if anything is late, so your income arrives when it should and you're not left chasing tenants yourself.",
        ],
      },
      {
        heading: "Keeping the building in good order",
        body: [
          "Well-maintained premises keep good tenants. We arrange and oversee repairs and maintenance using trusted local tradespeople, and keep you informed about the condition of the building and any work that's needed.",
        ],
      },
      {
        heading: "Always knowing where things stand",
        body: [
          "We keep you informed about rent received, the condition of the building and any work that's needed. Routine matters are dealt with as agreed, and we come to you before committing to anything significant, so there are no surprises.",
        ],
      },
      {
        heading: "A local team",
        body: [
          "We're based in Barton on Sea and work across the New Forest and the Hampshire coast. Being local means we can visit quickly, meet tenants and contractors on site, and keep a closer eye on your property than a distant agency could.",
        ],
      },
    ],
    faqs: [
      {
        q: "What does commercial property management include?",
        a: "Marketing the property, screening tenants, collecting the rent and arranging maintenance, with one local team as your point of contact.",
      },
      {
        q: "Can you help find a tenant for an empty unit?",
        a: "Yes. We market the property to find a suitable tenant and screen applicants before a tenancy is agreed.",
      },
      {
        q: "Do you collect the rent?",
        a: "Yes. We collect the rent and keep track of payments, following up if a payment is late.",
      },
      {
        q: "How much experience do you have?",
        a: "We have over 10 years of experience in property management. We started with a single holiday rental and have grown into a company that looks after holiday lets, homes, estates and commercial property.",
      },
      {
        q: "Can you take over from another managing agent?",
        a: "Yes. Talk to us about your property and the current arrangements, and we'll explain how the handover would work.",
      },
      {
        q: "Which areas do you cover?",
        a: "We work across the New Forest and the Hampshire coast from our office in Barton on Sea. Call us to talk about your property.",
      },
    ],
  },
];

export function findService(slug: string): Service | undefined {
  return SERVICES.find((s) => s.slug === slug);
}
