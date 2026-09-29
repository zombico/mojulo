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
import { terrainField, validateTerrainSpec, gradedField } from './terrain-field.js';
import { validateTerrainCities, prepareCity, seatCity, cityLight } from './terrain-city.js';
import { validateTerrainPlants, resolveTerrainPlants, plantsConfig, plantPools, plantsPageChannel, plantsBake } from './terrain-plants.js';
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
  if (m && m.cities !== undefined) errs.push(...validateTerrainCities(m.cities));
  if (m && m.plants !== undefined) errs.push(...validateTerrainPlants(m.plants, m));
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
  // a deeper tree (a continent's) holds more chunks at once: about forty a level from the root to the leaves
  if (lod.maxChunks === undefined) o.maxChunks = Math.max(o.maxChunks, 40 * Math.round(Math.log2(size / o.minSize) + 1));
  const sky = field.meta.sky;
  return {
    kernel: field.kernelSource || terrainKernel.toString(), K: field.pageConfig(),
    root: { cx: (b.x[0] + b.x[1]) / 2, cy: (b.y[0] + b.y[1]) / 2, size }, n: o.n, split: o.split, minSize: o.minSize, maxChunks: o.maxChunks, budgetMs: o.budgetMs, skirt: o.skirt,
    rect: none ? [b.x[0], b.x[1], b.y[0], b.y[1]] : null,
    water: field.meta.sea === null || field.atlas ? null : { z: field.meta.sea, color: sky ? rgbHex(sky.horizon.map((v, i) => v * 0.45 + [40, 90, 120][i] * 0.55)) : '#3d6f86', opacity: 0.82 },
    speeds: { walk: 4.5, flyMin: 8, flyPerAlt: 0.9 }, hazeHeight: 400, bg: sky ? rgbHex(sky.horizon) : '#9fb6c8',
    planet: field.K.planet ? { R: field.K.planet.R, sea: field.K.planet.sea, space: 0.25 * field.K.planet.R, rim: sky ? rgbHex(sky.horizon.map((v, i) => v * 0.6 + [90, 150, 230][i] * 0.4)) : '#8fb4e8', ocean: field.atlas ? null : sky ? rgbHex(sky.horizon.map((v, i) => v * 0.25 + [28, 70, 104][i] * 0.75)) : '#1c4668' } : null,
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
export function bakeTerrainFaces(field, { spacing = null, patches = [] } = {}) {
  const b = field.bounds; const step = spacing || 2 * b.cell;
  const hex = (c) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(',')})`;
  const sliced = (x0, y0, nx, ny, dx) => {
    const z = new Float64Array(nx * ny); let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v = field.heightAt(x0 + i * dx, y0 + j * dx); z[j * nx + i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
    const faces = slicedTerrainFaces({ nx, ny, x0, y0, dx, z }, { stride: 1, levels: sliceLevels(lo, hi, 1.2 * dx), paint: (p, mz, n) => hex(field.colorAt(p[0], p[1], p[2], n)), group: 'terrain-bake' });
    return { faces, z };
  };
  const nx = Math.ceil((b.x[1] - b.x[0]) / step) + 1, ny = Math.ceil((b.y[1] - b.y[0]) / step) + 1;
  if (!patches.length) return sliced(b.x[0], b.y[0], nx, ny, step).faces;
  // a patch (a city's footprint, a composed world's finer level) is cut from the smallest region that holds it: that
  // region's cells over it, and one more all round, give way to a grid at the patch's spacing (≈ 4 m for a city),
  // with a skirt along its edge that hides the step to the region's straight cell edges. Regions nest.
  const within = (p, q) => p !== q && p.x0 >= q.x0 && p.y0 >= q.y0 && p.x0 + p.w <= q.x0 + q.w && p.y0 + p.d <= q.y0 + q.d && p.w * p.d < q.w * q.d;
  const children = (r) => patches.filter((p) => (r ? within(p, r) : true) && !patches.some((q) => within(p, q) && (r ? within(q, r) : true)));
  const out = [];
  const region = (x0, y0, fx, fy, dx, kids) => {
    const holes = kids.map((r) => {
      const i0 = Math.max(0, Math.floor((r.x0 - x0) / dx) - 1), i1 = Math.min(fx - 1, Math.ceil((r.x0 + r.w - x0) / dx) + 1);
      const j0 = Math.max(0, Math.floor((r.y0 - y0) / dx) - 1), j1 = Math.min(fy - 1, Math.ceil((r.y0 + r.d - y0) / dx) + 1);
      return { r, x0: x0 + i0 * dx, x1: x0 + i1 * dx, y0: y0 + j0 * dx, y1: y0 + j1 * dx };
    });
    const inHole = (f) => { let x = 0, y = 0; for (const c of f.corners) { x += c[0]; y += c[1]; } x /= f.corners.length; y /= f.corners.length; return holes.some((h) => x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1); };
    const { faces, z: zOwn } = sliced(x0, y0, fx, fy, dx); for (const f of faces) if (!inHole(f)) out.push(f);
    for (const h of holes) {
      const sp = h.r.spacing || 4, k = Math.max(1, Math.ceil(dx / sp)), ddx = dx / k, hx = Math.round((h.x1 - h.x0) / ddx) + 1, hy = Math.round((h.y1 - h.y0) / ddx) + 1;
      const z = region(h.x0, h.y0, hx, hy, ddx, children(h.r));
      const edge = [];
      for (let i = 0; i < hx; i++) edge.push([i, 0]); for (let j = 1; j < hy; j++) edge.push([hx - 1, j]); for (let i = hx - 2; i >= 0; i--) edge.push([i, hy - 1]); for (let j = hy - 2; j > 0; j--) edge.push([0, j]);
      for (let q = 0; q < edge.length; q++) {
        const [i, j] = edge[q], [i2, j2] = edge[(q + 1) % edge.length], a = [h.x0 + i * ddx, h.y0 + j * ddx, z[j * hx + i]], c = [h.x0 + i2 * ddx, h.y0 + j2 * ddx, z[j2 * hx + i2]];
        const drop = 0.2 * dx; const fill = hex(field.colorAt(a[0], a[1], a[2], [0, 0, 1]));
        out.push({ corners: [a, c, [c[0], c[1], c[2] - drop], [a[0], a[1], a[2] - drop]], fill, doubleSided: true, group: 'terrain-bake' });
      }
    }
    return zOwn;
  };
  region(b.x[0], b.y[0], nx, ny, step, children(null));
  return out;
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
  const natural = terrainField(manifest);
  // cities (terrain-city.js): sited and graded on the natural ground, then seated on the graded one
  const preps = []; const taken = [];
  for (const [i, c] of (Array.isArray(manifest.cities) ? manifest.cities : []).entries()) {
    const p = prepareCity(natural, c, { index: i, taken }); preps.push(p); taken.push([p.center[0], p.center[1], p.rect.w, p.rect.d]);
  }
  const field = gradedField(natural, preps.map((p) => p.grade.layer)); const b = field.bounds;
  const cities = preps.map((p) => ({ prep: p, ...seatCity(p, field, { light: cityLight(field) }) }));
  const cityFaces = cities.flatMap((c) => c.faces);
  const w = b.x[1] - b.x[0], h = b.y[1] - b.y[0], world = Math.max(w, h);
  const channel = terrainPageChannel(field, manifest.lod);
  const pins = cities.filter((c) => c.pin).map((c) => ({ rect: [c.pin[0] - 40, c.pin[1] + 40, c.pin[2] - 40, c.pin[3] + 40], size: 64, split: 3.2 }));
  if (pins.length) channel.pins = pins;
  // the painting's foreground (painting y = 3, near its viewer), looking into it (toward −y); with a city, its main walk
  // (0.37 m off x = 0: that line is a chunk seam at every level, and a walk ray running exactly down a seam can slip it)
  const street = cities.length && cities[0].walk ? cities[0].walk : null;
  const V = field.views || null;   // a composed world's bookmarks (terrain-atlas.js)
  const [sx, sy] = isPt(manifest.spawn) ? manifest.spawn : street ? [street.at[0] + 0.37, street.at[1] + 0.21] : V ? V.spawn : (([x, y]) => [x + 0.37, y])(field.kernel.toWorld(0, 3));
  const PLN = field.K.planet;
  // on a planet the ground at (x, y) is the sphere's: (x, y) are distances from the pole, so the surface there sits
  // lower by the curvature; the walk and the bookmarks stand on it
  const surf = (x, y) => {
    if (!PLN) return [x, y, field.groundAt(x, y)];
    const r = Math.hypot(x, y), th = r / PLN.R, c = r > 0 ? x / r : 1, sn = r > 0 ? y / r : 0, d = [Math.sin(th) * c, Math.sin(th) * sn, Math.cos(th)];
    const h = field.kernel.planetAt(...d)[0], rr = PLN.R + h; return [d[0] * rr, d[1] * rr, d[2] * rr - PLN.R];
  };
  const [wx, wy, gz] = surf(sx, sy); const zMid = (b.z[0] + b.z[1]) / 2;
  const lk = V && !isPt(manifest.spawn) && !street ? surf(V.look[0], V.look[1]) : surf(sx, sy - 400); const look = [lk[0], lk[1], lk[2] + (V ? 2 : 40)];
  const onSurf = (p) => { if (!PLN) return p; const q = surf(p[0], p[1]); return [q[0], q[1], q[2] + (p[2] - field.groundAt(p[0], p[1]))]; };
  const cameras = V ? [
    { name: 'ground', worldFraming: { cameraPosition: [wx, wy, gz + EYE], lookAt: look, horizontalFov: 70 } },
    { name: 'aerial', worldFraming: { cameraPosition: onSurf(V.aerial.cameraPosition), lookAt: onSurf(V.aerial.lookAt), horizontalFov: 60 } },
    { name: 'region', worldFraming: { cameraPosition: onSurf(V.region.cameraPosition), lookAt: onSurf(V.region.lookAt), horizontalFov: 60 } },
    { name: 'world', worldFraming: { ...V.world, horizontalFov: 50 } },
  ] : [
    { name: 'ground', worldFraming: { cameraPosition: [wx, wy, gz + EYE], lookAt: look, horizontalFov: 70 } },
    { name: 'aerial', worldFraming: { cameraPosition: [sx + 0.08 * w, sy + 0.2 * h, b.z[1] + 0.25 * world], lookAt: [0, b.y[0] * 0.2, zMid], horizontalFov: 60 } },
    { name: 'world', worldFraming: { cameraPosition: [0.9 * w, b.y[1] + 1.1 * h, b.z[1] + 1.1 * world], lookAt: [0, 0, zMid], horizontalFov: 50 } },
  ];
  cameras.push(
    ...(PLN ? [{ name: 'planet', worldFraming: { cameraPosition: [0.36 * 3.2 * PLN.R, 0.78 * 3.2 * PLN.R, 0.51 * 3.2 * PLN.R - PLN.R], lookAt: [0, 0, -PLN.R], horizontalFov: 45 } }] : []),
    ...cities.flatMap(({ prep: p, walk: st }, i) => {
      const nm = i ? `city-${i + 1}` : 'city', r = p.rect, cz = field.groundAt(p.center[0], p.center[1]), R = Math.hypot(r.w, r.d);
      return [
        ...(st ? [{ name: nm, worldFraming: { cameraPosition: [st.at[0] + 0.37, st.at[1] + 0.21, st.z + EYE], lookAt: [st.look[0], st.look[1], field.groundAt(st.look[0], st.look[1]) + EYE + 4], horizontalFov: 70 } }] : []),
        { name: `${nm}-aerial`, worldFraming: { cameraPosition: [p.center[0] + 0.55 * R, p.center[1] + 0.75 * R, cz + 0.55 * R], lookAt: [p.center[0], p.center[1], cz], horizontalFov: 55 } },
      ];
    }),
  );
  const s = field.meta.sky;
  const sky = s ? { zenith: s.zenith, horizon: s.horizon, day: s.day, stars: s.day < 0.5 ? 0.6 : 0, seed: 1, center: [wx, wy, gz], radius: 290 } : null;
  const bg = s ? rgbHex(s.horizon) : '#9fb6c8';
  // scree from the painting's talus, at world scale: five pooled rock templates stamped once per fragment. The
  // painting's fragment sizes × span would be 8–50 m blocks; a talus at walking scale is boulders, 0.5–6 m.
  const scree = field.meta.scree.filter((r) => !(field.meta.sea !== null && r.z0 < field.meta.sea) && !((field.kernel.gradeAt(r.x, r.y) || [0, 0])[1] > 0.2));
  const L = field.K.light;
  const repeats = scree.length ? rockRepeats(rockPool({ rock: field.meta.rock || 'granite', variants: 5, detail: 1, tone: '#' + field.K.ramps.scree.stops[3].map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''), seed: 'terrain::scree', light: makeLight({ direction: [-L[0], -L[1], -L[2]], ambient: 0.56, diffuse: 0.56 }), group: 'scree' }), scree.map((r) => ({ ...r, z0: field.groundAt(r.x, r.y), size: Math.min(6, Math.max(0.5, r.size * 0.1)) })), { sink: 0.25, group: 'scree' }) : [];
  // plants (terrain-plants.js): the live page places them around the camera from the plant kernel; exports carry the
  // stand within 600 m of the spawn as repeats
  const plantsSpec = resolveTerrainPlants(manifest.plants); let plantBake = null, plantMeta = null;
  if (plantsSpec) {
    const V = plantsConfig(field, { region: plantsSpec.region || null }), pools = plantPools(V, plantsSpec, makeLight({ direction: [-L[0], -L[1], -L[2]], ambient: 0.56, diffuse: 0.56 }));
    if (live) { channel.plants = plantsPageChannel(V, pools, plantsSpec); plantMeta = { climate: V.climate, species: V.species.map((sp) => sp.name), templates: channel.plants.templates.length, triangles: channel.plants.templates.reduce((a, t) => a + t.tris, 0) }; }
    else { plantBake = plantsBake(field, V, pools, { at: [wx, wy], radius: 600 }); plantMeta = { climate: V.climate, species: V.species.map((sp) => sp.name), baked: plantBake.count }; }
  }
  const allRepeats = [...repeats, ...(plantBake ? plantBake.repeats : [])];
  const itemRefs = Array.isArray(manifest.place) && manifest.place.length ? terrainPlacements(field, manifest.place) : null;
  return {
    faces: live ? cityFaces : [...bakeTerrainFaces(field, { spacing: field.atlas ? 2 * field.K.levels[0].dx : null, patches: [...(field.patches || []), ...cities.map(({ prep: p }) => p.rect)] }), ...cityFaces], terrain: channel, cameras, sky, bg, title,
    ...(allRepeats.length ? { repeats: allRepeats } : {}),
    ...(plantBake && Object.keys(plantBake.textures).length ? { textures: plantBake.textures } : {}),
    ...(itemRefs ? { itemRefs } : {}),
    haze: { color: bg, density: field.atlas ? 1.2 / Math.min(world, 8e4) : 0.9 / world },   // a composed world is seen through the air: tens of kilometres, not its whole width
    walk: { speed: channel.speeds.walk, spawn: [wx, wy, gz + EYE], radius: 0.4, minEye: EYE, gravity: 20, jump: 6 },
    viewBox: manifest.viewBox && manifest.viewBox.width ? manifest.viewBox : { width: 1120, height: 760 },
    meta: { span: field.meta.span, bounds: b, rootSize: channel.root.size, octaves: field.meta.octaves, planet: PLN ? { R: PLN.R } : null, ...(field.atlas ? { world: field.atlas } : {}), ...(cities.length ? { cities: cities.map(({ prep: p, stats }) => ({ center: p.center, size: [p.rect.w, p.rect.d], sited: p.sited, grade: p.grade.stats, ...stats })) } : {}), ...(plantMeta ? { plants: plantMeta } : {}) },
  };
}
