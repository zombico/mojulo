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
 *   THE WATER    the stage's still water (its lake, its sea: era/out-water.js, the water hazards it marks, each a box
 *                whose top is its level) as the grid's water bodies, the land under each level filled to it; a river's
 *                level falls along it, so it is not still water and waits
 *
 *   DEPTH                         metres of loose ground over bedrock, by ground
 *   groundGrid(physicalGround)    → the runtime's `rupa.ground` ({ x0, y0, dx, nx, ny, z, cells, soils }), or null
 *   waterBodies(anchors)          → [{ of, min, max, level }] the still water among a world's anchors
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

// the still water a stage marks (its water hazards: a lake's, the sea's), each its box and the level its top is
export function waterBodies(anchors) {
  return (anchors || []).filter((a) => a && a.kind === 'hazard' && a.hazard === 'water' && a.box && /^(lake|coast)-/.test(String(a.of || '')))
    .map((a) => ({ of: a.of, min: [...a.box.min], max: [...a.box.max], level: a.box.max[2] }));
}
