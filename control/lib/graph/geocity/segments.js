/**
 * THE GEOCITY'S BLOCK SEGMENTS — what each block of a metro is given to, by the ring it builds as, and how its ground is
 * shared out. A block segment is the unit inside a block, as the geotown's is; a new one is a card, not code.
 *
 *   the core and the frame are the geocity's own cards (CARDS): each its surfaces as shares of its block (every square
 *   metre once), its storeys read off the height field, and what stands on it:
 *     tower     podium and tower: a podium over most of the block, one tower or two on its corners rising past the
 *               block's median (the core's tail), a plaza at its foot, a service laneway and a parking ramp
 *     podium    a full block built to the walk at the block's median, offices over shops, a laneway behind
 *     square    the core's square: paved, planted round its edge, a kiosk or a pavilion, the streets round it lit
 *     midrise   the frame's perimeter block: mid-rise round a planted court, a laneway behind, a little parking
 *     slab      the frame's slab on its lawn (the tower in the park, the lower tall): a slab, lawn, its parking lot
 *   the outskirts are the geotown's own segments (geotown/pattern.js SEGMENTS: houses, main-street, edge, lowrise,
 *   apartments, school), their ground shared as the geotown lays it: read once from the geotown's own design of each
 *   (the town to scale for houses, an evoked segment for the rest), its streets left out, so an outskirts block keeps a
 *   geotown's measures (its `evokes` law, at the metro's grain)
 *
 *   SURFACES             the geocity's own block surfaces ({ read, soft }); a geotown surface keeps its own
 *   CARDS                the core's and frame's segments
 *   OUTSKIRTS_SEGMENTS   the geotown segments an outskirts block may be
 *   segmentShares(kind, P) → { <surface>: share } summing to 1 (P: the outskirts' geotown pattern)
 *   isSoft(surface)      whether a surface counts as green ground
 *
 * Pure; the geotown references are memoized per pattern and kind.
 */
import { SURFACES as TOWN_SURFACES } from '../geotown/pattern.js';
import { designGeotown } from '../geotown/design.js';

export const SURFACES = Object.freeze({
  podium: { read: 'a podium\'s footprint: shops and lobbies at the walk, its roof a terrace', soft: false },
  building: { read: 'a building\'s footprint, built to its lot\'s lines', soft: false },
  plaza: { read: 'a paved plaza at a building\'s foot or a square: granite, benches, a water feature', soft: false },
  planting: { read: 'the planted beds and lawns of a plaza or a square, its trees in them', soft: true },
  court: { read: 'a planted court inside a perimeter block: lawn, trees, a play corner', soft: true },
  lawn: { read: 'the lawn a slab stands on, trees across it', soft: true },
  laneway: { read: 'a service laneway behind a block: loading, bins, garage doors', soft: false },
  ramp: { read: 'a parking ramp down to the garage under a podium', soft: false },
  lot: { read: 'a surface parking lot', soft: false },
});
export const isSoft = (s) => (SURFACES[s] ?? TOWN_SURFACES[s])?.soft === true || s === 'park';

export const CARDS = Object.freeze({
  tower: Object.freeze({ read: 'podium and tower: a podium over most of the block, a tower or two on its corners, a plaza at its foot, a laneway and a ramp', ring: 'core',
    surfaces: { podium: 0.62, plaza: 0.17, planting: 0.07, laneway: 0.1, ramp: 0.04 }, podium: [3, 6], towers: { second: 0.45, tail: 0.5, side: [26, 40] } }),
  podium: Object.freeze({ read: 'a full block built to the walk at its median, offices over shops, a laneway behind', ring: 'core',
    surfaces: { building: 0.8, laneway: 0.1, plaza: 0.06, planting: 0.04 } }),
  square: Object.freeze({ read: 'the core\'s square: paved, planted round its edge, a kiosk at its middle', ring: 'core',
    surfaces: { plaza: 0.62, planting: 0.34, building: 0.04 }, storeys: [1, 1] }),
  midrise: Object.freeze({ read: 'a perimeter block of mid-rise round a planted court, a laneway behind', ring: 'frame',
    surfaces: { building: 0.52, court: 0.3, laneway: 0.12, lot: 0.06 } }),
  slab: Object.freeze({ read: 'a slab on its lawn, the lower tall: lawn across the block, its parking lot beside it', ring: 'frame',
    surfaces: { building: 0.2, lawn: 0.5, lot: 0.22, plaza: 0.08 } }),
});
export const CARD_IDS = Object.freeze(Object.keys(CARDS));
export const OUTSKIRTS_SEGMENTS = Object.freeze(['houses', 'main-street', 'edge', 'lowrise', 'apartments', 'school']);
// a geotown segment's streets (its block's ground is the rest)
const STREET_SURFACES = new Set(['road', 'verge', 'walk', 'furnish', 'parking']);

const MEMO = new Map();
/** A segment's ground as shares of its block. */
export function segmentShares(kind, P) {
  if (CARDS[kind]) return CARDS[kind].surfaces;
  if (kind === 'park') return { park: 1 };
  if (!OUTSKIRTS_SEGMENTS.includes(kind)) throw new Error(`geocity: '${kind}' is not a block segment (${[...CARD_IDS, ...OUTSKIRTS_SEGMENTS, 'park'].join(', ')})`);
  const key = `${P.id}|${kind}`;
  let out = MEMO.get(key);
  if (!out) {
    // houses from the town to scale, the rest from an evoked segment of its kind: the geotown's own ledger, its streets out
    const pattern = P.id.endsWith('+') ? undefined : P.id;
    const d = designGeotown(kind === 'houses' ? { evoke: 'metro', grid: [2, 2], hills: false, ...(pattern ? { pattern } : {}) } : { segment: kind, hills: false, ...(pattern ? { pattern } : {}) }, { seed: 1 });
    const rows = Object.entries(d.ledger.town).filter(([k, v]) => v > 0 && !STREET_SURFACES.has(k)), sum = rows.reduce((s, [, v]) => s + v, 0);
    out = Object.freeze(Object.fromEntries(rows.map(([k, v]) => [k, Math.round((v / sum) * 1e4) / 1e4])));
    MEMO.set(key, out);
  }
  return out;
}
