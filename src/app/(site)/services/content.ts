export interface Service {
  slug: string;
  title: string;
  short: string;
  summary: string;
  body: string[];
  included: string[];
}

/** Service descriptions. Edit the wording here and it updates the home and services pages. */
export const SERVICES: Service[] = [
  {
    slug: "holiday-rentals",
    title: "Holiday Rental Management",
    short: "holiday rental management",
    summary:
      "Make the most of your holiday rental income. Our full management covers advertising, cleaning, laundry and maintenance, with a personal approach that gives guests a stay worth coming back to.",
    body: [
      "Holiday lets are where we started, managing a single property, and they're still at the heart of what we do. We take care of the work between bookings so your property is ready, spotless and set up exactly as each group needs.",
      "Owners send us their bookings through their own online account. Our cleaning team is told straight away, including same-day turnarounds, the number of guests, dogs and any changes to the bed setup.",
    ],
    included: [
      "Changeovers and cleaning between every stay",
      "Laundry and linen",
      "Maintenance and repairs",
      "Advertising your property",
      "Beds set up for each group",
      "Online booking and monthly invoices",
    ],
  },
  {
    slug: "estate-management",
    title: "Property Estate Management",
    short: "estate management",
    summary:
      "Steady, careful management for homes and estates, whether you live nearby or at a distance. We keep an eye on the property and deal with what needs doing, so you don't have to.",
    body: [
      "Owning property in the New Forest is a pleasure, but it comes with upkeep. We act as your local team, keeping the property in good order and making sure problems are spotted early and handled properly.",
      "You get one point of contact who knows your property and the people who work on it.",
    ],
    included: [
      "Regular property checks",
      "Maintenance arranged and overseen",
      "Trusted local tradespeople",
      "Clear reporting to owners",
    ],
  },
  {
    slug: "commercial",
    title: "Commercial Property Management",
    short: "commercial property management",
    summary:
      "With over 10 years of experience in property management, we help commercial owners make the most of their rental income and take the stress out of running a building.",
    body: [
      "We look after the day-to-day running of commercial property so that owners can step back. From finding the right tenant to keeping the building in good condition, the work is handled by one team.",
    ],
    included: ["Property marketing", "Tenant screening", "Rent collection", "Property maintenance"],
  },
];
