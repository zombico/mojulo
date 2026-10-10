/**
 * A vocab reader's no-id listing: one short row per card, so the agent picks a card by `when` and reads it by `id`.
 * The long fields (name, summary, tier, marks …) are the card's own and come with it; `detail: true` lists them.
 * The row keeps the discriminators a caller filters on (family, entry, scope) beside the id and the `when`.
 */
const ROW_KEYS = ['id', 'family', 'entry', 'scope', 'when'];

export function listingRows(cards, { detail = false } = {}) {
  if (detail) return cards;
  return cards.map((c) => Object.fromEntries(ROW_KEYS.filter((k) => c[k] !== undefined).map((k) => [k, c[k]])));
}

/** The schema property every listing reader takes. */
export const DETAIL_PROPERTY = { type: 'boolean', description: 'Full listing rows.' };
