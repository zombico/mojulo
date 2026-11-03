/**
 * rupa/ground-grid.js — a physical level's land as the soil grid the page digs (controllable/rupa.js GROUND): the stage's
 * landform heights (era/isekai.js `physicalGround`: its grid's points, packed) and, facet by facet, what its ground is
 * (era/substrate.js), each ground a soil record. Under `destruction: 'physical'` only. rupa is the internal name.
 *
 *   THE GROUNDS  each of the land's grounds (substrate) as the matter it is (rupa/look-matter.js SUBSTRATE_MATTER: soil
 *                loam, sand sand, scree gravel, bare rock stone, wet ground clay, a path packed gravel), over bedrock by
 *                DEPTH (a crater stops at bedrock; bare rock has none to dig)
 *   A SOIL       { dig (J/m³ a crater takes), swell, c (Pa), phi (°), density, depth }: a soil's own; a ground that is no
 *                soil digs as its toughness allows and holds any face
 *
 *   DEPTH                         metres of loose ground over bedrock, by ground
 *   groundGrid(physicalGround)    → the runtime's `rupa.ground` ({ x0, y0, dx, nx, ny, z, cells, soils }), or null
 */
import { resolveMatter, isSoil } from './matter.js';
import { SUBSTRATE_MATTER } from './look-matter.js';

export const DEPTH = Object.freeze({ bedrock: 0, scree: 1, soil: 1.5, sand: 3, wet: 1.5, path: 1 });

const soilRecord = (id, depth) => {
  const m = resolveMatter(id);
  return isSoil(m)
    ? { id: m.id, dig: m.dig, swell: m.swell, c: m.c, phi: m.phi, density: m.density, depth }
    : { id: m.id, dig: m.toughness * 200, swell: 1.2, c: 1e9, phi: 89, density: m.density, depth };
};

export function groundGrid(g) {
  if (!g || typeof g.z !== 'string' || typeof g.cells !== 'string' || !Array.isArray(g.ids)) return null;
  const soils = g.ids.map((sub) => soilRecord(SUBSTRATE_MATTER[sub]?.matter ?? 'loam', DEPTH[sub] ?? 1));
  return { x0: g.x0, y0: g.y0, dx: g.dx, nx: g.nx, ny: g.ny, z: g.z, cells: g.cells, soils };
}
