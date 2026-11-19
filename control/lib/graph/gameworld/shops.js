/**
 * THE CITY'S SHOPS — where an open city's money goes. A row the game's maker writes; a played district places each where
 * its streets and its shops lie (levels.js), and its mechanic sells (game/shop-mechanics.js).
 *
 *   shops: { respray?: true | { price? }, guns?: true | { price?, rounds? } }
 *     respray  a garage on a street: driven into with stars and the price, the car is repainted and the law loses the
 *              player (its stars cleared); with none, nothing to hide
 *     guns     a gun shop at a shop front: walked into with the price, a box of `rounds` for the pistol the hero carries
 *              (arsenal.js CITY_PISTOL, the bare hands' sidearm, carried empty: Q held, it fires at the foe before it)
 *
 *   SHOPS              the words unsaid
 *   readShops(spec)    → { respray: { price } | null, guns: { price, rounds } | null } | null (refuses a malformed one,
 *                        teaching)
 * Pure, no dice.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export const SHOPS = Object.freeze({
  respray: Object.freeze({ price: 40 }),
  guns: Object.freeze({ price: 30, rounds: 24 }),
});
const KEYS = { respray: ['price'], guns: ['price', 'rounds'] };

export function readShops(spec) {
  if (spec === undefined || spec === null || spec === false) return null;
  const no = (m) => { throw new Error(`gameworld.shops${m}`); };
  if (!isObj(spec) || !Object.keys(spec).length) no(' is { respray?, guns? }: the city\'s shops, each true or its numbers');
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
  return out.respray || out.guns ? out : null;
}
