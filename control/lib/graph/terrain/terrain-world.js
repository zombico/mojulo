/**
 * terrain-world — the `terrain` world kind's assembler: a painted scene made ground at real
 * scale, carried to the World page as a recipe the page meshes itself (channels/terrain-lod.js).
 *
 * manifest: { kind: 'terrain', from (a painted-landscape recipe, already resolved from `{ ref }` by the caller), span?,
 *             relief?, horizon?, detail?, seed?, spawn?: [x, y] metres, lod?: { minSize?, split?, maxChunks? } }
 *
 * The payload carries no terrain faces — the page builds them around the camera — plus bookmarks at three scales
 * (standing at the painting's foreground, above its escarpment, and the whole world from far out), the painting's sky
 * pinned to the viewer, distance haze in the sky's horizon colour, and a walk at a walker's scale: 1.7 m eye, 4.5 m/s
 * on foot, flying faster the higher it goes.
 */
import { terrainField, validateTerrainSpec } from './terrain-field.js';
import { terrainKernel } from './terrain-kernel.js';
import { slicedTerrainFaces, sliceLevels } from '../polygonizer/landform-mesh.js';
import { rockPool, rockRepeats } from '../polygonizer/rock-pool.js';
import { makeLight } from '../polygonizer/vexar.js';

export const TERRAIN_LOD_DEFAULTS = Object.freeze({ n: 32, split: 1.6, minSize: 32, maxChunks: 520, budgetMs: 8, horizonScale: 4, skirt: 0.02 });
const EYE = 1.7;

const isPt = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const rgbHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Errors (strings) for a terrain world manifest; `from` as a `{ ref }` passes here and is checked where it resolves. */
export function validateTerrainWorld(m) {
  const fromRef = m && m.from && typeof m.from.ref === 'string' && Object.keys(m.from).length === 1;
  const errs = validateTerrainSpec(fromRef ? { ...m, from: { heartbeat: 'gentle-pulse', splatch: 'verdure-trio' } } : m);
  if (m && m.spawn !== undefined && !isPt(m.spawn)) errs.push('terrain.spawn must be [x, y] in metres (where the walk starts; the painting\'s foreground by default)');
  if (m && m.place !== undefined) {
    if (!Array.isArray(m.place)) errs.push('terrain.place must be a list of { ref, at: [x, y], size?, height?, facing?, turn?, sink? }');
    else m.place.forEach((p, i) => {
      const here = `terrain.place[${i}]`;
      if (!p || typeof p !== 'object') { errs.push(`${here} must be an object`); return; }
      if (typeof p.ref !== 'string' || !p.ref) errs.push(`${here}.ref must name a stored sketch (a solid, a building, another world)`);
      if (!isPt(p.at)) errs.push(`${here}.at must be [x, y] in metres`);
      const sz = p.size; if (sz !== undefined && !(Number.isFinite(sz) && sz > 0) && !(Array.isArray(sz) && sz.length === 2 && sz.every((v) => Number.isFinite(v) && v > 0))) errs.push(`${here}.size must be metres > 0, or [width, depth]`);
      if (p.height !== undefined && !(Number.isFinite(p.height) && p.height > 0)) errs.push(`${here}.height must be metres > 0`);
      if (p.facing !== undefined && !['N', 'E', 'S', 'W'].includes(p.facing)) errs.push(`${here}.facing must be N, E, S or W`);
      if (p.turn !== undefined && !Number.isFinite(p.turn)) errs.push(`${here}.turn must be degrees`);
      if (p.sink !== undefined && !(Number.isFinite(p.sink) && p.sink >= 0)) errs.push(`${here}.sink must be metres ≥ 0`);
    });
  }
  const lod = m && m.lod;
  if (lod !== undefined) {
    if (!lod || typeof lod !== 'object') errs.push('terrain.lod must be { minSize?, split?, maxChunks? }');
    else {
      if (lod.minSize !== undefined && !(Number.isFinite(lod.minSize) && lod.minSize >= 4 && lod.minSize <= 4096)) errs.push('terrain.lod.minSize must be 4–4096 metres (the finest chunk; 32 default = 1 m between vertices)');
      if (lod.split !== undefined && !(Number.isFinite(lod.split) && lod.split >= 1 && lod.split <= 6)) errs.push('terrain.lod.split must be 1–6 (higher = finer farther out; 1.6 default)');
      if (lod.maxChunks !== undefined && !(Number.isInteger(lod.maxChunks) && lod.maxChunks >= 32 && lod.maxChunks <= 4000)) errs.push('terrain.lod.maxChunks must be an integer 32–4000 (the memory cap, about 29 KB a chunk; 520 default)');
    }
  }
  return errs;
}

/** The page channel's config for a field: the kernel's source and grids, the quadtree root, the LOD knobs, the sea. */
export function terrainPageChannel(field, lod = {}) {
  const o = { ...TERRAIN_LOD_DEFAULTS, ...lod }; const b = field.bounds;
  const w = b.x[1] - b.x[0], h = b.y[1] - b.y[0], world = Math.max(w, h); const none = field.meta.horizon === 'none';
  let size = o.minSize; const target = none ? world * 1.02 : world * o.horizonScale; while (size < target) size *= 2;   // leaves are exactly minSize
  const sky = field.meta.sky;
  return {
    kernel: terrainKernel.toString(), K: field.pageConfig(),
    root: { cx: (b.x[0] + b.x[1]) / 2, cy: (b.y[0] + b.y[1]) / 2, size }, n: o.n, split: o.split, minSize: o.minSize, maxChunks: o.maxChunks, budgetMs: o.budgetMs, skirt: o.skirt,
    rect: none ? [b.x[0], b.x[1], b.y[0], b.y[1]] : null,
    water: field.meta.sea === null ? null : { z: field.meta.sea, color: sky ? rgbHex(sky.horizon.map((v, i) => v * 0.45 + [40, 90, 120][i] * 0.55)) : '#3d6f86', opacity: 0.82 },
    speeds: { walk: 4.5, flyMin: 8, flyPerAlt: 0.9 }, hazeHeight: 400, bg: sky ? rgbHex(sky.horizon) : '#9fb6c8',
    planet: field.K.planet ? { R: field.K.planet.R, sea: field.K.planet.sea, space: 0.25 * field.K.planet.R, rim: sky ? rgbHex(sky.horizon.map((v, i) => v * 0.6 + [90, 150, 230][i] * 0.4)) : '#8fb4e8', ocean: sky ? rgbHex(sky.horizon.map((v, i) => v * 0.25 + [28, 70, 104][i] * 0.75)) : '#1c4668' } : null,
  };
}

/** A `from: { ref }` → the stored painted-landscape's manifest; an inline recipe passes through. */
export async function resolveTerrainFrom(manifest) {
  const f = manifest && manifest.from;
  if (f && typeof f.ref === 'string' && Object.keys(f).length === 1) {
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    const src = SketchRepository.getByRef(f.ref);
    if (!src) throw new Error(`terrain.from: ref '${f.ref}' is not a stored sketch`);
    if (src.manifest?.kind !== 'painted-landscape') throw new Error(`terrain.from: ref '${f.ref}' is a ${src.manifest?.kind || 'sketch'}, not a painted-landscape`);
    return src.manifest;
  }
  return f;
}

/**
 * The whole world as faces, for everything that is not the live page (GLB, USD, 3MF, STL, the engines, stills): the
 * painting's region on a grid of `spacing` metres (two landform cells by default), sliced at the kernel's height step
 * so its cliffs keep polygons, coloured per corner by the kernel. Grouped 'terrain-bake' (the live page drops it).
 */
export function bakeTerrainFaces(field, { spacing = null } = {}) {
  const b = field.bounds; const step = spacing || 2 * b.cell;
  const nx = Math.ceil((b.x[1] - b.x[0]) / step) + 1, ny = Math.ceil((b.y[1] - b.y[0]) / step) + 1;
  const z = new Float64Array(nx * ny); let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v = field.heightAt(b.x[0] + i * step, b.y[0] + j * step); z[j * nx + i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  const grid = { nx, ny, x0: b.x[0], y0: b.y[0], dx: step, z };
  const hex = (c) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(',')})`;
  return slicedTerrainFaces(grid, { stride: 1, levels: sliceLevels(lo, hi, 1.2 * step), paint: (p, mz, n) => hex(field.colorAt(p[0], p[1], p[2], n)), group: 'terrain-bake' });
}

/** Place records seated on the ground: the lowest ground under the footprint, less `sink`. → world-scene `itemRefs`. */
export function terrainPlacements(field, place = []) {
  return place.map((p, i) => {
    const [w, d] = Array.isArray(p.size) ? p.size : [p.size ?? 20, p.size ?? 20];
    const [x, y] = p.at; let z = Infinity;
    for (const [u, v] of [[0, 0], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) z = Math.min(z, field.groundAt(x + u * w, y + v * d));
    const name = typeof p.name === 'string' && p.name ? p.name : `placed-${i}`;
    return { ref: p.ref, name, center: [x, y], z: z - (p.sink ?? 0), size: [w, d], ...(p.height ? { height: p.height } : {}), facing: p.facing || 'N', ...(Number.isFinite(p.turn) ? { turn: p.turn } : {}) };
  });
}

/**
 * assembleTerrainWorld(manifest, { title, live }) → the World payload. `manifest.from` must be the resolved painted
 * recipe (see resolveTerrainFrom). `live` (the /world page) ships the recipe only; otherwise the payload carries the
 * baked world faces too, for exporters and stills.
 */
export function assembleTerrainWorld(manifest, { title = 'mojulo terrain world', live = false } = {}) {
  const errs = validateTerrainWorld(manifest); if (errs.length) throw new Error(`terrain: ${errs.join('; ')}`);
  const field = terrainField(manifest); const b = field.bounds;
  const w = b.x[1] - b.x[0], h = b.y[1] - b.y[0], world = Math.max(w, h);
  const channel = terrainPageChannel(field, manifest.lod);
  // the painting's foreground (painting y = 3, near its viewer), looking into it (toward −y)
  // (0.37 m off x = 0: that line is a chunk seam at every level, and a walk ray running exactly down a seam can slip it)
  const [sx, sy] = isPt(manifest.spawn) ? manifest.spawn : (([x, y]) => [x + 0.37, y])(field.kernel.toWorld(0, 3));
  const PLN = field.K.planet;
  // on a planet the ground at (x, y) is the sphere's: (x, y) are distances from the pole, so the surface there sits
  // lower by the curvature; the walk and the bookmarks stand on it
  const surf = (x, y) => {
    if (!PLN) return [x, y, field.groundAt(x, y)];
    const r = Math.hypot(x, y), th = r / PLN.R, c = r > 0 ? x / r : 1, sn = r > 0 ? y / r : 0, d = [Math.sin(th) * c, Math.sin(th) * sn, Math.cos(th)];
    const h = field.kernel.planetAt(...d)[0], rr = PLN.R + h; return [d[0] * rr, d[1] * rr, d[2] * rr - PLN.R];
  };
  const [wx, wy, gz] = surf(sx, sy); const zMid = (b.z[0] + b.z[1]) / 2;
  const lk = surf(sx, sy - 400); const look = [lk[0], lk[1], lk[2] + 40];
  const cameras = [
    { name: 'ground', worldFraming: { cameraPosition: [wx, wy, gz + EYE], lookAt: look, horizontalFov: 70 } },
    { name: 'aerial', worldFraming: { cameraPosition: [sx + 0.08 * w, sy + 0.2 * h, b.z[1] + 0.25 * world], lookAt: [0, b.y[0] * 0.2, zMid], horizontalFov: 60 } },
    { name: 'world', worldFraming: { cameraPosition: [0.9 * w, b.y[1] + 1.1 * h, b.z[1] + 1.1 * world], lookAt: [0, 0, zMid], horizontalFov: 50 } },
    ...(PLN ? [{ name: 'planet', worldFraming: { cameraPosition: [0.36 * 3.2 * PLN.R, 0.78 * 3.2 * PLN.R, 0.51 * 3.2 * PLN.R - PLN.R], lookAt: [0, 0, -PLN.R], horizontalFov: 45 } }] : []),
  ];
  const s = field.meta.sky;
  const sky = s ? { zenith: s.zenith, horizon: s.horizon, day: s.day, stars: s.day < 0.5 ? 0.6 : 0, seed: 1, center: [wx, wy, gz], radius: 290 } : null;
  const bg = s ? rgbHex(s.horizon) : '#9fb6c8';
  // scree from the painting's talus, at world scale: five pooled rock templates stamped once per fragment. The
  // painting's fragment sizes × span would be 8–50 m blocks; a talus at walking scale is boulders, 0.5–6 m.
  const scree = field.meta.scree.filter((r) => !(field.meta.sea !== null && r.z0 < field.meta.sea));
  const L = field.K.light;
  const repeats = scree.length ? rockRepeats(rockPool({ rock: field.meta.rock || 'granite', variants: 5, detail: 1, tone: '#' + field.K.ramps.scree.stops[3].map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''), seed: 'terrain::scree', light: makeLight({ direction: [-L[0], -L[1], -L[2]], ambient: 0.56, diffuse: 0.56 }), group: 'scree' }), scree.map((r) => ({ ...r, z0: field.groundAt(r.x, r.y), size: Math.min(6, Math.max(0.5, r.size * 0.1)) })), { sink: 0.25, group: 'scree' }) : [];
  const itemRefs = Array.isArray(manifest.place) && manifest.place.length ? terrainPlacements(field, manifest.place) : null;
  return {
    faces: live ? [] : bakeTerrainFaces(field), terrain: channel, cameras, sky, bg, title,
    ...(repeats.length ? { repeats } : {}),
    ...(itemRefs ? { itemRefs } : {}),
    haze: { color: bg, density: 0.9 / world },
    walk: { speed: channel.speeds.walk, spawn: [wx, wy, gz + EYE], radius: 0.4, minEye: EYE, gravity: 20, jump: 6 },
    viewBox: manifest.viewBox && manifest.viewBox.width ? manifest.viewBox : { width: 1120, height: 760 },
    meta: { span: field.meta.span, bounds: b, rootSize: channel.root.size, octaves: field.meta.octaves, planet: PLN ? { R: PLN.R } : null },
  };
}
