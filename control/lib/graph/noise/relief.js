/**
 * RELIEF — the ground's own texture at the scale a walker reads it: what the plain between the authored forms (the
 * mounds, the heartbeat's marks) does on its own. A relief is a small card of noise words; the ground it lies on says
 * where it goes and how much (a fade at a seam, round a tower), the card says what kind of ground it is.
 *
 *   RELIEF_CARDS               the cards to start from: a card is a starter, change what the land needs
 *   readRelief(spec)           a card id, a document, or { from: card, …changes } → the relief, checked
 *   reliefField(R, seed)       → (x, y) → metres about 0, at most ±R.height
 *   reliefGrain(R, seed, cell) → (x, y) → about [−1, 1]: the relief's octaves finer than the geometry, averaged over a
 *                              corner's footprint `cell` metres wide, for colour only; null when R.grain is 0
 *
 * A relief's words:
 *   height    metres from the mean to the highest crest
 *   scale     metres: the widest feature (the first octave's wavelength)
 *   flavour   noise.js FLAVOURS: fbm (rolling), ridged (crests), billow (swells and creases), damped (eroded)
 *   gain      each octave's share of the one before (0.5: H = 1, smooth; 0.7: rough)
 *   damp      the damped flavour's strength
 *   finest    metres: the shortest wavelength the geometry takes. Octaves run from `scale` down to it, so the count is
 *             the recipe's, in metres, never the mesh's: a re-export at another resolution keeps the same shape
 *   warp      { strength, scale } metres, or null: the field's domain pushed by a slower field (folded, flowing land)
 *   terrace   { step, riser }, or null: benches `step` metres high, rising over `riser` (0..1) of each step
 *   stretch   { along: [x, y], by }, or null: features `by` times longer along the direction (dunes, drumlins)
 *   grain     0..1: how far the octaves below `finest` move the land's colour (the vertex's share of the detail)
 *
 * Integer-exact on the height path (noise.js), so a field is the same number in every engine.
 */
import { fractal2, warp2, terrace, FLAVOURS } from './noise.js';

const CARD = { height: 1.2, scale: 28, flavour: 'fbm', gain: 0.5, damp: 1, finest: 1.5, warp: null, terrace: null, stretch: null, grain: 0.35 };

export const RELIEF_CARDS = Object.freeze({
  rolling: Object.freeze({ ...CARD, id: 'rolling', reads: 'Soft rolling ground, swells a walker climbs without noticing' }),
  craggy: Object.freeze({ ...CARD, id: 'craggy', reads: 'Rough ground broken into crests, smooth in the hollows', height: 1.8, scale: 22, flavour: 'ridged', gain: 0.55, grain: 0.5 }),
  eroded: Object.freeze({ ...CARD, id: 'eroded', reads: 'Weathered ground: clean slopes, detail gathered on the flats and in the gullies', height: 3, scale: 22, flavour: 'damped', gain: 0.55, damp: 0.8, warp: Object.freeze({ strength: 4, scale: 26 }), grain: 0.45 }),
  terraced: Object.freeze({ ...CARD, id: 'terraced', reads: 'Ground stepped into low benches, like worn strata or old fields', height: 2, scale: 30, flavour: 'fbm', gain: 0.45, terrace: Object.freeze({ step: 0.6, riser: 0.35 }), grain: 0.3 }),
  dune: Object.freeze({ ...CARD, id: 'dune', reads: 'Long wind-laid crests across the plain', height: 1.4, scale: 18, flavour: 'ridged', gain: 0.4, stretch: Object.freeze({ along: Object.freeze([1, 0.3]), by: 3 }), warp: Object.freeze({ strength: 3, scale: 30 }), grain: 0.25 }),
});

const WORDS = ['id', 'reads', 'from', ...Object.keys(CARD)];
const bad = (m) => { throw new Error(`relief: ${m}`); };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo, hi, m) => { if (!(typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi)) bad(m); };

/** A card id, a document, or { from, …changes } → the relief, every word checked. */
export function readRelief(spec) {
  if (typeof spec === 'string') {
    if (!RELIEF_CARDS[spec]) bad(`'${spec}' is not a relief card (cards: ${Object.keys(RELIEF_CARDS).join(', ')})`);
    return { ...RELIEF_CARDS[spec] };
  }
  if (!isObj(spec)) bad(`a relief is a card id (${Object.keys(RELIEF_CARDS).join(', ')}) or { from?, …words }`);
  for (const k of Object.keys(spec)) if (!WORDS.includes(k)) bad(`'${k}' is not a word (words: ${WORDS.join(', ')})`);
  if (spec.from !== undefined && !RELIEF_CARDS[spec.from]) bad(`from '${spec.from}' is not a relief card (cards: ${Object.keys(RELIEF_CARDS).join(', ')})`);
  const { from, ...own } = spec, R = { ...(from ? RELIEF_CARDS[from] : { ...CARD, id: 'own', reads: '' }), ...own };
  if (from && own.id === undefined) R.id = `${from}*`;
  num(R.height, 0, 12, 'height is metres from the mean to the highest crest, 0..12');
  num(R.scale, 2, 400, 'scale is metres, the widest feature, 2..400');
  if (!FLAVOURS.includes(R.flavour)) bad(`flavour is one of ${FLAVOURS.join(', ')}`);
  num(R.gain, 0.1, 0.9, 'gain is each octave\'s share of the one before, 0.1..0.9');
  num(R.damp, 0, 8, 'damp is the damped flavour\'s strength, 0..8');
  num(R.finest, 0.5, R.scale, 'finest is metres, the shortest wavelength the ground takes: 0.5 up to scale');
  num(R.grain, 0, 1, 'grain is 0..1');
  if (R.warp !== null) {
    if (!isObj(R.warp) || Object.keys(R.warp).some((k) => !['strength', 'scale'].includes(k))) bad('warp is { strength, scale } metres, or null');
    num(R.warp.strength, 0, 60, 'warp.strength is metres, 0..60'); num(R.warp.scale, 2, 400, 'warp.scale is metres, 2..400');
  }
  if (R.terrace !== null) {
    if (!isObj(R.terrace) || Object.keys(R.terrace).some((k) => !['step', 'riser'].includes(k))) bad('terrace is { step, riser }, or null');
    num(R.terrace.step, 0.1, 10, 'terrace.step is metres, 0.1..10'); num(R.terrace.riser ?? 0.3, 0.05, 1, 'terrace.riser is 0.05..1');
  }
  if (R.stretch !== null) {
    const S = R.stretch;
    if (!isObj(S) || Object.keys(S).some((k) => !['along', 'by'].includes(k))) bad('stretch is { along: [x, y], by }, or null');
    if (!(Array.isArray(S.along) && S.along.length === 2 && S.along.every(Number.isFinite) && (S.along[0] || S.along[1]))) bad('stretch.along is a direction [x, y], not zero');
    num(S.by, 1, 8, 'stretch.by is how many times longer along the direction, 1..8');
  }
  if (typeof R.reads !== 'string') bad('reads is a line of words');
  return R;
}

// the field's octave count: from `scale` down to `finest`, by halvings (no log: integer-exact)
function octavesOf(scale, finest) { let n = 1, w = scale; while (w / 2 >= finest - 1e-9 && n < 10) { w /= 2; n++; } return n; }
// a seed of its own per use, so the relief never repeats the lump or the grain
const seedOf = (seed, salt) => (Math.imul((seed | 0) + 0x9e37, 2654435761) ^ salt) | 0;

// the plane the octaves sample: stretched along a direction, then warped, in units of `scale`
function planeOf(R, seed) {
  const S = R.stretch, W = R.warp ? { strength: R.warp.strength, scale: R.warp.scale, seed: seedOf(seed, 0x51ed) } : null;
  let ux = 1, uy = 0, by = 1;
  if (S) { const l = Math.sqrt(S.along[0] * S.along[0] + S.along[1] * S.along[1]); ux = S.along[0] / l; uy = S.along[1] / l; by = S.by; }
  const inv = 1 / R.scale;
  return (x, y) => {
    let px = x, py = y;
    if (W) [px, py] = warp2(px, py, W);
    // along the direction the features are `by` times longer: the along-component is shrunk before sampling
    const a = (px * ux + py * uy) / by, c = -px * uy + py * ux;
    return [a * inv, c * inv];
  };
}

/** The relief's height at (x, y), metres about 0. */
export function reliefField(R, seed = 1) {
  const plane = planeOf(R, seed), F = { seed: seedOf(seed, 0x2e11), octaves: octavesOf(R.scale, R.finest), gain: R.gain, flavour: R.flavour, damp: R.damp };
  const T = R.terrace;
  return (x, y) => {
    const [u, v] = plane(x, y);
    let h = fractal2(u, v, F)[0] * R.height;
    if (T) h = terrace(h + R.height, T.step, T.riser ?? 0.3) - R.height;
    return h > R.height ? R.height : h < -R.height ? -R.height : h;
  };
}

// the grain's taps over a corner's footprint: the centre and four at a quarter cell, a small box filter
const TAPS = [[0, 0], [-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]];
/** The relief's octaves below `finest`, for colour, averaged over a corner's footprint → about [−1, 1]; null without grain. */
export function reliefGrain(R, seed = 1, cell = 0.5) {
  if (!(R.grain > 0)) return null;
  const plane = planeOf(R, seed), lead = R.scale / R.finest;
  // the grain's own first wavelength is half the finest the ground takes: it starts where the geometry stops
  const F = { seed: seedOf(seed, 0x6a1b), octaves: 3, gain: 0.6, flavour: R.flavour === 'damped' ? 'fbm' : R.flavour };
  return (x, y) => {
    let s = 0;
    for (const [ox, oy] of TAPS) { const [u, v] = plane(x + ox * cell, y + oy * cell); s += fractal2(u * lead * 2, v * lead * 2, F)[0]; }
    return s / TAPS.length;
  };
}
