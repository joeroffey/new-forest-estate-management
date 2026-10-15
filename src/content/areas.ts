import type { ContentSection, Faq } from "@/content/services";

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
  faqs: Faq[];
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
        heading: "Getting there",
        body: [
          "Lymington has two railway stations, Lymington Town and Lymington Pier, on the branch line from Brockenhurst, where trains connect with the main line to London Waterloo. By road, the A337 links the town with Brockenhurst and Lyndhurst to the north and New Milton to the west.",
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
    faqs: [
      {
        q: "Is Lymington busy outside the summer holidays?",
        a: "Yes. Sailing, the Saturday market and the Isle of Wight ferry keep Lymington busy for much of the year, so short breaks and same-day turnarounds are common outside the school holidays too.",
      },
      {
        q: "Do you cover the villages around Lymington?",
        a: "Yes. We also look after property in Milford on Sea, Keyhaven, Sway, Brockenhurst and Beaulieu.",
      },
      {
        q: "Can you look after a Lymington home that isn't let?",
        a: "Yes. Our estate management service covers regular property checks and maintenance arranged through trusted local tradespeople, with clear reports to you.",
      },
    ],
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
        heading: "Getting there",
        body: [
          "Milford on Sea is just off the A337 coast road, a short drive from New Milton and Lymington, which are also the nearest railway stations. Many guests arrive by car, so it helps to tell them about parking at your property before they travel.",
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
    faqs: [
      {
        q: "Do you look after properties close to the sea?",
        a: "Yes. Coastal properties need extra care, especially after winter storms, so we keep an eye out for salt and weather damage during changeovers and property checks.",
      },
      {
        q: "Do you cover Keyhaven?",
        a: "Yes, along with Lymington, Barton on Sea, New Milton and Highcliffe.",
      },
      {
        q: "Can you look after a Milford on Sea home that isn't let?",
        a: "Yes. Our estate management service covers regular property checks and maintenance arranged through trusted local tradespeople, with clear reports to you.",
      },
    ],
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
        heading: "Getting there",
        body: [
          "New Milton station is on the main line between London Waterloo and Weymouth, and Barton on Sea is a short drive from the station. The A337 runs through New Milton, linking it with Lymington to the east and Highcliffe and Christchurch to the west.",
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
    faqs: [
      {
        q: "Where is your office?",
        a: "At 38 Marine Drive East, Barton on Sea, BH25 7DX. We're open Monday to Friday, 9am to 5pm, and happy to arrange a visit.",
      },
      {
        q: "Do you manage commercial property in New Milton?",
        a: "Yes. Our commercial property management covers marketing the property, screening tenants, collecting the rent and arranging maintenance.",
      },
      {
        q: "Do you cover Highcliffe and Christchurch?",
        a: "Yes, as well as Milford on Sea and Sway.",
      },
    ],
  },
  {
    slug: "christchurch-mudeford",
    href: "/areas/christchurch-mudeford",
    name: "Christchurch and Mudeford",
    towns: ["Christchurch", "Mudeford"],
    metaTitle: "Holiday Let Cleaning & Management, Christchurch & Mudeford",
    metaDescription:
      "Holiday let cleaning, same-day changeovers, deep cleans and property management in Christchurch and Mudeford, from our office in nearby Barton on Sea.",
    h1: "Holiday let cleaning and management in Christchurch and Mudeford",
    intro: [
      "Christchurch sits where the rivers Avon and Stour meet and flow into Christchurch Harbour, with its Priory, its quays and its waterside walks. Mudeford, at the mouth of the harbour, is known for its quay, its fishing boats and the beach huts on Mudeford Sandbank.",
      "Christchurch and Mudeford have always been part of our patch, first as New Forest Holiday Cleaning and now as New Forest Estate Management. Our office in Barton on Sea is a short drive along the coast.",
    ],
    sections: [
      {
        heading: "Why guests choose Christchurch and Mudeford",
        body: [
          "Guests come for the water. Boat trips leave from the town quay, the ferry from Mudeford Quay crosses to the sandbank and Hengistbury Head, and Avon Beach and Friars Cliff are favourites with families. In town, the Priory, the ruins of the Norman castle and the riverside paths around the Quomps make for an easy day out.",
          "The New Forest National Park begins a few miles to the north-east, so guests can spend one day by the sea and the next in the forest.",
        ],
      },
      {
        heading: "Getting there",
        body: [
          "Christchurch station is on the main line between London Waterloo and Weymouth, and Hinton Admiral station serves Highcliffe. Bournemouth Airport is just north of the town. By road, the A35 links Christchurch with Bournemouth to the west and Lyndhurst to the north-east, and the A337 runs east along the coast through Highcliffe to New Milton.",
        ],
      },
      {
        heading: "What that means for owners",
        body: [
          "Waterside holiday homes are busy from spring to autumn, with sailing weekends, family summers and plenty of dogs. Sand and salt get everywhere, and same-day turnarounds are common in the school holidays, so changeovers need to be quick and thorough.",
        ],
      },
      {
        heading: "How we help",
        body: [
          "We clean and change over holiday lets between every stay, make the beds with freshly ironed linen and can arrange welcome hampers for your guests. Owners add their bookings to their online account, our team is told straight away, and you receive one invoice a month.",
          "We also do end of tenancy and deep cleans, and full management for owners who would like us to take care of everything.",
        ],
      },
    ],
    nearby: ["Highcliffe", "Bournemouth", "Barton on Sea", "New Milton"],
    faqs: [
      {
        q: "Do you clean holiday lets in Mudeford?",
        a: "Yes. Mudeford and Christchurch have always been part of our patch, along with Highcliffe, Bournemouth and the New Forest coast.",
      },
      {
        q: "Can you do same-day changeovers in the summer holidays?",
        a: "Yes. We plan each day around check-out and arrival times and put the cleans in the best order, so same-day turnarounds are finished before the next guests arrive.",
      },
      {
        q: "Do you cover Bournemouth?",
        a: "Yes. We clean and look after properties in Bournemouth as well as Christchurch, Mudeford and Highcliffe. Call us if you'd like to check your address.",
      },
      {
        q: "Is Christchurch in the New Forest?",
        a: "Christchurch is in Dorset, just west of the New Forest National Park, so guests get the harbour and the beaches with the forest a short drive away.",
      },
    ],
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
        heading: "Getting there",
        body: [
          "Brockenhurst station is on the main line between London Waterloo and Weymouth, and it's where the branch line to Lymington begins. The A337 runs through the village, between Lyndhurst to the north and Lymington to the south.",
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
    faqs: [
      {
        q: "Do you manage dog-friendly holiday lets in Brockenhurst?",
        a: "Yes. Many guests come to walk in the forest with their dogs, so we allow for dogs in the clean and can put out dog beds and bowls for the next guests.",
      },
      {
        q: "Is Brockenhurst busy all year?",
        a: "Holiday lets here are popular all year round, with autumn and winter walking breaks as well as summer holidays, so short breaks and same-day turnarounds are common.",
      },
      {
        q: "Do you cover Lyndhurst and Burley?",
        a: "Yes, along with Sway, Lymington and Beaulieu.",
      },
    ],
  },
];

export function findArea(slug: string): Area | undefined {
  return AREAS.find((a) => a.slug === slug);
}

/** Which area page (if any) covers a town in the "Where we work" list. */
export function areaForTown(town: string): Area | undefined {
  return AREAS.find((a) => a.towns.includes(town));
}
