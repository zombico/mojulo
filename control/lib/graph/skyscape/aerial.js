/**
 * THE AERIAL GROUND, for the page — a map's country (country.js) and its land cover (cover-kernel.js) packed for the
 * World page's aerial channel (scene/channels/aerial.js), carried by the terrain channel as `aerial`:
 *
 *   cover    the cover kernel's source and its inputs (the land's relief, the sea, the settlements' land), the rect it is
 *            baked over (the map's grid) and its texels a side: the page bakes it, the ground's shader reads it
 *   keep     how many of the kernel's grade layers keep their own paint (the pads', the fractal cities'): no cover there
 *   pal      the cover's colours (linear rgb), from the geocube's key colours: grass, crops, soil, woods, heath, sand
 *   plan     the ground plan the page paints to a canvas: the settlements' rects (streets, pads, parks, lots, yards),
 *            the roads' ribbons, the gardens' trees; its rect and its metres a pixel
 *   masses   the buildings as boxes (decks and piers among them), gables, rounds; the pylons, their wires, the masts;
 *            packed Float32 / Uint8 (base64)
 *   light    the ground's own light (the kernel's), so a wall is lit as the ground beside it
 *
 *   aerialPageConfig(field, map) → the channel's config | null (no country on the map)
 *   coverPalette(cube, { style? }) → the cover's paints (hex) by COVER_KEYS, from a geocube's key colours (a colony's its world's)
 *
 * Pure.
 */
import { coverKernel } from './cover-kernel.js';
import { SKINS, COUNTRY } from './country.js';
import { PYLON } from '../geocity/industry.js';

const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const linHex = (h) => rgb(h).map((v) => Math.round(lin(v) * 1e4) / 1e4);
const mixHex = (a, b, t) => '#' + [1, 3, 5].map((k) => Math.round(parseInt(a.slice(k, k + 2), 16) * (1 - t) + parseInt(b.slice(k, k + 2), 16) * t).toString(16).padStart(2, '0')).join('');
const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 1e4) / 1e4;

/** The cover's palette, in the order the shader reads it: pasture ×2, crops ×5 (ripe, barley, green, young, rapeseed),
 *  ploughed soil, fallow, hedge, woods dark and light, heath ×2, sand, verge, rock. Each leaned toward the cube's own;
 *  a colony's (`style: 'colony'`) most of the way to its world's. */
export const COVER_KEYS = Object.freeze(['pasture', 'pasture2', 'ripe', 'barley', 'green', 'young', 'rape', 'soil', 'fallow', 'hedge', 'wood', 'wood2', 'heath', 'heath2', 'sand', 'verge', 'rock']);
// (a colony's world: each of the cover's paints leaned this far to the world's own (its ground, its dust, its rock), so a
// rust moon's plots are its dust, not an island's fields; each key the cube's colour it leans to)
const WORLD_LEAN = 0.8;
const WORLD_OF = Object.freeze({ pasture: 'grass', pasture2: 'grass', ripe: 'sand', barley: 'sand', green: 'grass', young: 'grass', rape: 'sand', soil: 'floor', fallow: 'floor', hedge: 'foliage', wood: 'foliage', wood2: 'foliage', heath: 'floor', heath2: 'grass', sand: 'sand', verge: 'grass', rock: 'stone' });
export function coverPalette(cube, { style = 'earth' } = {}) {
  const P = earthCover(cube);
  if (style !== 'colony') return P;
  return Object.fromEntries(COVER_KEYS.map((k) => [k, mixHex(P[k], cube.colour[WORLD_OF[k]] ?? P[k], WORLD_LEAN)]));
}
function earthCover(cube) {
  const C = cube.colour, g = C.grass, f = C.foliage;
  return {
    pasture: mixHex('#5b763c', g, 0.08), pasture2: mixHex('#687f44', g, 0.08), ripe: mixHex('#a99a64', C.sand ?? '#d8c8a0', 0.12), barley: mixHex('#9a8e62', C.sand ?? '#d8c8a0', 0.1),
    green: mixHex('#55723a', g, 0.08), young: mixHex('#768c50', g, 0.08), rape: '#b9ad4e', soil: mixHex('#6e5a46', C.floor, 0.12), fallow: mixHex('#8a7e60', C.floor, 0.1),
    hedge: mixHex('#2a3c22', f, 0.15), wood: mixHex('#263a20', f, 0.18), wood2: mixHex('#3a5230', f, 0.18), heath: mixHex('#6e6644', C.floor, 0.12), heath2: mixHex('#5e6340', g, 0.12),
    sand: C.sand ?? '#d8c8a0', verge: mixHex('#7a8a52', g, 0.3), rock: mixHex('#7d776c', C.stone, 0.2),
  };
}

/** The masses packed: boxes (each cx, cy, z0, w, d, h, skin, floorH), their colours (wall rgb, roof rgb); the decks and
 *  piers as boxes too. */
function packMasses(a) {
  const col = a.plan.colours;
  const boxes = [...a.boxes];
  const DECK = '#a7a49c';
  for (const [x0, y0, x1, y1, z] of a.decks) boxes.push([(x0 + x1) / 2, (y0 + y1) / 2, z - 1.8, x1 - x0, y1 - y0, 1.8, DECK, col.highway, SKINS.deck, 1.8]);
  for (const [x, y, z0, z1] of a.piers) boxes.push([x, y, z0, 1.6, 1.6, Math.max(0.5, z1 - z0), DECK, DECK, SKINS.plain, 3]);
  const F = new Float32Array(boxes.length * 8), U = new Uint8Array(boxes.length * 6);
  boxes.forEach((b, k) => { F.set([b[0], b[1], b[2], b[3], b[4], b[5], b[8], b[9]], k * 8); U.set([...rgb(b[6]), ...rgb(b[7])], k * 6); });
  const G = new Float32Array(a.gables.length * 7), GU = new Uint8Array(a.gables.length * 6);
  a.gables.forEach((g, k) => { G.set(g.slice(0, 7), k * 7); GU.set([...rgb(g[8] ?? g[7]), ...rgb(g[7])], k * 6); });
  const R = new Float32Array(a.rounds.length * 6), RU = new Uint8Array(a.rounds.length * 3);
  a.rounds.forEach((r, k) => { R.set([r[0], r[1], r[2], r[3], r[4], r[6]], k * 6); RU.set(rgb(r[5]), k * 3); });
  return {
    boxes: b64(F), boxCol: b64(U), n: boxes.length, gables: b64(G), gableCol: b64(GU), ng: a.gables.length, rounds: b64(R), roundCol: b64(RU), nr: a.rounds.length,
    pylons: b64(new Float32Array(a.pylons.flat())), np: a.pylons.length, wires: b64(new Float32Array(a.wires.flat())), nw: a.wires.length,
    masts: a.masts.map((m) => m.map(r2)),
  };
}

/** The plan packed: its rect (padded) and its metres a pixel, its rects (x0, y0, x1, y1, paint index), its ribbons
 *  [paint index, width, …points], its dots (x, y, r), its paints. */
function packPlan(plan) {
  const names = Object.keys(plan.colours), idx = Object.fromEntries(names.map((n, i) => [n, i]));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const r of plan.rects) { grow(r[0], r[1]); grow(r[2], r[3]); }
  for (const [, , pts] of plan.ribbons) for (let k = 0; k < pts.length; k += 2) grow(pts[k], pts[k + 1]);
  if (!Number.isFinite(x0)) return null;
  x0 -= 60; y0 -= 60; x1 += 60; y1 += 60;
  // its pixels: about 2.5 m each, the canvas no wider than 4096
  const px = Math.max(2.5, Math.max(x1 - x0, y1 - y0) / 4096);
  const R = new Float32Array(plan.rects.length * 5);
  plan.rects.forEach((r, k) => R.set([r[0], r[1], r[2], r[3], idx[r[4]] ?? 0], k * 5));
  return {
    rect: [r2(x0), r2(y0), r2(x1), r2(y1)], px: r2(px), rects: b64(R), n: plan.rects.length,
    ribbons: plan.ribbons.map(([rank, w, pts]) => [idx[rank] ?? idx.road, w, ...pts.map(r2)]), dots: b64(new Float32Array(plan.dots.flat())), nd: plan.dots.length,
    paints: names.map((n) => plan.colours[n]), verge: idx.lawn, tree: idx.tree, names,
  };
}

/** The aerial channel's config for a map's ground (ground.js mapGround's field), or null without a country. */
export function aerialPageConfig(field, map) {
  if (!field.aerial || !field.country) return null;
  const K = field.K, b = field.bounds, G = map.grid;
  const res = Math.max(256, Math.min(512, 2 ** Math.ceil(Math.log2(2 * G.hx / 30))));
  const pal = field.aerial.cover;
  return {
    cover: { kernel: coverKernel.toString(), C: coverInputs(field), rect: [b.x[0], b.y[0], b.x[1], b.y[1]].map(r2), res },
    keep: (K.grade?.length ?? 0) - field.country.layers.length,
    pal: COVER_KEYS.map((k) => linHex(pal[k])),
    plan: packPlan(field.aerial.plan),
    masses: packMasses(field.aerial),
    light: { dir: K.light, ambient: K.lambert.ambient, gain: K.lambert.gain },
    pylon: { h: COUNTRY.pylon, arms: PYLON.arms.map(([reach, h]) => [reach, r2(h * COUNTRY.pylon / PYLON.peak)]) },
    // the weather's (sky.js): the cover and the walls darkened and tinted by its light, the towns lit at night
    tint: (field.sky?.light.tint ?? [1, 1, 1]).map((v) => r4(v ** 2.2)), night: field.sky?.night ?? 0,
    seed: K.detail.seed,
  };
}

/** The cover kernel's inputs for a map's ground: its relief, its sea, its settlements' land. */
export function coverInputs(field) {
  return { seed: field.K.detail.seed, lo: r2(field.bounds.z[0]), hi: r2(field.bounds.z[1]), sea: field.meta.sea, towns: field.country.settlements.map((s) => s.land) };
}
