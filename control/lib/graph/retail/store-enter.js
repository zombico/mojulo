/**
 * A PLACE'S `enter` — the setting a town or a city reads to have its shops walked into (store-slot.js builds them),
 * and a street's TENANCY: which stores it lets to. Its own small module, so a reader of settings (geotown/read.js,
 * geocity/metro.js) takes it without the store's builders.
 *
 *   TENANCY            { <street>: { <a seeded card's id>: its share } }: a main street's, an avenue's (a major
 *                      street's, a neighbourhood's edge), an old town's. A new street is a row; a new store a card
 *                      (store-cards.js) and its share here. Only cards light at a street's slot are let
 *   ENTER_CARDS        every card a street lets to
 *   ENTER_NEAR         how far past its door an inside is drawn (m)
 *   readEnter(v, no)   true | { cards?: [a seeded card's id…], near?: metres } → { cards: [ids] | null (the street's
 *                      tenancy), near } | null; `no(msg)` throws the client's own error
 *   tenantOf(street, R, { cards?, prev? }) → a card's id: by the street's shares (among `cards` where a place names its
 *                      own, each an equal share where the street has none for it), never its neighbour's (`prev`)
 *                      where another may be had; R its dice
 *
 * Pure.
 */
import { resolveCard } from './store-cards.js';

// (the cafe, the food hall and the wine bar are let nowhere until their fixtures are lighter: at a street's slot they
// stand over the slot's faces or shed what makes them themselves; a place may still name them)
export const TENANCY = Object.freeze({
  'main-street': Object.freeze({ apparel: 3, bookstore: 2, homewares: 2, convenience: 2, diner: 2, electronics: 1, pharmacy: 1, pawn: 1 }),
  avenue: Object.freeze({ electronics: 3, convenience: 2, pharmacy: 2, diner: 2, apparel: 2, homewares: 1, pawn: 1, 'gun-store': 1 }),
  'old-town': Object.freeze({ bookstore: 3, apparel: 3, homewares: 2, diner: 2, pharmacy: 1 }),
});
export const ENTER_CARDS = Object.freeze([...new Set(Object.values(TENANCY).flatMap((t) => Object.keys(t)))]);
export const ENTER_NEAR = 40;

export function readEnter(v, no = (msg) => { throw new Error(msg); }) {
  if (v === undefined || v === null || v === false) return null;
  if (v !== true && (typeof v !== 'object' || Array.isArray(v))) no('enter is true or { cards?, near? }');
  const o = v === true ? {} : v;
  for (const k of Object.keys(o)) if (!['cards', 'near'].includes(k)) no(`enter.${k} is not a setting (cards, near)`);
  if (o.cards !== undefined && o.cards !== null && (!Array.isArray(o.cards) || !o.cards.length || o.cards.some((c) => typeof c !== 'string' || !resolveCard(c)))) no('enter.cards is a list of seeded store cards\' ids');
  if (o.near !== undefined && !(Number.isFinite(o.near) && o.near >= 10 && o.near <= 320)) no('enter.near is metres in [10, 320]');
  return { cards: o.cards ? [...o.cards] : null, near: o.near ?? ENTER_NEAR };
}

export function tenantOf(street, R, { cards = null, prev = null } = {}) {
  const T = TENANCY[street] ?? TENANCY['main-street'];
  let lets = cards ? cards.map((id) => [id, T[id] ?? 1]) : Object.entries(T);
  if (prev !== null && lets.some(([id]) => id !== prev)) lets = lets.filter(([id]) => id !== prev);
  const sum = lets.reduce((a, [, w]) => a + w, 0);
  let x = R() * sum;
  for (const [id, w] of lets) { x -= w; if (x < 0) return id; }
  return lets[lets.length - 1][0];
}
