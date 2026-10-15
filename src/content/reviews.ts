export interface GuestReview {
  name: string;
  quote: string;
}

/**
 * What guests have said about the homes we look after, carried over from the
 * New Forest Holiday Cleaning website. Add new ones here; pages pick them by name.
 */
export const GUEST_REVIEWS: GuestReview[] = [
  {
    name: "Warren",
    quote: "Pippa and her team are just the best. We have had the best summer… I would highly recommend Pippa and her team.",
  },
  { name: "Jenny", quote: "Would so recommend this fabulous house. So central, spotlessly clean and we had a great time." },
  {
    name: "Henry",
    quote: "Clean, organised and all the amenities one needs inside. Easily contactable hosts. Would stay there again and recommend.",
  },
  { name: "Julia", quote: "Cosy, clean and comfortable." },
  {
    name: "Charlotte",
    quote: "Fantastic location. Very clean! Would recommend accommodation and would definitely stay here again.",
  },
  { name: "Rose", quote: "The house is amazing! Spacious, clean, comfortable and great location." },
];

export function reviewsByName(names: string[]): GuestReview[] {
  return names.map((n) => GUEST_REVIEWS.find((r) => r.name === n)).filter((r): r is GuestReview => Boolean(r));
}
