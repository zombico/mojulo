/**
 * AN INDUSTRIAL YARD, DESIGNED — a window of a geocity's industry (its tank farm, its container storage, its works:
 * geocity/industry.js) found under the arena's laws. Windows over an industrial block are each read onto the grid
 * (read-town.js) and the ones that are a yard, ground to fight on with the place's own things standing in it, are grown
 * in turn under the laws with what the place is made of kept (generate.js), the most varied first; the one that holds
 * the most laws is the yard. The laws are the only judge; the search is how a yard that can hold them all is found
 * where a single picked window may not. It answers with the cut's middle (`at`), which a mission then names
 * (`mission.map: { city, on, size, at }`).
 *
 * A place drawn as itself, under an hour, a weather and floodlights, is the geocube's: a building on its land with its
 * yard (era/stage-buildings.js), a mission laid on it by gameworld/mission-site.js. This module draws nothing.
 *
 *   FACILITY                   the search's numbers: the window, its stride, how many it grows
 *   designFacility(spec?, { seed?, on?, size?, kit?, design?, most?, passes? }) → { on, at, size, map, laws, held, of, kinds, tried }
 *
 * Pure: a function of the design and the seed.
 */
import { CELL } from './blocks.js';
import { cityGround, readGroundMap } from './read-town.js';
import { growArenaMap } from './generate.js';
import { kitOf } from './laws.js';
import { designGeocity } from '../geocity/design.js';
import { INDUSTRY_SEGMENTS } from '../geocity/segments.js';

export const FACILITY = Object.freeze({ size: 42, stride: 12, passes: 500, most: 2, tries: 8 });

// a thing of the place stands in the map's own ground: a cell under its footprint is a mass of the map (a thing on the
// far side of a fence, in ground the reader closed, is not the yard's)
function solidUnder(M, t) {
  const q = t.q ?? t.foot; if (!q) return false;
  const c = M.read.cell ?? CELL, i = Math.floor((q[0] + q[2]) / 2 / c), j = Math.floor((q[1] + q[3]) / 2 / c);
  return i >= 0 && j >= 0 && i < M.nx && j < M.ny;
}

/** The facility designed (see the header): the window of an industrial block that, grown, holds the most laws. */
export function designFacility(spec = {}, { seed = 1, on = INDUSTRY_SEGMENTS[0], size = FACILITY.size, kit = kitOf(), design = null, most = FACILITY.most, passes = FACILITY.passes } = {}) {
  const d = design ?? designGeocity(spec, { seed }), G = cityGround(d, { on }), [x0, y0, x1, y1] = G.bounds, found = [];
  // every window on the stride that is a yard: ground to fight on, things of the place standing in it (a window all
  // slab, all hall, or the street outside the fence is none); the ones with the most kinds of thing grown first
  const cands = [];
  for (let y = y0 + size / 2; y <= y1 - size / 2; y += FACILITY.stride) for (let x = x0 + size / 2; x <= x1 - size / 2; x += FACILITY.stride) {
    const M = readGroundMap(G, { at: [x, y], size }), sh = M.read.share, inside = (M.read.things ?? []).filter((t) => !t.beyond && solidUnder(M, t));
    if (sh.mass < 0.12 || sh.mass > 0.5 || sh.floor < 0.45 || !inside.length) continue;
    cands.push({ at: [Math.round(x), Math.round(y)], M, kinds: [...new Set(inside.map((t) => t.key ?? t.kind))], n: inside.length });
  }
  cands.sort((a, b) => b.kinds.length - a.kinds.length || b.n - a.n || a.at[1] - b.at[1] || a.at[0] - b.at[0]);
  let tried = 0;
  for (const c of cands) {
    tried++;
    const g = growArenaMap({ map: c.M, seed, passes, kit });
    found.push({ at: c.at, map: g.map, laws: g.laws, held: g.held, of: g.of, kinds: c.kinds });
    if (found.filter((f) => f.held === f.of).length >= most || tried >= FACILITY.tries) break;
  }
  if (!found.length) throw new Error(`arena-map: no yard of this city's ${on} is ground to fight on at ${size} m (a window all slab or all hall): try another segment or size`);
  const best = found.sort((a, b) => b.held - a.held || b.kinds.length - a.kinds.length || a.at[1] - b.at[1] || a.at[0] - b.at[0])[0];
  return { on, size, tried, ...best };
}
