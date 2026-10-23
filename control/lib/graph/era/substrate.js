/**
 * THE SUBSTRATE — what a level's ground IS, cell by cell: the geology a level's flora grows on (era/substrate-flora.js
 * says what belongs on each). The geocube's: read off the land its stage lays (its heightfield, its slope, its talus
 * apron, its trail and its streams) and turned by the rock's formation. It draws nothing.
 *
 *   SUBSTRATES                           each substrate's read
 *   substrateMap(st, site, opts)         → { cells: Uint8Array (a SUBSTRATE_IDS index a land cell, 255 off the land),
 *                                          nx, ny, x0, y0, cell, shares: { <id>: share } } for an isekai stage's site
 *                                          (nature.js natureSite, out-trail.js outTrailSite); opts { formation, seed }
 *   (era/substrate-of.js substrateOf(manifest): the same for an isekai stage recipe, as the stage lays it)
 *
 * The rules, in order: the trail and its fringe are the path; within a stream's reach the ground is wet; a face
 * steeper than the land's rock slope is bedrock; the talus apron is scree; the rest is soil, which the formation then
 * turns in patches (limestone: thin soil giving way to bare pavement; sandstone: the flats to sand; flagstone: slabs of
 * bedrock through the turf). Pure: the site's own numbers and hashed noise.
 */
import { vnoise } from './dirt.js';
import { gridX, gridY } from '../polygonizer/landform.js';

export const SUBSTRATES = Object.freeze({
  bedrock: 'bare rock at the surface: a cliff, a crag, a pavement of it',
  scree: 'loose rock fallen from a face, lying at its foot',
  soil: 'earth deep enough to root in: the turf and the woods',
  sand: 'loose grains, dry and shifting: a beach, a dune, a sandstone flat',
  wet: 'ground the water keeps: a stream bank, a marsh, a seep',
  path: 'ground walked bare: the trail and its edge',
});
export const SUBSTRATE_IDS = Object.freeze(Object.keys(SUBSTRATES));
const ID = Object.fromEntries(SUBSTRATE_IDS.map((k, i) => [k, i]));

// the formation's turn on soil: where its noise (a patch every `scale` m or so) passes `over`, the soil becomes `to`;
// `flat`: only where the ground is near level
export const FORMATION_TURNS = Object.freeze({
  limestone: Object.freeze({ to: 'bedrock', scale: 9, over: 0.68, read: 'thin soil over limestone gives way to bare pavement' }),
  sandstone: Object.freeze({ to: 'sand', scale: 11, over: 0.6, flat: 0.96, read: 'sandstone weathers to sand on its flats' }),
  flagstone: Object.freeze({ to: 'bedrock', scale: 7, over: 0.74, read: 'slabs of the bed break through the turf' }),
});
// a stream's reach either side of its crossing (m)
const WET_REACH = 2.6;

/** The substrate of every land cell of an isekai stage's site. */
export function substrateMap(st, site, { formation = null, seed = 1 } = {}) {
  const g = site.grid, nx = g.nx, ny = g.ny, cells = new Uint8Array((nx - 1) * (ny - 1)).fill(255), cell = gridX(g, 1) - gridX(g, 0);
  const turn = formation ? FORMATION_TURNS[formation] ?? null : null, streams = site.out?.streams ?? [];
  const count = Object.fromEntries(SUBSTRATE_IDS.map((k) => [k, 0]));
  let land = 0;
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const p = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => [gridX(g, a), gridY(g, b), g.z[b * nx + a]]);
    const cx = (p[0][0] + p[2][0]) / 2, cy = (p[0][1] + p[2][1]) / 2;
    if (cx < 0 || cx > site.W || cy < 0 || cy > site.D) continue;
    // the facet's upward normal
    const ux = p[2][0] - p[0][0], uy = p[2][1] - p[0][1], uz = p[2][2] - p[0][2], vx = p[3][0] - p[1][0], vy = p[3][1] - p[1][1], vz = p[3][2] - p[1][2];
    const nxv = uy * vz - uz * vy, nyv = uz * vx - ux * vz, nzv = ux * vy - uy * vx, nz = Math.abs(nzv) / (Math.hypot(nxv, nyv, nzv) || 1);
    const apron = g.apron ? (g.apron[j * nx + i] + g.apron[(j + 1) * nx + i + 1]) / 2 : 0;
    let s;
    if (site.trailDist(cx, cy) < site.halfWAt(cy) + site.fringeAt(cy)) s = 'path';
    else if (streams.some((t) => Math.abs(cy - t.y) < WET_REACH)) s = 'wet';
    else if (nz < st.slope.rock) s = 'bedrock';
    else if (apron > st.landform.apronMin) s = 'scree';
    else {
      s = 'soil';
      if (turn && (!turn.flat || nz > turn.flat) && vnoise(cx / turn.scale, cy / turn.scale, seed + 1601) > turn.over) s = turn.to;
    }
    cells[j * (nx - 1) + i] = ID[s]; count[s]++; land++;
  }
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  return { cells, nx: nx - 1, ny: ny - 1, x0: gridX(g, 0), y0: gridY(g, 0), cell, shares: Object.fromEntries(SUBSTRATE_IDS.map((k) => [k, land ? r4(count[k] / land) : 0])) };
}
