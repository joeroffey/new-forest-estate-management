/** Structured data for search engines. Several items share one @graph. */
export function JsonLd({ items }: { items: Array<Record<string, unknown>> }) {
  const data = { "@context": "https://schema.org", "@graph": items };
  return (
    <script
      type="application/ld+json"
      // "<" is escaped so the JSON can never close the script tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
