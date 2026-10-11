/** Public business details shown on the website. Update here to change them everywhere. */
export const site = {
  name: "New Forest Estate Management",
  shortName: "New Forest",
  tagline: "Estate Management",
  description:
    "Holiday rental, estate and commercial property management across the New Forest and the Hampshire coast, based in Barton on Sea.",
  phoneDisplay: "07851 489297",
  phoneHref: "tel:+447851489297",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
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
    "Brockenhurst",
    "Sway",
    "Lyndhurst",
    "Beaulieu",
    "Burley",
  ],
} as const;
