import type { ContentSection } from "@/content/services";

export interface Area {
  slug: string;
  href: string;
  /** Display name, e.g. "Lymington" or "New Milton and Barton on Sea". */
  name: string;
  /** Towns this page covers (used for "area served" in search engine data). */
  towns: string[];
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string[];
  sections: ContentSection[];
  /** Nearby places we also cover, shown at the end of the page. */
  nearby: string[];
}

/**
 * Pages for the towns where we look after the most property. Wording is kept factual and
 * local: edit it here and the page, sitemap and search engine data update together.
 */
export const AREAS: Area[] = [
  {
    slug: "lymington",
    href: "/areas/lymington",
    name: "Lymington",
    towns: ["Lymington"],
    metaTitle: "Holiday Let & Property Management in Lymington",
    metaDescription:
      "Holiday let changeovers, cleaning and property management in Lymington, from a local team based just along the coast in Barton on Sea.",
    h1: "Holiday let and property management in Lymington",
    intro: [
      "Lymington is one of the most sought-after places to own a holiday home on the south coast. The Georgian high street, the cobbled lanes running down to the quay and the busy harbour on the Lymington River give the town a charm that brings guests back year after year.",
      "We look after holiday lets and homes in and around Lymington from our office in Barton on Sea, a short drive along the coast.",
    ],
    sections: [
      {
        heading: "Why guests choose Lymington",
        body: [
          "Sailing is part of everyday life here. The town's marinas and yacht clubs draw visitors from spring to autumn, and the Wightlink ferry to Yarmouth makes Lymington a gateway to the Isle of Wight. On Saturdays the High Street fills with market stalls, and in summer the open-air sea water baths and the walk along the sea wall towards Keyhaven are favourites.",
          "With the New Forest just to the north, guests can spend one day on the water and the next walking or cycling among the ponies.",
        ],
      },
      {
        heading: "What that means for owners",
        body: [
          "Lymington properties tend to be busy for much of the year, not just in the school holidays. Short breaks, sailing weekends and same-day turnarounds are common, and many guests bring dogs. That makes reliable changeovers essential: the property has to be cleaned, the beds made up for the right number of guests and everything reset, often in a few hours between check-out and arrival.",
        ],
      },
      {
        heading: "How we look after Lymington properties",
        body: [
          "Owners add their bookings to their own online account, and our team is told straight away, including the number of guests and dogs and how the beds should be set up. We take care of the cleaning, laundry and linen, and report anything that needs attention. You receive one invoice a month.",
          "Beyond holiday lets, we manage homes and estates for owners who live away, with regular checks and maintenance arranged through trusted local tradespeople.",
        ],
      },
    ],
    nearby: ["Milford on Sea", "Keyhaven", "Sway", "Brockenhurst", "Beaulieu"],
  },
  {
    slug: "milford-on-sea",
    href: "/areas/milford-on-sea",
    name: "Milford on Sea",
    towns: ["Milford on Sea", "Keyhaven"],
    metaTitle: "Holiday Let & Property Management in Milford on Sea",
    metaDescription:
      "Changeovers, cleaning and property care for holiday lets and homes in Milford on Sea and Keyhaven, from our office in nearby Barton on Sea.",
    h1: "Holiday let and property management in Milford on Sea",
    intro: [
      "Milford on Sea sits on the coast between Lymington and Barton on Sea, looking out towards the Needles and the Isle of Wight. It has the feel of a village, with shops and cafés around the green and a long shingle beach lined with beach huts.",
      "It's only a few minutes from our office in Barton on Sea, so we know it well.",
    ],
    sections: [
      {
        heading: "Why guests choose Milford on Sea",
        body: [
          "Hurst Spit stretches more than a mile into the Solent towards Hurst Castle, the coastal fort built by Henry VIII, and in the summer a small ferry runs out to the castle from Keyhaven harbour. Walkers and birdwatchers come for the spit and the saltmarshes, families come for the beach, and plenty of guests simply come for the views.",
          "The New Forest is a short drive inland, so a stay here offers the coast and the forest in one.",
        ],
      },
      {
        heading: "What that means for owners",
        body: [
          "Coastal holiday homes work hard. Sand, salt and wet dogs are part of the job, and the sea air is tough on windows, doors and garden furniture. Changeovers need to be thorough, and small maintenance issues are best caught early, before the next winter storm finds them.",
        ],
      },
      {
        heading: "How we help",
        body: [
          "We handle changeovers, cleaning, laundry and linen between stays, set the beds up for each group and pass on anything that needs fixing. Owners send us their bookings through their online account and receive one invoice a month.",
          "For homes that aren't let, we offer regular property checks and arrange maintenance, which is especially valuable through the winter months.",
        ],
      },
    ],
    nearby: ["Keyhaven", "Lymington", "Barton on Sea", "New Milton", "Highcliffe"],
  },
  {
    slug: "new-milton-barton-on-sea",
    href: "/areas/new-milton-barton-on-sea",
    name: "New Milton and Barton on Sea",
    towns: ["New Milton", "Barton on Sea"],
    metaTitle: "Holiday Let Management in New Milton & Barton on Sea",
    metaDescription:
      "Our office is on Marine Drive East in Barton on Sea. We manage holiday lets, homes and commercial property across New Milton and Barton on Sea.",
    h1: "Holiday let and property management in New Milton and Barton on Sea",
    intro: [
      "This is home. Our office is on Marine Drive East in Barton on Sea, overlooking Christchurch Bay, and the properties we look after in Barton and New Milton are just minutes away.",
      "That means quick responses, local tradespeople we know well, and a team that understands the area.",
    ],
    sections: [
      {
        heading: "Why guests choose New Milton and Barton on Sea",
        body: [
          "Barton on Sea is a clifftop village with views across to the Needles and the Isle of Wight, and the path along the cliff top is popular with walkers. The cliffs themselves are well known to fossil hunters.",
          "New Milton, just inland, has shops, restaurants and a railway station with direct trains to London Waterloo, which makes it an easy place to reach without a car. Between the sea and the New Forest, guests have plenty to do in every season.",
        ],
      },
      {
        heading: "What that means for owners",
        body: [
          "Properties here suit families, couples and walkers all year round, and many guests bring dogs to enjoy the forest and the cliff paths. Being so close to our office means we can usually respond quickly when something needs attention between stays.",
        ],
      },
      {
        heading: "How we help",
        body: [
          "For holiday lets, we take care of changeovers, cleaning, laundry and linen, and set the beds up for each group. Owners book changeovers through their online account and receive one invoice a month.",
          "We also manage homes and estates for owners who live away, and look after commercial property in the area, from finding tenants to collecting rent and arranging maintenance.",
        ],
      },
    ],
    nearby: ["Highcliffe", "Christchurch", "Milford on Sea", "Sway"],
  },
  {
    slug: "brockenhurst",
    href: "/areas/brockenhurst",
    name: "Brockenhurst",
    towns: ["Brockenhurst"],
    metaTitle: "Holiday Let & Property Management in Brockenhurst",
    metaDescription:
      "Holiday let changeovers and property management in Brockenhurst, in the heart of the New Forest, from a local team based in Barton on Sea.",
    h1: "Holiday let and property management in Brockenhurst",
    intro: [
      "Brockenhurst is in the heart of the New Forest National Park, and for many visitors it's the perfect base. Ponies, donkeys and cattle wander through the village, the open forest begins at the edge of the houses, and the railway station has direct trains to London Waterloo.",
      "We look after holiday lets and homes in and around Brockenhurst, a short drive from our office in Barton on Sea.",
    ],
    sections: [
      {
        heading: "Why guests choose Brockenhurst",
        body: [
          "Guests come to walk and cycle. Trails lead straight out of the village onto the open heath and into the woods, and nearby Rhinefield Ornamental Drive, with its towering trees, is one of the forest's best-known spots. The village has pubs, cafés and shops, and thanks to the station many visitors arrive without a car.",
          "It's a year-round destination, with autumn and winter breaks almost as popular as the summer.",
        ],
      },
      {
        heading: "What that means for owners",
        body: [
          "Forest holidays are muddy holidays. Boots, bikes and dogs come back from the trails, so changeovers need to be thorough, and properties need checking for wear and tear more often than you might expect. With so many short breaks and same-day turnarounds, timing matters too.",
        ],
      },
      {
        heading: "How we help",
        body: [
          "Owners add their bookings to their online account and our team is told straight away, including the number of guests and dogs and the bed setup. We take care of the cleaning, laundry and linen, and report anything that needs attention. You receive one invoice a month.",
          "For homes that aren't let, we provide regular property checks and arrange maintenance with trusted local tradespeople.",
        ],
      },
    ],
    nearby: ["Lyndhurst", "Sway", "Lymington", "Beaulieu", "Burley"],
  },
];

export function findArea(slug: string): Area | undefined {
  return AREAS.find((a) => a.slug === slug);
}

/** Which area page (if any) covers a town in the "Where we work" list. */
export function areaForTown(town: string): Area | undefined {
  return AREAS.find((a) => a.towns.includes(town));
}
