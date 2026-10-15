/** Public business details shown on the website. Update here to change them everywhere. */
export const site = {
  name: "New Forest Estate Management",
  shortName: "New Forest",
  tagline: "Estate Management",
  /** Other names the business is known by. New Forest Holiday Cleaning's website now redirects here. */
  formerNames: ["New Forest Holiday Cleaning"],
  description:
    "Holiday let management and cleaning, end of tenancy cleans, and estate and commercial property management across the New Forest and the coast, based in Barton on Sea.",
  phoneDisplay: "07851 489297",
  phoneHref: "tel:+447851489297",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  /** The business's social pages (from the New Forest Holiday Cleaning website), for search engines. */
  sameAs: [
    "https://www.facebook.com/newforestestatemanagement/",
    "https://www.facebook.com/newforestholiday.cleaning",
    "https://www.instagram.com/NewForestHolidayCleaning",
    "https://x.com/NewForestEst",
    "https://www.youtube.com/@newforestholidaycleaning",
  ] as readonly string[],
  /** Shown in the footer. */
  social: [
    { label: "Facebook", href: "https://www.facebook.com/newforestestatemanagement/" },
    { label: "Instagram", href: "https://www.instagram.com/NewForestHolidayCleaning" },
  ] as ReadonlyArray<{ label: string; href: string }>,
  address: {
    line1: "38 Marine Drive East",
    town: "Barton on Sea",
    county: "Hampshire",
    postcode: "BH25 7DX",
  },
  hours: [
    { days: "Monday to Friday", time: "9am – 5pm" },
    { days: "Saturday and Sunday", time: "Closed" },
  ],
  areas: [
    "Barton on Sea",
    "New Milton",
    "Milford on Sea",
    "Lymington",
    "Keyhaven",
    "Highcliffe",
    "Christchurch",
    "Mudeford",
    "Bournemouth",
    "Brockenhurst",
    "Sway",
    "Lyndhurst",
    "Beaulieu",
    "Burley",
  ],
} as const;

/** Towns on our patch that are in Dorset rather than Hampshire (Bournemouth, Christchurch and Poole council). */
const DORSET_TOWNS = new Set(["Highcliffe", "Christchurch", "Mudeford", "Bournemouth"]);

/** "Lymington, Hampshire" or "Christchurch, Dorset", for search engine data. */
export function townWithCounty(town: string): string {
  return `${town}, ${DORSET_TOWNS.has(town) ? "Dorset" : "Hampshire"}`;
}
