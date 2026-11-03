/**
 * car-trims — the PARTS a car's face, roof, wheels and fittings are chosen from, and the TRIMS that choose them
 * together. A part is a word on one slot (its lamps, its grille, its roof, its spoiler …); a trim is a package of them
 * (a sport trim lowers the car, fits bigger wheels, a spoiler, twin exhausts and a splitter); a composition's own
 * `parts` override both, and the language (car-languages.js) gives what neither names.
 *
 *   PART_WORDS            each slot's words (or 'bool', or a number's range)
 *   CAR_TRIMS             base | comfort | luxury | sport | offroad | eco
 *   readParts(parts)      the slots checked (throws naming the slot and its words)
 *   carTrim(id)           the trim, or throws naming the trims
 *
 * Pure data and pure functions.
 */

export const PART_WORDS = Object.freeze({
  lamps: Object.freeze(['round', 'quad', 'rect', 'slim', 'oval', 'bar', 'eyes']),
  tails: Object.freeze(['round', 'rect', 'slim', 'oval', 'bar', 'tower']),
  grille: Object.freeze(['bars', 'slats', 'oval', 'large', 'mesh', 'closed', 'slots', 'smile']),
  bumpers: Object.freeze(['body', 'black', 'chrome', 'steel']),
  wheel: Object.freeze(['hubcap', 'steelCap', 'flatAlloy', 'multiSpoke', 'fiveSpokeAlloy', 'sport', 'aero', 'offroad', 'wireVintage']),
  tyre: Object.freeze(['road', 'whitewall', 'lowProfile', 'allTerrain']),
  roof: Object.freeze(['solid', 'sunroof', 'glass', 'contrast', 'soft', 'open']),
  spoiler: Object.freeze(['none', 'auto', 'lip', 'roof', 'ducktail', 'wing']),
  exhaust: Object.freeze(['hidden', 'single', 'twin', 'quad']),
  frames: Object.freeze(['rubber', 'chrome', 'black']),
  strip: Object.freeze(['none', 'chrome', 'black']),
  stripes: Object.freeze(['none', 'single', 'twin']),
  rails: 'bool', clad: 'bool', flares: 'bool', skirts: 'bool', splitter: 'bool', skid: 'bool', fogs: 'bool', spare: 'bool',
  ride: Object.freeze([-0.04, 0.08]),        // the body over its wheels, metres (a drop or a lift)
  wheelScale: Object.freeze([-0.05, 0.12]),  // the wheels' radius, a share over the class's
});
export const PART_SLOTS = Object.freeze(Object.keys(PART_WORDS));

const trim = (label, parts) => Object.freeze({ label, parts: Object.freeze(parts) });
export const CAR_TRIMS = Object.freeze({
  base: trim('as it leaves the line', {}),
  comfort: trim('the comfortable one: bigger alloys, a sunroof, fog lamps', { wheel: 'multiSpoke', wheelScale: 0.03, roof: 'sunroof', fogs: true }),
  luxury: trim('the luxurious one: bright trim, a glass roof, big wheels, twin pipes', { wheel: 'multiSpoke', wheelScale: 0.05, roof: 'glass', frames: 'chrome', strip: 'chrome', exhaust: 'twin', fogs: true }),
  sport: trim('the sporting one: dropped, big wheels on low tyres, a spoiler, twin pipes, a splitter and skirts', { ride: -0.025, wheelScale: 0.07, wheel: 'sport', tyre: 'lowProfile', spoiler: 'auto', exhaust: 'twin', splitter: true, skirts: true, grille: 'mesh', frames: 'black' }),
  offroad: trim('the adventurous one: lifted, all-terrain tyres, cladding and flares, roof rails, a skid plate', { ride: 0.05, wheelScale: 0.06, wheel: 'offroad', tyre: 'allTerrain', clad: true, flares: true, rails: true, skid: true, fogs: true }),
  eco: trim('the frugal one: aero wheels, a closed grille, a roof spoiler', { ride: -0.01, wheel: 'aero', grille: 'closed', spoiler: 'auto' }),
});
export const CAR_TRIM_IDS = Object.freeze(Object.keys(CAR_TRIMS));

export function carTrim(id) {
  const t = CAR_TRIMS[id];
  if (!t) throw new Error(`car-shelf: trim '${id}' is one of ${CAR_TRIM_IDS.join(', ')}`);
  return t;
}

/** A parts object checked slot by slot. */
export function readParts(parts = {}) {
  if (!parts || typeof parts !== 'object' || Array.isArray(parts)) throw new Error('car-shelf: parts is an object of slots ({ lamps: \'round\', rails: true })');
  for (const [k, v] of Object.entries(parts)) {
    const words = PART_WORDS[k];
    if (!words) throw new Error(`car-shelf: '${k}' is not a part slot (${PART_SLOTS.join(', ')})`);
    if (words === 'bool') { if (typeof v !== 'boolean') throw new Error(`car-shelf: ${k} is true or false`); continue; }
    if (typeof words[0] === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < words[0] || v > words[1]) throw new Error(`car-shelf: ${k} is a number in [${words.join(', ')}]`);
      continue;
    }
    if (!words.includes(v)) throw new Error(`car-shelf: ${k} is one of ${words.join(', ')}`);
  }
  return parts;
}
