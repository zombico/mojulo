/**
 * terrain-plants — which plants a terrain world grows, and where (vegetation-kernel.js places them; vegetation/ grows
 * them). A composed world's climate is two dials: a temperature that falls with altitude and a moisture that rises
 * near water. Each climate names its species by zone: broadleaves low, a conifer toward the treeline, palms on a
 * tropical coast and along an arid river, bamboo in wet valleys, reeds on a lake's or a river's shore; a tropical
 * mountain is forested to its treeline (umbrella trees low, tree ferns and bamboo in the cloud belt, the conifer under
 * the treeline). The temperature law is pinned to the climate's own treeline, so the painter's treeline and the trees'
 * agree.
 *
 * With `figs`, a tropical world's lowland forest also grows figs: banyans, stranglers and rubber figs, sparse (large figs
 * stand about one a hectare in a lowland rainforest).
 *
 * Known gaps (no species yet): arid scrub stays painted, with no plants on it.
 */
import { SPECIES } from '../vegetation/species.js';
import { plantPool, plantRepeats } from '../vegetation/pool.js';
import { ageTint } from '../vegetation/bamboo.js';
import { faceListToMesh } from '../figures/face-mesh.js';
import { vegetationKernel, PER } from './vegetation-kernel.js';
import * as dmath from '../../util/dmath.js';

/** °C a kilometre: the environmental lapse rate. */
export const LAPSE = 6.5;
/** The growing-season mean temperature at the treeline (Körner & Paulsen 2004: about 6.7 °C worldwide). */
export const TREELINE_T = 6.7;
/** A crown's diameter over the plant's height (a clump's, for Bambusa), for spacing a stand so its crowns cover what the
 *  painter shows. */
const CROWN = { cherry: 1.0, oak: 0.6, beech: 0.55, fir: 0.4, schefflera: 1.1, banyan: 1.6, strangler: 0.7, rubberfig: 0.9, coconut: 0.5, date: 0.55, washingtonia: 0.3, treefern: 0.8, moso: 0.25, vulgaris: 1.1, reed: 0.3, spruce: 0.25, silverfir: 0.32, pine: 0.4 };
/** Culms per square metre of a running bamboo's grove: Moso managed for timber, about 1,500 a hectare (Moso stands run
 *  1,200–11,000; a world's groves are drawn at the managed end). */
const GROVE = { moso: 0.15 };
/** A clumping bamboo's clump: its culms and its radius in metres (Bambusa vulgaris: 50–90 culms, about 7 m across). */
const CLUMP = { vulgaris: { culms: 40, radius: 3.5 } };
/** The grid a clumping bamboo's clumps stand on, in metres. */
const CLUMP_CELL = 14;

/**
 * Per climate: its moisture (0..1) and its rows. A row is { species, zone: 'land' | 'coast' | 'riparian' | 'shore',
 * T?: [lo, hi] °C, M?: [lo, hi], w }.
 */
export const PLANT_CLIMATES = Object.freeze({
  temperate: { moist: 0.55, rows: [
    { species: 'oak', zone: 'land', T: [11, 45], M: [0, 0.62], w: 1 },
    { species: 'beech', zone: 'land', T: [11, 45], M: [0.5, 2], w: 1 },
    { species: 'fir', zone: 'land', T: [-10, 11.5], w: 1 },
    { species: 'reed', zone: 'shore', w: 1 },
  ] },
  alpine: { moist: 0.65, rows: [
    { species: 'beech', zone: 'land', T: [12, 45], w: 1 },
    { species: 'fir', zone: 'land', T: [-10, 12.5], w: 1 },
    { species: 'reed', zone: 'shore', w: 1 },
  ] },
  boreal: { moist: 0.55, rows: [
    { species: 'fir', zone: 'land', w: 1 },
    { species: 'reed', zone: 'shore', w: 1 },
  ] },
  arid: { moist: 0.1, rows: [
    { species: 'date', zone: 'riparian', w: 1 },
    { species: 'washingtonia', zone: 'riparian', w: 0.3 },
    { species: 'reed', zone: 'shore', w: 1 },
  ] },
  // a tropical mountain, by altitude: umbrella trees from the lowland to the lower montane, tree ferns and Moso in the
  // cloud belt, the conifer (read as Podocarpus) under the treeline
  tropical: { moist: 0.85, rows: [
    { species: 'coconut', zone: 'coast', w: 1 },
    { species: 'vulgaris', zone: 'riparian', M: [0.9, 2], w: 1 },
    { species: 'schefflera', zone: 'land', T: [14, 45], w: 1 },
    { species: 'moso', zone: 'land', T: [12, 23], M: [0.8, 2], w: 1 },
    { species: 'treefern', zone: 'land', T: [9, 21], M: [0.8, 2], w: 1.2 },
    { species: 'fir', zone: 'land', T: [-10, 12.5], w: 1 },
    { species: 'reed', zone: 'shore', w: 1 },
  ] },
});

/**
 * A region's own conifers for a climate (`plants.region`), replacing that climate's rows; a climate the region does not
 * name keeps its own. Absent, every climate keeps its rows. Moisture is the kernel's: the climate's own, +0.35 near water.
 *   eurasia — Norway spruce, silver fir and Scots pine (conifer.js). Boreal: spruce throughout, pine on the ground away
 *             from water. Temperate: oak and beech low; alpine: beech low. Both: silver fir with beech in the montane
 *             belt (8–12.5 °C), spruce from 10 °C to the treeline, and pine on the dry ground at any height (European
 *             Atlas of Forest Tree Species, 2016).
 */
export const PLANT_REGIONS = Object.freeze({
  eurasia: {
    temperate: { moist: 0.55, rows: [
      { species: 'oak', zone: 'land', T: [12.5, 45], M: [0, 0.62], w: 1 },
      { species: 'beech', zone: 'land', T: [11, 45], M: [0.5, 2], w: 1 },
      { species: 'silverfir', zone: 'land', T: [8, 12.5], M: [0.5, 2], w: 1 },
      { species: 'spruce', zone: 'land', T: [-10, 10], w: 1 },
      { species: 'pine', zone: 'land', T: [-10, 45], M: [0, 0.6], w: 0.35 },
      { species: 'reed', zone: 'shore', w: 1 },
    ] },
    alpine: { moist: 0.65, rows: [
      { species: 'beech', zone: 'land', T: [12, 45], w: 1 },
      { species: 'silverfir', zone: 'land', T: [8.5, 12.5], w: 1 },
      { species: 'spruce', zone: 'land', T: [-10, 10], w: 1 },
      { species: 'pine', zone: 'land', T: [-10, 45], M: [0, 0.7], w: 0.3 },
      { species: 'reed', zone: 'shore', w: 1 },
    ] },
    boreal: { moist: 0.55, rows: [
      { species: 'spruce', zone: 'land', w: 1 },
      { species: 'pine', zone: 'land', M: [0, 0.6], w: 0.9 },
      { species: 'reed', zone: 'shore', w: 1 },
    ] },
  },
});

/** The fig rows `plants.figs` adds to a tropical world, after its umbrella trees: the lowland only (T ≥ 18). */
export const FIG_ROWS = Object.freeze([
  { species: 'banyan', zone: 'land', T: [18, 45], w: 0.05 },
  { species: 'strangler', zone: 'land', T: [18, 45], M: [0.7, 2], w: 0.05 },
  { species: 'rubberfig', zone: 'land', T: [18, 45], M: [0.6, 2], w: 0.035 },
]);

export const TERRAIN_PLANT_DEFAULTS = Object.freeze({ radius: 1200, level: 'L2', variants: 2 });

/** `plants` on a terrain manifest: true, or { radius?, level?, variants?, figs?, region?, kinds? }. → error strings. */
export function validateTerrainPlants(plants, manifest = {}) {
  if (plants === undefined || plants === null || plants === false) return [];
  const e = [];
  if (plants !== true && (typeof plants !== 'object' || Array.isArray(plants))) return ['terrain.plants must be true or { radius?, level?, variants? }'];
  if (!manifest.world) e.push('terrain.plants needs a composed world (`world`) for now: its climate says what grows where. A painted world\'s woods will come from its tree glyphs');
  if (manifest.planet) e.push('terrain.plants is for flat worlds: a planet is seen from too far for its trees, and its ground is lit by the globe');
  if (plants === true) return e;
  const num = (k, lo, hi, what) => { const v = plants[k]; if (v !== undefined && !(Number.isFinite(v) && v >= lo && v <= hi)) e.push(`terrain.plants.${k} must be ${lo}–${hi} (${what})`); };
  num('radius', 200, 3000, 'metres around the camera where plants are drawn; past it the ground\'s own colour carries the woods');
  if (plants.variants !== undefined && !(Number.isInteger(plants.variants) && plants.variants >= 1 && plants.variants <= 4)) e.push('terrain.plants.variants must be an integer 1–4 (grown variants per species)');
  if (plants.level !== undefined && !['L0', 'L1', 'L2'].includes(plants.level)) e.push('terrain.plants.level must be L0, L1 or L2 (the most detail a template carries)');
  if (plants.figs !== undefined && typeof plants.figs !== 'boolean') e.push('terrain.plants.figs must be true or false (a tropical world\'s lowland forest also grows banyans, stranglers and rubber figs)');
  if (plants.kinds !== undefined) {
    const ids = Object.keys(SPECIES).filter((k) => CROWN[k] !== undefined && SPECIES[k].kind !== 'tuft');
    if (!Array.isArray(plants.kinds) || !plants.kinds.length || plants.kinds.some((k) => !ids.includes(k))) e.push(`terrain.plants.kinds must be a list of species: ${ids.join(', ')} (they replace the climate's trees: a cherry grove, a pine wood)`);
  }
  if (plants.region !== undefined && !PLANT_REGIONS[plants.region]) e.push(`terrain.plants.region must be one of ${Object.keys(PLANT_REGIONS).join(', ')} (whose conifers the climate grows; absent, the climate's own)`);
  return e;
}

/** The plants spec, normalized: { radius, level, variants }, or null when absent. */
export function resolveTerrainPlants(plants) {
  if (plants === undefined || plants === null || plants === false) return null;
  return { ...TERRAIN_PLANT_DEFAULTS, ...(plants === true ? {} : plants) };
}

/**
 * The plant kernel's inputs for a composed world's field: V (vegetation-kernel.js). Species are the climate's, in row
 * order (a `region`'s rows for the climate, when it names them; `kinds` in place of its trees); the canopy layer's cell is sized to the smallest crown
 * among them (bigger crowns keep fewer cells).
 */
export function plantsConfig(field, { seed = 'plants', figs = false, region = null, kinds = null } = {}) {
  const K = field.K, climate = field.atlas && field.atlas.climate ? field.atlas.climate : field.climate || 'temperate';
  const Cc = (region && PLANT_REGIONS[region] && PLANT_REGIONS[region][climate]) || PLANT_CLIMATES[climate] || PLANT_CLIMATES.temperate;
  // `kinds` replaces the climate's trees, everywhere the climate grows trees; its shore (the reeds) stays
  const C0 = kinds ? { ...Cc, rows: [...kinds.map((species) => ({ species, zone: 'land', w: 1 })), ...Cc.rows.filter((r) => r.zone === 'shore')] } : Cc;
  // figs join a tropical climate's rows right after its umbrella trees; any other climate is unchanged
  const C = figs && climate === 'tropical' ? { ...C0, rows: C0.rows.flatMap((r) => (r.species === 'schefflera' ? [r, ...FIG_ROWS] : [r])) } : C0;
  const names = [...new Set(C.rows.map((r) => r.species))];
  const species = names.map((name) => ({ name, h: SPECIES[name].heights.slice(), crown: CROWN[name] }));
  const idx = (name) => names.indexOf(name);
  const canopyRows = C.rows.filter((r) => r.zone !== 'shore'), shoreRows = C.rows.filter((r) => r.zone === 'shore');
  const radii = canopyRows.filter((r) => !GROVE[r.species] && !CLUMP[r.species]).map((r) => 0.25 * CROWN[r.species] * (SPECIES[r.species].heights[0] + SPECIES[r.species].heights[1]));
  const cell = Math.max(3, Math.min(9, Math.sqrt(Math.PI) * (radii.length ? Math.min(...radii) : 3)));
  const row = (r, c) => ({ s: idx(r.species), zone: r.zone, ...(r.T ? { T: r.T } : {}), ...(r.M ? { M: r.M } : {}), w: r.w, ...(GROVE[r.species] ? { grove: Math.max(1, Math.round(GROVE[r.species] * c * c)) } : {}), ...(CLUMP[r.species] ? { clump: CLUMP[r.species] } : {}) });
  let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return {
    seed: (h >>> 0) % 100003, T0: TREELINE_T + (LAPSE * K.zones.tree) / 1000, lapse: LAPSE, treeT: TREELINE_T, moist: C.moist,
    zones: { tree: K.zones.tree, snow: K.zones.snow }, sea: K.seaLevel ?? null, climate, species,
    layers: [
      ...(canopyRows.some((r) => !CLUMP[r.species]) ? [{ kind: 'canopy', cell, salt: 0, rows: canopyRows.map((r) => row(r, cell)) }] : []),
      ...(canopyRows.some((r) => CLUMP[r.species]) ? [{ kind: 'clumps', cell: CLUMP_CELL, salt: 53, rows: canopyRows.map((r) => row(r, CLUMP_CELL)) }] : []),
      ...(shoreRows.length ? [{ kind: 'shore', cell: 2.4, salt: 101, rows: shoreRows.map((r) => row(r, 2.4)) }] : []),
    ],
  };
}

/** The plant kernel over a field's own ground kernel. */
export function plantsKernel(field, V = plantsConfig(field)) { return vegetationKernel(V, field.kernel); }

// ── the page's plants (P2): pools in the world's light, packed for the page; a static stand around the spawn for exports

/** Each species' pool, grown in the world's light: { [species index]: pool }. */
export function plantPools(V, spec, light) {
  return V.species.map((sp) => plantPool({ species: sp.name, variants: spec.variants, seed: `terrain::${sp.name}`, light, maxLevel: spec.level, discs: true }));
}

const b64 = (a) => ({ __b64: Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64'), t: a.constructor.name });
const toSrgb = (c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * dmath.pow(c, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
const hexOf = (lin) => '#' + lin.map((c) => toSrgb(c).toString(16).padStart(2, '0')).join('');

/**
 * A template for the page: its triangles quantised to Int16 over its box, an sRGB byte triple a vertex, and its textured
 * groups (bark, a palm's trunk) apart with their uv and texture key. → { lo, sc, q, col, tris, tex? }.
 */
export function packTemplate(faces) {
  const gm = faceListToMesh(faces);
  const groups = Object.entries(gm.textureGroups || {}).filter(([, g]) => g.positions.length);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const P of [gm.positions, ...groups.map(([, g]) => g.positions)]) for (let i = 0; i < P.length; i++) { const k = i % 3; if (P[i] < lo[k]) lo[k] = P[i]; if (P[i] > hi[k]) hi[k] = P[i]; }
  const sc = hi.map((h, k) => Math.max(1e-9, (h - lo[k]) / 65535));
  const q = (P) => { const out = new Int16Array(P.length); for (let i = 0; i < P.length; i++) { const k = i % 3; out[i] = Math.round((P[i] - lo[k]) / sc[k]) - 32768; } return out; };
  const c8 = (C) => Uint8Array.from(C, toSrgb);
  let tris = gm.positions.length / 9; for (const [, g] of groups) tris += g.positions.length / 9;
  return { lo, sc, q: b64(q(gm.positions)), col: b64(c8(gm.colors)), tris, ...(groups.length ? { tex: groups.map(([key, g]) => ({ key, q: b64(q(g.positions)), col: b64(c8(g.colors)), uv: b64(Float32Array.from(g.uvs)), lit: !!g.lit })) } : {}) };
}

/**
 * The far level (LF): a plant as fourteen triangles, for the band from about 14 px on screen out to the cutoff. A
 * three-sided trunk to the crown and the crown as one hull (an octahedron over the box of the near level's crown), each
 * in the area-weighted mean of the colours it replaces, so the plant keeps its size, its place and its tone.
 */
export function farTemplate(faces) {
  const gm = faceListToMesh(faces, { decollide: false }); const P = gm.positions, C = gm.colors, n = P.length / 9;
  let zTop = 0; for (let i = 2; i < P.length; i += 3) if (P[i] > zTop) zTop = P[i];
  const cr = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity, c: [0, 0, 0], w: 0 }, tr = { c: [0, 0, 0], w: 0 };
  for (let t = 0; t < n; t++) {
    const o = t * 9, cz = (P[o + 2] + P[o + 5] + P[o + 8]) / 3;
    const ux = P[o + 3] - P[o], uy = P[o + 4] - P[o + 1], uz = P[o + 5] - P[o + 2], vx = P[o + 6] - P[o], vy = P[o + 7] - P[o + 1], vz = P[o + 8] - P[o + 2];
    const area = 0.5 * dmath.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) + 1e-12;
    const into = cz > 0.4 * zTop ? cr : cz < 0.3 * zTop ? tr : null; if (!into) continue;
    for (let k = 0; k < 3; k++) into.c[k] += C[o + k] * area; into.w += area;
    if (into === cr) for (let v = 0; v < 3; v++) { const x = P[o + v * 3], y = P[o + v * 3 + 1], z = P[o + v * 3 + 2]; if (x < cr.x0) cr.x0 = x; if (x > cr.x1) cr.x1 = x; if (y < cr.y0) cr.y0 = y; if (y > cr.y1) cr.y1 = y; if (z < cr.z0) cr.z0 = z; if (z > cr.z1) cr.z1 = z; }
  }
  if (!cr.w) return faces;
  const crown = hexOf(cr.c.map((v) => v / cr.w)), trunk = tr.w ? hexOf(tr.c.map((v) => v / tr.w)) : crown;
  const cx = (cr.x0 + cr.x1) / 2, cy = (cr.y0 + cr.y1) / 2, cz = (cr.z0 + cr.z1) / 2, rx = (cr.x1 - cr.x0) / 2, ry = (cr.y1 - cr.y0) / 2, rz = (cr.z1 - cr.z0) / 2;
  const rt = Math.max(0.012 * zTop, 0.08 * Math.min(rx, ry)); const out = [];
  const tri = (a, b, c, fill) => out.push({ corners: [a, b, c], fill, doubleSided: true });
  const ring = (z) => [0, 1, 2].map((k) => [rt * dmath.cos((2 * Math.PI * k) / 3), rt * dmath.sin((2 * Math.PI * k) / 3), z]);
  const r0 = ring(0), r1 = ring(cz); for (let k = 0; k < 3; k++) { const k2 = (k + 1) % 3; tri(r0[k], r0[k2], r1[k2], trunk); tri(r0[k], r1[k2], r1[k], trunk); }
  const X0 = [cx - rx, cy, cz], X1 = [cx + rx, cy, cz], Y0 = [cx, cy - ry, cz], Y1 = [cx, cy + ry, cz], Z0 = [cx, cy, cz - rz], Z1 = [cx, cy, cz + rz];
  for (const [a, b] of [[X1, Y1], [Y1, X0], [X0, Y0], [Y0, X1]]) { tri(a, b, Z1, crown); tri(b, a, Z0, crown); }
  return out;
}

/**
 * The page's plants: the plant kernel's source and inputs, the templates (LF and L0 up to the spec's level for each
 * species' variant), what picks a variant, the tiles and the cutoff. → the `plants` of the terrain channel.
 */
export function plantsPageChannel(V, pools, spec) {
  const templates = []; const add = (faces) => { templates.push(packTemplate(faces)); return templates.length - 1; };
  const levels = ['L0', 'L1', 'L2'].slice(0, ['L0', 'L1', 'L2'].indexOf(spec.level) + 1); const textures = {};
  const species = pools.map((pool, si) => {
    Object.assign(textures, pool.textures || {});
    const facesAt = (v, l) => (v.parts ? [...v.parts.culm[l], ...v.parts.foliage[l]] : v.levels[l]);
    const variants = pool.variants.map((v) => {
      // a tuft has one level of its own (L0, and above it the same), and a far level like any plant
      const t = { LF: add(farTemplate(facesAt(v, 'L0'))) };
      if (pool.kind === 'tuft') { const id = add(facesAt(v, 'L0')); for (const l of levels) t[l] = id; } else for (const l of levels) t[l] = add(facesAt(v, l));
      // a tree in bloom: at L1 and L2 its bare wood, and its flowers drawn as discs (a species not in bloom carries neither)
      const fl = v.bloom && levels.includes('L1') ? (levels.includes('L2') && (t.B2 = add(v.bare.L2)), t.B1 = add(v.bare.L1), packFlowers(v.bloom)) : null;
      return { h: v.height, ...(v.wax ? { wax: 1 } : {}), ...(v.lean ? { lean: v.lean, az: v.az } : {}), t, ...(fl ? { fl } : {}) };
    });
    // a species grown at several ages picks its variant by the plant's height in its range (byH, rank: shortest first)
    const SG = SPECIES[V.species[si].name], byH = SG && SG.growth ? { byH: SG.heights.slice(), rank: pool.variants.map((v, k) => [v.grownHeight, k]).sort((a, b) => a[0] - b[0]).map((x) => x[1]) } : {};
    return { name: V.species[si].name, kind: pool.kind, variants, ...byH, ...(pool.kind === 'culm' ? { tint: [...Array(10)].map((_, a) => ageTint(SPECIES[V.species[si].name].bamboo, a)) } : {}) };
  });
  const discs = species.some((sp) => sp.variants.some((v) => v.fl)) ? { discs: 1.2e6 } : {};
  return { kernel: vegetationKernel.toString(), V, species, templates, textures, levels, radius: spec.radius, tile: 64, px: { L2: 110, L1: 40, L0: 14 }, cap: 60000, drawTris: 2.5e6, budgetMs: 4, ...discs };
}
/**
 * A variant's flowers for the page (pool.js `bloom`: 7 a flower): centres as Int16 over their box, sizes as bytes of
 * the largest, colours as sRGB bytes. → { n, lo, sc, q, s, smax, c }.
 */
function packFlowers(F) {
  const n = F.length / 7, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; let smax = 0;
  for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) { const v = F[7 * i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; } smax = Math.max(smax, F[7 * i + 3]); }
  const sc = hi.map((h, k) => Math.max(1e-9, (h - lo[k]) / 65535)), q = new Int16Array(3 * n), sz = new Uint8Array(n), c = new Uint8Array(3 * n);
  for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) { q[3 * i + k] = Math.round((F[7 * i + k] - lo[k]) / sc[k]) - 32768; c[3 * i + k] = F[7 * i + 4 + k]; } sz[i] = Math.round((255 * F[7 * i + 3]) / smax); }
  return { n, lo, sc, q: b64(q), s: b64(sz), smax, c: b64(c) };
}

/** The plants within `radius` of a point, as pool items per species (what the exports stand around the spawn). */
export function plantItemsNear(field, V, [cx, cy], radius) {
  const P = vegetationKernel(V, field.kernel), T = 128, out = V.species.map(() => []);
  for (let y = Math.floor((cy - radius) / T) * T; y < cy + radius; y += T) for (let x = Math.floor((cx - radius) / T) * T; x < cx + radius; x += T) {
    const a = P.plantsIn(x, y, T);
    for (let q = 0; q < a.length; q += PER) { if (dmath.hypot(a[q] - cx, a[q + 1] - cy) > radius) continue; out[a[q + 4]].push({ x: a[q], y: a[q + 1], z0: a[q + 2], height: a[q + 3], ...(a[q + 6] >= 0 ? { age: a[q + 6] } : {}), ...(a[q + 7] ? { lean: a[q + 7], az: a[q + 8] } : {}) }); }
  }
  return out;
}

/** The exports' plants: the stand within `radius` of the spawn, as repeats at L1, and the textures they wear. */
export function plantsBake(field, V, pools, { at, radius = 600 } = {}) {
  const items = plantItemsNear(field, V, at, radius); const repeats = []; const textures = {};
  pools.forEach((pool, si) => { if (!items[si].length) return; Object.assign(textures, pool.textures || {}); repeats.push(...plantRepeats(pool, items[si], { level: 'L1', sink: 0.05 }).repeats); });
  return { repeats, textures, count: items.reduce((s, l) => s + l.length, 0) };
}
