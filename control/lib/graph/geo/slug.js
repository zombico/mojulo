/**
 * Canonicalize a free-text place query into a stable cache slug.
 *
 * Same input -> same slug, so replay against the cache is deterministic. We
 * lowercase, strip diacritics, collapse non-alphanumeric runs to single
 * hyphens, and trim. "Sweden" / "sweden" / "  Sweden  " all collapse to
 * "sweden"; "São Paulo" -> "sao-paulo"; "St. Lucia" -> "st-lucia".
 *
 * The slug never reaches the renderer or the user — it is the on-disk cache
 * key only. The original query string lives in the `geo` block of the manifest
 * for audit/replay.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

export function slugifyQuery(query) {
  if (typeof query !== 'string') {
    throw new Error('slugifyQuery: query must be a string');
  }
  const folded = query.normalize('NFKD').replace(COMBINING_MARKS, '');
  const slug = folded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) {
    throw new Error(`slugifyQuery: query '${query}' has no slug-safe characters`);
  }
  return slug;
}
