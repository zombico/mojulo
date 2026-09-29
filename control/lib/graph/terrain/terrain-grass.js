/**
 * terrain-grass — which grass a terrain world grows near the camera, and where (grass-kernel.js places it; vegetation/
 * grass.js grows it). Opt-in, `grass` on a composed world's terrain manifest.
 *
 * Grass is a near field. A blade is a few millimetres wide, so a tuft is below a pixel a few tens of metres off, and
 * past the grass radius the painter's ground colour already is the meadow. So the page stands tufts only within
 * `radius` (60 m) of the camera, in clumps (grass-kernel.js), decimated past `near` (12 m) so a patch of screen keeps
 * about the same tufts at any distance, the survivors widened to cover for the rest (scene/channels/terrain-grass.js);
 * each tuft is levelled by its size on screen: every blade near, a third of them farther, a few strips, two triangles.
 *
 * The climate picks the kinds by temperature and moisture: temperate meadow grass, fescue on dry ground and sedge on
 * wet; alpine fescue and tussock toward and above the treeline; steppe needlegrass in arid country; tall C4 elephant
 * grass in the warm tropical lowland (C3 above about 2,800 m on a tropical mountain: Tieszen et al. 1979), meadow grass
 * in the montane and tussock (páramo) above the treeline. `kinds` replaces the climate's choice with the kinds named,
 * placed by the same rules: an ornamental fountain-grass slope, a pampas steppe, a short `lawn`. `style: 'stylized'`
 * draws whichever kinds grow in a stylized game's look (vegetation/grass.js), denser by default.
 */
import { GRASSES, GRASS_STYLES, grassLadder } from '../vegetation/grass.js';
import { trisToFaces } from '../vegetation/pool.js';
import { grassKernel } from './grass-kernel.js';
import { packTemplate, LAPSE, TREELINE_T } from './terrain-plants.js';

/** Per climate: its moisture and its rows ({ kind, T?, M?, w }). */
export const GRASS_CLIMATES = Object.freeze({
  temperate: { moist: 0.55, rows: [
    { kind: 'meadow', T: [7, 45], M: [0.45, 2], w: 1 },
    { kind: 'fescue', T: [4, 45], M: [0, 0.62], w: 0.8 },
    { kind: 'sedge', M: [0.82, 2], w: 0.9 },
    { kind: 'tussock', T: [-10, 8], w: 1 },
  ] },
  alpine: { moist: 0.65, rows: [
    { kind: 'meadow', T: [9, 45], w: 1 },
    { kind: 'fescue', T: [3, 12], w: 1 },
    { kind: 'tussock', T: [-10, 8], w: 1.2 },
    { kind: 'sedge', M: [0.85, 2], w: 0.6 },
  ] },
  boreal: { moist: 0.55, rows: [
    { kind: 'meadow', w: 1 },
    { kind: 'sedge', M: [0.75, 2], w: 1.2 },
    { kind: 'tussock', T: [-10, 6], w: 0.8 },
  ] },
  arid: { moist: 0.1, rows: [
    { kind: 'needlegrass', M: [0, 0.4], w: 1 },
    { kind: 'meadow', M: [0.35, 2], w: 0.6 },
    { kind: 'sedge', M: [0.55, 2], w: 0.6 },
  ] },
  tropical: { moist: 0.85, rows: [
    { kind: 'elephant', T: [10.5, 45], w: 1 },
    { kind: 'meadow', T: [7.5, 11.5], w: 1 },
    { kind: 'sedge', T: [9, 45], M: [1.05, 2], w: 0.5 },
    { kind: 'tussock', T: [-10, 8], w: 1.2 },
  ] },
});

/** Tufts a square metre of full meadow (a sward kind; a tussock kind stands at a third, a tall kind at a third again). */
export const TERRAIN_GRASS_DEFAULTS = Object.freeze({ radius: 60, near: 12, density: 3.5, cover: 0.45, variants: 3 });

/** `grass` on a terrain manifest: true, or { radius?, near?, density?, cover?, kinds?, variants?, style? }. → error strings. */
export function validateTerrainGrass(grass, manifest = {}) {
  if (grass === undefined || grass === null || grass === false) return [];
  const e = [];
  if (grass !== true && (typeof grass !== 'object' || Array.isArray(grass))) return ['terrain.grass must be true or { radius?, near?, density?, cover?, kinds?, variants?, style? }'];
  if (!manifest.world) e.push('terrain.grass needs a composed world (`world`) for now: its climate says which grass grows where');
  if (manifest.planet) e.push('terrain.grass is for flat worlds: grass is a near field, seen from the ground');
  if (grass === true) return e;
  const num = (k, lo, hi, what) => { const v = grass[k]; if (v !== undefined && !(Number.isFinite(v) && v >= lo && v <= hi)) e.push(`terrain.grass.${k} must be ${lo}–${hi} (${what})`); };
  num('radius', 15, 150, 'metres around the camera where tufts stand; past it the ground\'s colour is the meadow');
  num('near', 2, 40, 'metres within which every tuft stands; past it they thin as the distance squared, the survivors widened');
  num('density', 0.5, 20, 'tufts a square metre of full meadow');
  num('cover', 0, 1, 'how much of the open ground holds grass: its meadows, not a carpet');
  num('variants', 1, 4, 'grown tufts per kind');
  if (grass.style !== undefined && !GRASS_STYLES.includes(grass.style)) e.push(`terrain.grass.style must be one of ${GRASS_STYLES.join(', ')} (stylized: chunky standing blades in a saturated gradient, lit as the ground)`);
  if (grass.kinds !== undefined) {
    const ids = Object.keys(GRASSES);
    if (!Array.isArray(grass.kinds) || !grass.kinds.length || grass.kinds.some((k) => !ids.includes(k))) e.push(`terrain.grass.kinds must be a list of grass kinds: ${ids.join(', ')}`);
  }
  return e;
}

/** The grass spec, normalized, or null when absent. */
export function resolveTerrainGrass(grass) {
  if (grass === undefined || grass === null || grass === false) return null;
  const g = grass === true ? {} : grass;
  return { ...TERRAIN_GRASS_DEFAULTS, ...(g.style === 'stylized' && g.density === undefined ? { density: 5 } : {}), ...g };
}

/** The grass kernel's inputs for a composed world's field. */
export function grassConfig(field, spec = TERRAIN_GRASS_DEFAULTS, { seed = 'grass' } = {}) {
  const K = field.K, climate = field.atlas && field.atlas.climate ? field.atlas.climate : field.climate || 'temperate';
  const C = GRASS_CLIMATES[climate] || GRASS_CLIMATES.temperate;
  const rows = spec.kinds ? spec.kinds.map((kind) => ({ kind, w: 1 })) : C.rows;
  const names = [...new Set(rows.map((r) => r.kind))];
  let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return {
    seed: (h >>> 0) % 100003, T0: TREELINE_T + (LAPSE * K.zones.tree) / 1000, lapse: LAPSE, moist: C.moist, zones: { tree: K.zones.tree, snow: K.zones.snow }, climate,
    species: names.map((name) => ({ name, h: GRASSES[name].heights.slice(), habit: GRASSES[name].habit })),
    rows: rows.map((r) => ({ s: names.indexOf(r.kind), ...(r.T ? { T: r.T } : {}), ...(r.M ? { M: r.M } : {}), w: r.w })),
    block: 4, density: spec.density, patch: 22, cover: spec.cover,
  };
}

/** The grass kernel over a field's own ground kernel. */
export function grassKernelOf(field, V) { return grassKernel(V, field.kernel); }

/**
 * The page's grass: the plants' page config over the grass kernel, each kind's variants grown at unit height with their
 * own four levels, baked in the world's light. Tufts are levelled by their size on screen at grass thresholds.
 */
export function grassPageChannel(V, spec, light) {
  const templates = []; const add = (faces) => { templates.push(packTemplate(faces)); return templates.length - 1; };
  const species = V.species.map((sp) => ({
    name: sp.name, kind: 'tuft',
    variants: [...Array(spec.variants)].map((_, v) => {
      const lad = grassLadder(sp.name, { seed: 17 + 31 * v, ...(spec.style ? { style: spec.style } : {}) }); const yaw = (v * 2 * Math.PI) / spec.variants;
      const t = {}; for (const l of ['LF', 'L0', 'L1', 'L2']) t[l] = add(trisToFaces(lad[l], { light, yaw, group: `grass-${sp.name}` }));
      // a tuft's size on screen is its larger extent: a turf plug is wider than it is tall
      const ext = (tris) => { let r = 0; for (const f of tris) for (const p of f.p) r = Math.max(r, 2 * Math.hypot(p[0], p[1])); return r; };
      return { h: 1, size: Math.max(1, +ext(lad.L2).toFixed(3)), t };
    }),
  }));
  return { kernel: grassKernel.toString(), V, species, templates, radius: spec.radius, near: spec.near, tile: 16, px: { L2: 70, L1: 22, L0: 7 }, cap: 40000, drawTris: 1.2e6, budgetMs: 3 };
}
