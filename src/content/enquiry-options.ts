/**
 * Choices for "What can we help with?" on the contact form. The key is what pages put in the
 * link (/contact?service=holiday-let-cleaning) to choose it in advance. Kept apart from the
 * page content so the form doesn't carry every page's wording to the browser.
 */
export const ENQUIRY_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "holiday-rental-management", label: "Holiday let management" },
  { key: "holiday-let-cleaning", label: "Holiday let cleaning and changeovers" },
  { key: "end-of-tenancy-cleaning", label: "End of tenancy or deep clean" },
  { key: "estate-management", label: "Property estate management" },
  { key: "commercial-property-management", label: "Commercial property management" },
  { key: "holiday-homes", label: "Staying in one of your holiday homes" },
  { key: "other", label: "Something else" },
];

export const BEDROOM_OPTIONS = ["1 bedroom", "2 bedrooms", "3 bedrooms", "4 bedrooms", "5 or more bedrooms"];

/** Holiday homes guests can ask about, by the key used in /contact?home=… */
export const HOLIDAY_HOME_NAMES: Record<string, string> = {
  "cherry-tree-cottage": "Cherry Tree Cottage",
  "milford-on-sea-apartment": "the ground-floor apartment in Milford on Sea",
  "barton-on-sea-apartment": "the first-floor apartment in Barton on Sea",
};
