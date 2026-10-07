/**
 * historic/dress — what a culture's people wear in a given year, read from its record like its buildings are.
 *
 * Clothing is a record entry (../record.js kind `dress`): one garment, worn by one of the town's WEARERS (the `man`
 * and the `woman` of the street, the `hand` at work in the field, the yard or the quay), dated by its `attested`
 * span and cited like any other entry. A garment is cut to a hem (`cut`: knee, shin or ankle — the miniature's fitted
 * skirt) and comes in a few `looks`, each a colourway: the `shirt` over the torso, a `skirt` below it if another
 * cloth, `sleeve` to the wrist, `legs` for trousers, a `shoe` (none: barefoot). `weight` (default 1) is how often the
 * look is worn against the others in use.
 *
 * The wardrobe at a year is every garment in use then, by wearer, in record order. A wearer the culture's own record
 * dresses no one as at that year is dressed from the cultures it draws its dress from (its card's `draws` with the
 * `dress` part, nearest first: ./lineage.js), still at that year; a culture in a period it has no record for wears
 * what the tradition it came from wore. Last, the hand-made table (./miniatures.js DRESS) stands in, and says so.
 * Pure.
 */
import { HISTORIC_CULTURES, landOf } from './cultures/index.js';
import { inUseAt, DRESS_WEARERS as WEARERS } from './record.js';
import { yearOf } from './lineage.js';

/** The card a scene's culture names: its own, or for a land (the farm's and the works' `egypt`) the culture it is the land of. */
export function cardOf(id) {
  if (HISTORIC_CULTURES[id]) return [id, HISTORIC_CULTURES[id]];
  const owner = Object.keys(HISTORIC_CULTURES).find((k) => landOf(k) === id);
  return owner ? [owner, HISTORIC_CULTURES[owner]] : [null, null];
}

/** A dress entry's looks as garments (the miniature's `garb`): its cut on each look, repeated by its weight. */
function garments(e) {
  const out = [];
  for (const look of e.looks || []) for (let i = 0; i < (look.weight || 1); i++) {
    const { weight, ...g } = look;
    out.push({ ...g, cut: e.cut, dress: e.id });
  }
  return out;
}

/**
 * The wardrobe of culture `id` at `year` (default: the year its card is read at):
 * `{ year, man, woman, hand, from: { man, woman, hand } }` — each wearer's garments, and the culture whose record
 * dressed them (`table` where none did: the caller's own table then stands in).
 */
export function wardrobeAt(id, year) {
  const [own, K] = cardOf(id);
  const at = Number.isInteger(year) ? year : K ? yearOf(K) : null;
  const out = { year: at, man: [], woman: [], hand: [], from: { man: 'table', woman: 'table', hand: 'table' } };
  if (!K || at === null) return out;
  // the culture itself, then the ones it draws its dress from, breadth first
  const seen = new Set([own]), queue = [own];
  while (queue.length && WEARERS.some((w) => out.from[w] === 'table')) {
    const c = queue.shift(), C = HISTORIC_CULTURES[c];
    const inUse = C && C.record ? inUseAt(C.record.entries, at, 'dress') : [];
    for (const w of WEARERS) {
      if (out.from[w] !== 'table') continue;
      const gs = inUse.filter((e) => e.wearer === w).flatMap(garments);
      if (gs.length) { out[w] = gs; out.from[w] = c; }
    }
    for (const r of (C && C.draws) || []) if ((r.parts || []).includes('dress') && !seen.has(r.from)) { seen.add(r.from); queue.push(r.from); }
  }
  return out;
}
