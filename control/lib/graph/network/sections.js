/**
 * THE SECTIONS — what a passage of a network (network/passage.js) is, by what it carries: its box (width, height), how
 * deep it lies (its cover under open ground, its slab under a building's plaza or floor), how steeply it may climb, whether
 * a walker's stair may take it the rest of the way down to a floor, its lamps' spacing, how long it may run between two
 * nodes (a law), the doorway it meets a node by, and its finish. A new kind of passage is a row here, not code: the
 * passage builds whatever the row says.
 *
 *   passage   the pedestrian passage under a downtown (a concourse to the next): glass and steel, a stripe a route
 *   service   a building's service tunnel (a plant room to the next, a hospital's back of house): concrete, conduits, caged
 *             lamps, steeper
 *   bunker    a military base's tunnel between hardened buildings: a service tunnel's box under a metre of slab where it
 *             passes under a building, and more cover than a service tunnel's under open ground
 *   vehicle   a road tunnel under a block or a river: two lanes and a walkway each side, deep, gentle, no stair
 *
 *   SECTIONS            the rows
 *   readSection(s) → a row (one of SECTION_IDS, or { from, …changes }), refused by name
 *
 * Metres. Pure data.
 */
export const SECTIONS = Object.freeze({
  passage: Object.freeze({ width: 4, height: 3, door: 3.6, cover: 1, slab: 0.3, grade: 1 / 12, stair: true, lamp: 4.5, longest: 120, finish: 'concourse' }),
  service: Object.freeze({ width: 3, height: 2.7, door: 2, cover: 1, slab: 0.3, grade: 1 / 8, stair: true, lamp: 5, longest: 200, finish: 'service' }),
  bunker: Object.freeze({ width: 3, height: 2.6, door: 2, cover: 1.2, slab: 1, grade: 1 / 8, stair: true, lamp: 6, longest: 300, finish: 'service' }),
  vehicle: Object.freeze({ width: 10, height: 5.5, door: 8, cover: 2.5, slab: 1, grade: 1 / 16, stair: false, lamp: 8, longest: 2000, finish: 'road' }),
});
export const SECTION_IDS = Object.freeze(Object.keys(SECTIONS));
export const FINISHES = Object.freeze(['concourse', 'service', 'road']);

/** A section by its id, or a row changed from one (`{ from, width?, … }`). */
export function readSection(s = 'passage') {
  if (typeof s === 'string') {
    if (!SECTIONS[s]) throw new Error(`network: section '${s}' is not a section (${SECTION_IDS.join(', ')})`);
    return { id: s, ...SECTIONS[s] };
  }
  if (!s || typeof s !== 'object' || !SECTIONS[s.from]) throw new Error(`network: a section is ${SECTION_IDS.join(' | ')} or { from: <one>, …changes }`);
  const base = SECTIONS[s.from], out = { id: `${s.from}+`, ...base };
  for (const [k, v] of Object.entries(s)) {
    if (k === 'from') continue;
    if (!(k in base)) throw new Error(`network: '${k}' is not a setting of a section (${Object.keys(base).join(', ')})`);
    if (k === 'finish' ? !FINISHES.includes(v) : k === 'stair' ? typeof v !== 'boolean' : !(typeof v === 'number' && v > 0)) throw new Error(`network: section.${k} is ${k === 'finish' ? FINISHES.join(' | ') : k === 'stair' ? 'true or false' : 'a positive number'}`);
    out[k] = v;
  }
  return out;
}
