/**
 * THE GRASS'S DRIFTS in the form render (gen-7): wheat, chaff, any grass kind, and wildflowers, standing in AREAS of the
 * sward, never sprinkled one by one. A drift is a few metres across (a field of its own, finer than the sward's), laid
 * by the land read's map (form/land-read.js `drifts`), and drawn by the form channel's grass (channels/form-grass.js).
 *
 * The plants are the library's, not made here: a grass kind is vegetation/grass.js `grassTuft` (its blades, culms and
 * heads), a flower vegetation/wildflowers.js `wildflower`; both grown "before light" (their colours albedo: no
 * `volumeLit`), so the form's sun lights them. Their colours are the library's own, carried into the cube's light by the
 * ratio the cube's light solved for its grass (base ÷ target, per channel), as the dirt's tones are.
 *
 *   readDrifts({ drifts?, flowers? }) → [{ id, share, mix? }]   (the biocube's words: `flora.grass.drifts`, `flora.flowers`)
 *   driftForms(drift, ratio) → { id, stands, heights, forms: [{ w, near: { p, c }, far: { p, c } }] }
 *     stands: the drift stands in place of the sward's blades (a kind taller than the short sward); else it lies among them.
 *     heights: [lo, hi] metres a plant is scaled to (a grass tuft is grown at unit height; a flower in its tuft's units).
 *     p: positions, three a vertex, three vertices a triangle; c: linear colours, three a vertex.
 */
import { GRASSES, grassTuft } from '../vegetation/grass.js';
import { WILDFLOWERS, wildflower } from '../vegetation/wildflowers.js';
import { decodeSrgb } from '../color-theorist/light.js';

/** The drifts' field: its cell (metres) and the seam a drift eases out over (a share of the grass). */
export const DRIFT_CELL = 7, DRIFT_SEAM = 0.15;
/** How many drifts a land carries: one channel each in the drift map. */
export const DRIFT_MAX = 4;
/** A grass kind stands in place of the blades when its tallest reaches past this (metres); a lower one lies among them. */
export const DRIFT_STANDS = 0.5;
/** The flowers' heights (metres): their tuft's, the sward's blades they stand a little over. */
export const FLOWER_HEIGHTS = Object.freeze([0.4, 0.65]);
/** The wildflowers' own colours (sRGB): each part as its kind's ramp reads it lit (vegetation/wildflowers.js colours). */
export const FLOWER_COLOURS = Object.freeze({
  daisy: { petal: [238, 236, 226], eye: [232, 186, 44] },
  buttercup: { petal: [240, 196, 40], eye: [226, 170, 30] },
  clover: { petal: [200, 104, 160] },
  lupine: { petal: [132, 100, 206] },
  poppy: { petal: [214, 56, 44], eye: [52, 40, 46] },
});
const STEM = [86, 128, 60];
/** Variants grown per form (each draws its kind's whole grid on the page: a variant costs a grid), and the levels near
 *  and far. */
const VARIANTS = 1, NEAR = 'L1', FAR = 'L0';
/** The flowers' heads, × the library's: read over the blades at a walker's distance (gen-6's stylized field reads them
 *  at twice and more). */
export const FLOWER_SIZE = 1.7;

const lin = (c) => c.map((v) => decodeSrgb(v / 255));
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** The biocube's words as the land read's drifts, in order (grass kinds first, the flowers last), at most DRIFT_MAX. */
export function readDrifts({ drifts, flowers } = {}) {
  const out = Object.entries(drifts ?? {}).filter(([, s]) => s > 0).map(([id, share]) => ({ id, share }));
  if (flowers && flowers.share > 0) out.push({ id: 'flowers', share: flowers.share, mix: flowers.mix ?? { daisy: 3, buttercup: 2, clover: 2, lupine: 1, poppy: 1 } });
  return out.slice(0, DRIFT_MAX);
}

// a tuft's or a flower's triangles as flat arrays, its colours carried into the cube's light
function pack(tris, colourOf, ratio) {
  const p = [], c = [];
  for (const t of tris) {
    const col = lin(colourOf(t)).map((v, k) => r4(Math.min(1, v * ratio[k])));
    for (const q of t.p) { p.push(...q.map(r4)); c.push(...col); }
  }
  return { p, c };
}

export function driftForms(drift, ratio) {
  if (drift.id === 'flowers') {
    const forms = [];
    for (const [kind, w] of Object.entries(drift.mix)) {
      if (!(w > 0) || !WILDFLOWERS[kind]) continue;
      const C = FLOWER_COLOURS[kind], colourOf = (t) => (t.part === 'stem' ? STEM : t.part === 'eye' ? C.eye ?? C.petal : C.petal);
      for (let v = 0; v < VARIANTS; v++) {
        const seed = 101 * v + kind.length * 7 + 3;
        forms.push({ w: w / VARIANTS, near: pack(wildflower(kind, { seed, level: NEAR, size: FLOWER_SIZE }), colourOf, ratio), far: pack(wildflower(kind, { seed, level: FAR, size: FLOWER_SIZE }), colourOf, ratio) });
      }
    }
    const sum = forms.reduce((a, f) => a + f.w, 0) || 1;
    return { id: 'flowers', stands: false, heights: FLOWER_HEIGHTS, forms: forms.map((f) => ({ ...f, w: r4(f.w / sum) })) };
  }
  const G = GRASSES[drift.id];
  const forms = Array.from({ length: VARIANTS }, (_, v) => {
    const seed = 31 * v + drift.id.length * 5 + 1, colourOf = (t) => t.c;
    return { w: r4(1 / VARIANTS), near: pack(grassTuft(drift.id, { seed, level: NEAR }), colourOf, ratio), far: pack(grassTuft(drift.id, { seed, level: FAR }), colourOf, ratio) };
  });
  return { id: drift.id, stands: G.heights[1] > DRIFT_STANDS, heights: G.heights, forms };
}
