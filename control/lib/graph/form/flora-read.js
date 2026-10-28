/**
 * THE FORM RENDER'S FLORA (gen-7): where a trail's plants stand (era/isekai.js plantItems, a form read's `plants`) read
 * into the plants the page grows there, from the gen-7 libraries: a tree as form (form/tree-form.js), a bush and a shrub
 * (form/bush-form.js). A tree kind's leaf form names its species (FLORA_SPECIES; a level naming no kinds takes
 * FLORA_DEFAULT by cluster), a bush kind its habit, a shrub the dome; each species or habit grown once a template, at the
 * level's own height for it (the trees of a kind re-stood to their middle height, not the species' tallest), and every
 * plant a copy of its template, turned by its own dice and scaled to its height. Colours are the cube's: the foliage's
 * and the floor's solved bases (era/cube-light.js) for a crown and a bark, a kind's own pick from the theorist's offer
 * (era/flora-colours.js) solved the same way (its colour over the cube's foliage, times the foliage's base).
 *
 *   floraRead(plants, { kinds, bushKinds, colours, bases }) → { templates, barks, trees, n, lod, leafRef } | null
 *     (leafRef: the leaf colour a geometry's tone factors are over, linear: a blossom's or a berry's own colour back)
 *     plants: plantItems' { form, trees, bushes, shrubs } (a bamboo or a blossom card: null, its own look stays)
 *     kinds: the card's `trees.leafKinds`; bushKinds: `thickets.kinds`; colours: the cube's (#rrggbb: foliage, grass,
 *     stone, floor, accent); bases: the cube light's linear bases (foliage, floor)
 *     templates: [{ kind: 'tree' | 'bush', name, height, radius, wood, woodFar?, clumps, sites, clumpGeo, sprayGeo, bark,
 *       pad, detail, adorn? }] (geometry packed: Float32, Int8, Uint8, Uint16/32 as base64)
 *     barks: { key: { metres, depth, base, normal, orm, height } } (PNG data URLs, BARK_SIZE a side)
 *     trees: Float32 base64, FLORA_STRIDE a plant: x y z, scale, yaw, leaf rgb (linear), bark rgb (a tint over the
 *       bark's own), template, soft (a bush walked through)
 * Deterministic; templates cached a process (the grower is the cost).
 */
import { treeForm } from './tree-form.js';
import { bushForm, bushBlossom, bushBerries, ADORN } from './bush-form.js';
import { barkMaterial } from './bark-material.js';
import { leafSpray, leafClump } from '../vegetation/sprays.js';
import { TONES } from '../vegetation/tree-mesh.js';
import { readKind } from '../era/leaf-forms.js';
import { readBush } from '../era/thickets.js';
import { floraColours } from '../era/flora-colours.js';
import { encodePng } from '../landscape/surface-textures.js';
import { hashN } from './tree-form.js';

/** The species each leaf form grows as (a tree kind's `form`); a level naming no kinds, its clusters among these. */
export const FLORA_SPECIES = Object.freeze({ spray: 'beech', plate: 'cherry', weep: 'willow', tuft: 'oak', whorl: 'pine', spire: 'spruce' });
export const FLORA_DEFAULT = Object.freeze(['beech', 'oak']);
/** The painted groups the form's plants are drawn in place of (beside the land's own crowns and wood, and the stamped
 *  stock trees' copies): a gritty crown's core and chips, the shrubs, the walked-through bushes. */
export const FLORA_HIDES = Object.freeze(['isekai:crown', 'isekai:wood', 'isekai:core', 'isekai:chips', 'flora:bush', 'flora:brush-wood', 'flora:brush', 'flora:brush-chips']);
/** A shrub (era/shrubs.js) as a bush: the dome. */
export const SHRUB_HABIT = 'spray';
/** A plant's packed stride, the bark's texture size, the heights a template is grown at (m, to the nearest), the
 *  geometry variants a template carries (each clump and spray takes one by its index). */
export const FLORA_STRIDE = 13, BARK_SIZE = 128, HEIGHT_STEP = 3, VARIANTS = 2;
/** Where a crown is drawn as what (m from the eye): its sprays in over [detail]; to `mid` whole; past it the clumps a
 *  share kept (`keep`, grown by `grow` to hold the cover) and the wood its thick axes; past `far` nothing but its copy's
 *  clumps (the page's fog takes it). */
export const FLORA_LOD = Object.freeze({ detail: Object.freeze([6, 16]), mid: 25, keep: 0.4, grow: 1.5, sprayed: 6 });

const CACHE = new Map();
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
// (a cube's colour as written, #rrggbb, or as the theorist stamps it, rgb bytes)
const hexRgb = (h) => (Array.isArray(h) ? h.slice(0, 3) : [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16)));
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// a geometry's triangles packed: positions, and each vertex's colour as its factor over the plant's leaf (× 128, so the
// page multiplies the plant's own leaf colour by it and a leaf keeps its tone's spread)
const LEAF_REF = [0, 1, 2].map((k) => (lin(TONES.leaf[k]) + lin(TONES.leafLit[k])) / 2);
function packGeo(tris) {
  const p = new Float32Array(tris.length * 9), c = new Uint8Array(tris.length * 9);
  tris.forEach((t, i) => t.p.forEach((q, j) => { p.set(q.map(r4), i * 9 + j * 3); const col = t.c || [128, 128, 128]; for (let k = 0; k < 3; k++) c[i * 9 + j * 3 + k] = Math.min(255, Math.round((lin(col[k]) / LEAF_REF[k]) * 128)); }));
  return { p: b64(p), c: b64(c), n: tris.length };
}
const packWood = (W) => {
  const nv = W.pos.length / 3, I = nv > 65535 ? Uint32Array : Uint16Array;
  return { pos: b64(Float32Array.from(W.pos)), nrm: b64(Int8Array.from(W.nrm, (v) => Math.round(v * 127))), uv: b64(Float32Array.from(W.uv)), idx: b64(I.from(W.idx)), big: nv > 65535 };
};
// clumps and sites packed: p o d (9), scale, depth, rank
const packSites = (L) => { const a = new Float32Array(L.length * 12); L.forEach((s, i) => a.set([...s.p, ...s.o, ...s.d, s.s, s.e, s.r], i * 12)); return b64(a); };

function template(kind, name, form, leaf, extra = {}) {
  return {
    kind, name, height: r4(form.height), radius: r4(Math.max(...form.clumps.map((c) => Math.hypot(c.p[0], c.p[1])), 0.5)),
    wood: packWood(form.wood), ...(form.woodFar ? { woodFar: packWood(form.woodFar) } : {}),
    clumps: packSites(form.clumps), sites: packSites(form.sites), nClumps: form.clumps.length, nSites: form.sites.length,
    clumpGeo: Array.from({ length: VARIANTS }, (_, k) => packGeo(leafClump(leaf, { seed: 17 + k }).tris)),
    sprayGeo: Array.from({ length: VARIANTS }, (_, k) => packGeo(leafSpray(leaf, { seed: 31 + k }).tris)),
    bark: form.bark, pad: !!form.pad, ...(form.detail ? { detail: form.detail } : {}), ...(form.trunk ? { trunk: form.trunk } : {}), ...extra,
  };
}
function treeTemplate(species, height) {
  const key = `tree:${species}:${height}`;
  if (!CACHE.has(key)) CACHE.set(key, template('tree', species, treeForm(species, { seed: 1, far: true, mature: { toHeight: 0.95, range: [1, 2], cambium: 2.2, aim: height } }), species));
  return CACHE.get(key);
}
function bushTemplate(kind, height, adorn, name) {
  const key = `bush:${JSON.stringify(kind)}:${height}:${adorn}`;
  if (!CACHE.has(key)) {
    const B = bushForm(kind, { seed: 1, height, adorn });
    const extra = adorn ? { adorn: { kind: adorn, list: adorn === 'bloom' ? packBlooms(B.blooms) : packBerries(B.berries), geo: adorn === 'bloom' ? [packGeo(bushBlossom(B.look))] : Array.from({ length: ADORN.berries[1] - ADORN.berries[0] + 1 }, (_, k) => packGeo(bushBerries(B.look, ADORN.berries[0] + k, 1 + k))), lo: ADORN.berries[0] } } : {};
    CACHE.set(key, template('bush', name, B, B.leaf, extra));
  }
  return CACHE.get(key);
}
const packBlooms = (L) => { const a = new Float32Array(L.length * 7); L.forEach((b, i) => a.set([...b.p, ...b.o, b.s], i * 7)); return b64(a); };
const packBerries = (L) => { const a = new Float32Array(L.length * 5); L.forEach((b, i) => a.set([...b.p, b.n, b.s], i * 5)); return b64(a); };

function barkOf(key) {
  const ck = `bark:${key}`;
  if (!CACHE.has(ck)) {
    const B = barkMaterial(key, { size: BARK_SIZE }), png = (rgb) => `data:image/png;base64,${encodePng(rgb, B.W, B.H).toString('base64')}`;
    let m = [0, 0, 0]; for (let i = 0; i < B.W * B.H; i++) for (let k = 0; k < 3; k++) m[k] += lin(B.baseColor[i * 3 + k]);
    CACHE.set(ck, { metres: B.metres, depth: B.depth, base: png(B.baseColor), normal: png(B.normal), orm: png(B.orm), height: png(B.height), mean: m.map((v) => r4(v / (B.W * B.H))) });
  }
  return CACHE.get(ck);
}

/** The species a tree grows as: its kind's leaf form's, or (no kind) its cluster's among FLORA_DEFAULT. */
export const speciesFor = (t, K) => (K ? FLORA_SPECIES[K.form] : FLORA_DEFAULT[Math.floor(hashN((t.cluster + 7) * 7919) * FLORA_DEFAULT.length)]);

export function floraRead(plants, { kinds = null, bushKinds = null, colours, bases }) {
  if (!plants || plants.form === 'bamboo' || plants.form === 'blossom') return null;
  if (!plants.trees.length && !plants.bushes.length && !plants.shrubs.length) return null;
  // the colours: the cube's foliage and bark (its floor darkened, as the land's wood class), a kind's pick its offer's
  // (the colours it reads: a cube's colour carries more, a `shade` hue among them)
  const C = Object.fromEntries(['foliage', 'grass', 'stone', 'floor', 'accent'].filter((k) => colours[k] !== undefined).map((k) => [k, hexRgb(colours[k])]));
  const offer = floraColours({ foliage: C.foliage, grass: C.grass, rock: C.stone, soil: C.floor, accent: C.accent ?? null });
  const solve = (rgb, ref, base) => [0, 1, 2].map((k) => r4((base[k] * lin(rgb[k])) / Math.max(1e-6, lin(ref[k]))));
  const leafBase = bases.foliage, barkBase = bases.floor.map((v) => v * 0.5);
  const leafOf = (K) => (K && K.leaf ? solve(offer.leaves[K.leaf - 1], C.foliage, leafBase) : leafBase);
  const barkTarget = (K) => (K && K.bark ? solve(offer.barks[K.bark - 1], C.floor, barkBase) : barkBase);
  const out = [], templates = [], index = new Map(), barks = {};
  const use = (T) => { if (!index.has(T)) { index.set(T, templates.length); templates.push(T); barks[T.bark] = barkOf(T.bark); } return index.get(T); };
  // (a bark's tint: half-way from its own colour to the target, so a species keeps its bark and the level its palette)
  const tint = (T, target) => { const m = barks[T.bark].mean; return [0, 1, 2].map((k) => r4(0.5 + (0.5 * target[k]) / Math.max(1e-4, m[k]))); };
  const push = (T, p, h, K, soft = false) => {
    const ti = use(T), yaw = 2 * Math.PI * hashN(Math.round(p.x * 100) * 7 + Math.round(p.y * 100) * 13);
    out.push(p.x, p.y, p.z, r4(h / T.height), r4(yaw), ...leafOf(K), ...tint(T, barkTarget(K)), ti, soft ? 1 : 0);
  };
  // the trees: each kind's species at the kind's middle height (a level's heights to the nearest HEIGHT_STEP)
  const kindAt = (t) => (t.kind >= 0 && kinds ? readKind(kinds[t.kind]) : null);
  const groups = new Map();
  for (const t of plants.trees) { const K = kindAt(t), sp = speciesFor(t, K); if (!groups.has(sp)) groups.set(sp, []); groups.get(sp).push([t, K]); }
  for (const [sp, list] of groups) {
    const hs = list.map(([t, K]) => t.h * (K?.scale ?? 1)).sort((a, b) => a - b), aim = Math.max(HEIGHT_STEP, Math.round(hs[Math.floor(hs.length / 2)] / HEIGHT_STEP) * HEIGHT_STEP);
    const T = treeTemplate(sp, aim);
    for (const [t, K] of list) push(T, t, t.h * (K?.scale ?? 1), K);
  }
  // the bushes: each thicket kind its habit at its middle height; the shrubs the dome, in their season
  for (const b of plants.bushes) {
    const K = readBush(bushKinds[b.kind]), aim = Math.round(((K.height[0] + K.height[1]) / 2) * 10) / 10;
    push(bushTemplate(bushKinds[b.kind], aim, null, `bush:${K.form}`), b, b.h, K, !!b.soft);
  }
  for (const s of plants.shrubs) {
    const adorn = s.state === 'bloom' || s.state === 'fruit' ? s.state : null;
    push(bushTemplate(SHRUB_HABIT, 1.2, adorn, `shrub:${SHRUB_HABIT}`), s, s.h, null, !!s.soft);
  }
  return { templates, barks: Object.fromEntries(Object.entries(barks).map(([k, v]) => [k, v])), trees: b64(Float32Array.from(out)), n: out.length / FLORA_STRIDE, lod: FLORA_LOD, leafRef: LEAF_REF.map(r4) };
}
