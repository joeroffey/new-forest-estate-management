export interface HolidayHome {
  slug: string;
  name: string;
  /** How the enquiry message names it: "I'd like to ask about staying at …". */
  enquiryName: string;
  /** Where it is, in a few words: "Near Beaulieu, New Forest". */
  place: string;
  /** Number of bedrooms, when known. */
  bedrooms?: number;
  description: string;
  features: string[];
  /** Which line drawing to show until there's a photo: forest or coast. */
  setting: "forest" | "coast";
  /** A photo in /public, e.g. "/holiday-homes/cherry-tree-cottage.jpg". Shown instead of the drawing. */
  photo?: string;
}

/**
 * Holiday homes guests can ask about, carried over from the New Forest Holiday Cleaning website.
 * Each one's "Ask about dates" button opens the contact form with the home already filled in
 * (the form reads this list, so a new home here works there too).
 */
export const HOLIDAY_HOMES: HolidayHome[] = [
  {
    slug: "cherry-tree-cottage",
    name: "Cherry Tree Cottage",
    enquiryName: "Cherry Tree Cottage",
    place: "Near Beaulieu, New Forest",
    bedrooms: 4,
    description:
      "A cottage just outside Lymington, near Beaulieu, right in the heart of the New Forest, with a garden and the forest's ponies close by.",
    features: ["Four bedrooms", "Living room", "Kitchen", "Bathroom", "Garden"],
    setting: "forest",
  },
  {
    slug: "milford-on-sea-apartment",
    name: "Ground-floor apartment, Milford on Sea",
    enquiryName: "the ground-floor apartment in Milford on Sea",
    place: "Near the beach, Milford on Sea",
    bedrooms: 2,
    description: "A stunning two-bedroom ground-floor apartment near the beach at Milford on Sea.",
    features: ["Two bedrooms", "Ground floor", "Near the beach"],
    setting: "coast",
  },
  {
    slug: "barton-on-sea-apartment",
    name: "First-floor apartment, Barton on Sea",
    enquiryName: "the first-floor apartment in Barton on Sea",
    place: "Near the cliff top, Barton on Sea",
    bedrooms: 2,
    description: "A beautiful two-bedroom first-floor apartment near the cliff top at Barton on Sea.",
    features: ["Two bedrooms", "First floor", "Near the cliff top"],
    setting: "coast",
  },
];

export function findHolidayHome(slug: string): HolidayHome | undefined {
  return HOLIDAY_HOMES.find((h) => h.slug === slug);
}
