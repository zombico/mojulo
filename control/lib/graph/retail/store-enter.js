/**
 * A PLACE'S `enter` — the setting a town or a city reads to have its shops walked into (store-slot.js builds them).
 * Its own small module, so a reader of settings (geotown/read.js, geocity/metro.js) takes it without the store's
 * builders.
 *
 *   ENTER_CARDS        the cards a street's shop takes unless it is told its own (the light ones)
 *   ENTER_NEAR         how far past its door an inside is drawn (m)
 *   readEnter(v, no)   true | { cards?: [a seeded card's id…], near?: metres } → { cards, near } | null; `no(msg)`
 *                      throws the client's own error
 *
 * Pure.
 */
import { resolveCard } from './store-cards.js';

// (the cafe and the food hall are left out until their fixtures are lighter: at a street's slot they stand over the
// slot's faces or shed what makes them themselves; a town may still name them)
export const ENTER_CARDS = Object.freeze(['apparel', 'electronics', 'bookstore', 'homewares']);
export const ENTER_NEAR = 40;

export function readEnter(v, no = (msg) => { throw new Error(msg); }) {
  if (v === undefined || v === null || v === false) return null;
  if (v !== true && (typeof v !== 'object' || Array.isArray(v))) no('enter is true or { cards?, near? }');
  const o = v === true ? {} : v;
  for (const k of Object.keys(o)) if (!['cards', 'near'].includes(k)) no(`enter.${k} is not a setting (cards, near)`);
  const cards = o.cards ?? ENTER_CARDS;
  if (!Array.isArray(cards) || !cards.length || cards.some((c) => typeof c !== 'string' || !resolveCard(c))) no('enter.cards is a list of seeded store cards\' ids');
  if (o.near !== undefined && !(Number.isFinite(o.near) && o.near >= 10 && o.near <= 320)) no('enter.near is metres in [10, 320]');
  return { cards: [...cards], near: o.near ?? ENTER_NEAR };
}
