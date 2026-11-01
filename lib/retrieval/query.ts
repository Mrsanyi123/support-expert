const STOPWORDS = new Set(
  "the and for are but not you your our with this that from have has had was were will would can could should into than then them they their there what when where which while who why how does did doing just also any all some about only very more most other such each like get got use using used been being its it's i'm we're".split(
    " ",
  ),
);

/**
 * Turns free text into an OR-joined Postgres tsquery string. Tickets are natural
 * language, so AND semantics (plainto_tsquery) would match almost nothing.
 */
export function toOrTsQuery(text: string, maxTerms = 32): string | null {
  const terms = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw) || /^\d+$/.test(raw)) continue;
    terms.add(raw);
    if (terms.size >= maxTerms) break;
  }
  if (terms.size === 0) return null;
  return [...terms].join(" | ");
}
