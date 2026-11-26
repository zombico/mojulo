/**
 * THE CITY'S SHOPS — where an open city's money goes. A row the game's maker writes; a played district places each where
 * its streets and its shops lie (levels.js), and its mechanic sells (game/shop-mechanics.js).
 *
 *   shops: { respray?: true | { price? }, guns?: true | { price?, rounds? }, forger?: true | { price? } }
 *     respray  a garage on a street: driven into with stars and the price, the car is repainted and the law loses the
 *              player (its stars cleared); with none, nothing to hide
 *     guns     a gun shop at a shop front: walked into with the price, a box of `rounds` for the pistol the hero carries
 *              (arsenal.js CITY_PISTOL, the bare hands' sidearm, carried empty: Q held, it fires at the foe before it)
 *     forger   a forger at a shop front: walked into with the price, forged papers (`fake-id`, FORGED): a licence to
 *              operate heavy machinery, which a driving job may ask for (jobsified.js `licence`). Once had, kept
 *
 *   SHOPS              the words unsaid
 *   FORGED             the forger's papers: their item and what they are called (the licence, PAPERS.licence)
 *   PAPERS             every paper the forger deals in: the licence (a driving job's) and an office ID badge lifted off
 *                      someone's lanyard (a temp's, temp-agency.js), a city worker's ID (municipal.js), each its item, its name, its price where it is not
 *                      the shop's, what is said as it is sold
 *   readShops(spec)    → { respray: { price } | null, guns: { price, rounds } | null, forger?: { price } } | null (refuses
 *                        a malformed one, teaching)
 * Pure, no dice.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export const SHOPS = Object.freeze({
  respray: Object.freeze({ price: 40 }),
  guns: Object.freeze({ price: 30, rounds: 24 }),
  forger: Object.freeze({ price: 150 }),
});
const KEYS = { respray: ['price'], guns: ['price', 'rounds'], forger: ['price'] };
export const FORGED = Object.freeze({ item: 'fake-id', name: 'heavy machinery licence' });
export const PAPERS = Object.freeze({
  licence: FORGED,
  badge: Object.freeze({ item: 'office-id', name: 'office ID badge', price: 90, says: 'Lifted off a commuter\'s lanyard. You are Gary now. Gary has a good attendance record.' }),
  municipal: Object.freeze({ item: 'city-id', name: 'city worker ID', price: 75, says: 'A laminated city ID and a hi-vis vest. The vest does most of the work.' }),
});

export function readShops(spec) {
  if (spec === undefined || spec === null || spec === false) return null;
  const no = (m) => { throw new Error(`gameworld.shops${m}`); };
  if (!isObj(spec) || !Object.keys(spec).length) no(' is { respray?, guns?, forger? }: the city\'s shops, each true or its numbers');
  const out = { respray: null, guns: null };
  for (const [k, v] of Object.entries(spec)) {
    if (!KEYS[k]) no(`.${k} is no shop (${Object.keys(KEYS).join(', ')})`);
    if (v === false || v === undefined) continue;
    if (v !== true && !isObj(v)) no(`.${k} is true or { ${KEYS[k].join(', ')} }`);
    const S = v === true ? {} : v;
    for (const f of Object.keys(S)) if (!KEYS[k].includes(f)) no(`.${k}.${f} is not part of the ${k} shop (${KEYS[k].join(', ')})`);
    if (S.price !== undefined && !whole(S.price, 0, 100000)) no(`.${k}.price is the coin it costs, a whole number`);
    if (S.rounds !== undefined && !whole(S.rounds, 1, 999)) no(`.${k}.rounds is the rounds a box holds, 1 to 999`);
    out[k] = { ...SHOPS[k], ...S };
  }
  return out.respray || out.guns || out.forger ? out : null;
}
