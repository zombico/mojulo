/**
 * A FIELD OF LIVERIES — the cars of one race painted so each is told from the road it is on and from the others, by
 * every eye. The world's palette is the ground the cars are figures on: the solver reads what a car is seen against
 * (the road, the kerb, the grass, the sky) and paints the field clear of it.
 *
 *   solveLiveries({ n, seed?, palette?, against? }) → { liveries: [{ paint, secondary, pattern }], against, checks, laws }
 *     n         the cars (1 to 12)
 *     palette   a solved palette contract (solve.js): the road its rock ramp taken dark, the kerb its accent, the grass
 *               its foliage, the sky its sky (as roads/track-kit.js draws a track in a world's look)
 *     against   [{ what, hex, min? }] given instead: what a car is seen on (min: the OKLab distance it must keep)
 *               Neither: a neutral circuit (grey asphalt, a red-and-white kerb, grass, a pale sky).
 *
 * Candidates sit on an OKLCH grid at car-paint lightness and chroma (24 hues, turned by the seed, at three
 * lightnesses), with a pearl white. Each car in turn takes the candidate whose worst margin is greatest: its OKLab
 * distance from each ground colour over that colour's `min`, from each car already chosen over 0.1, and the same under
 * protan, deutan and tritan simulation over half those. Patterns rotate through the field (stripes, split, mono) so two
 * cars near in colour still differ in shape; the secondary is a near-white on a dark paint and a near-black on a light
 * one. The laws measure and advise; none refuses. Pure: the seed's dice only (mulberry32).
 */
import { oklch, rgbToHex, hexToRgb, deltaE, simulate, CVD_KINDS, lchOf } from './oklab.js';
import { mulberry32 } from '../vegetation/grow.js';

export const LIVERY_FIELD_PATTERNS = Object.freeze(['stripes', 'split', 'mono']);
/** How far apart two cars must be (OKLab), and under a colour-vision simulation. */
export const PAIR_MIN = 0.1;
const CVD_SHARE = 0.5;
const MIN_OF = Object.freeze({ road: 0.12, grass: 0.1, sky: 0.1, kerb: 0.06 });
/** A circuit with no world: grey asphalt, a red-and-white kerb, grass and a pale sky. */
export const NEUTRAL_CIRCUIT = Object.freeze([
  { what: 'road', hex: '#3b3d40' }, { what: 'road', hex: '#55585c' }, { what: 'kerb', hex: '#c8302c' },
  { what: 'kerb', hex: '#e8e8e8' }, { what: 'grass', hex: '#4f7a34' }, { what: 'sky', hex: '#a9c8e6' },
]);

/** What a car is seen against in a world drawn in this palette (track-kit's materials, read off its roles). */
export function groundOf(palette) {
  const R = palette.roles, mid = (r) => r[Math.floor(r.length / 2)];
  return [{ what: 'road', hex: R.rock[0] }, { what: 'road', hex: R.rock[1] }, { what: 'kerb', hex: mid(R.accent) },
    { what: 'grass', hex: mid(R.foliage) }, { what: 'grass', hex: mid(R.ground) }, { what: 'sky', hex: mid(R.sky) }];
}

const HEXRE = /^#[0-9a-f]{6}$/;
function readAgainst(against) {
  if (!Array.isArray(against) || !against.length) throw new Error('livery: against is a list of { what, hex, min? }');
  return against.map((a, i) => {
    if (!a || typeof a.hex !== 'string' || !HEXRE.test(a.hex.toLowerCase())) throw new Error(`livery: against[${i}].hex is '#rrggbb'`);
    if (a.min !== undefined && !(a.min > 0 && a.min < 1)) throw new Error(`livery: against[${i}].min is an OKLab distance between 0 and 1`);
    return { what: String(a.what ?? 'ground'), hex: a.hex.toLowerCase(), min: a.min ?? MIN_OF[a.what] ?? 0.1 };
  });
}

// every distance a colour is judged by: plain, and under each colour-vision kind
const views = (rgb) => [rgb, ...CVD_KINDS.map((k) => simulate(rgb, k))];
function margin(A, B, min) {
  let worst = deltaE(A[0], B[0]) / min;
  for (let k = 1; k < A.length; k++) worst = Math.min(worst, deltaE(A[k], B[k]) / (min * CVD_SHARE));
  return worst;
}

export function solveLiveries({ n, seed = 1, palette, against } = {}) {
  if (!Number.isInteger(n) || n < 1 || n > 12) throw new Error('livery: n is how many cars (1 to 12)');
  if (!Number.isInteger(seed)) throw new Error('livery: seed is a whole number');
  const ground = readAgainst(against ?? (palette ? groundOf(palette) : NEUTRAL_CIRCUIT)), G = ground.map((g) => views(hexToRgb(g.hex)));
  const rnd = mulberry32((seed * 2654435761 + 97) >>> 0), turn = rnd() * 15;
  const grid = [];
  for (let i = 0; i < 24; i++) for (const L of [0.5, 0.62, 0.74]) grid.push(oklch(L, 0.17, turn + i * 15));
  grid.push(oklch(0.93, 0.01, turn));
  // (the seed also orders the grid, so a tie goes the same way every time and a new seed another way)
  const cands = [...new Set(grid.map(rgbToHex))].map((hex) => ({ hex, k: rnd(), V: views(hexToRgb(hex)) })).sort((a, b) => a.k - b.k);
  const chosen = [];
  for (let i = 0; i < n; i++) {
    let best = null;
    for (const c of cands) {
      if (chosen.includes(c)) continue;
      let s = Infinity;
      for (let g = 0; g < ground.length; g++) s = Math.min(s, margin(c.V, G[g], ground[g].min));
      for (const o of chosen) s = Math.min(s, margin(c.V, o.V, PAIR_MIN));
      if (!best || s > best.s) best = { c, s };
    }
    chosen.push(best.c);
  }
  const p0 = Math.floor(rnd() * LIVERY_FIELD_PATTERNS.length);
  const liveries = chosen.map((c, i) => ({ paint: c.hex, secondary: lchOf(hexToRgb(c.hex))[0] > 0.68 ? '#1a1d22' : '#eef0f2', pattern: LIVERY_FIELD_PATTERNS[(p0 + i) % LIVERY_FIELD_PATTERNS.length] }));
  // the checks: each car's nearest ground colour and nearest car, plainly and by its weakest eye
  const checks = chosen.map((c, i) => {
    const g = ground.map((x, j) => ({ what: x.what, hex: x.hex, dE: deltaE(c.V[0], G[j][0]), cvd: Math.min(...CVD_KINDS.map((_, k) => deltaE(c.V[k + 1], G[j][k + 1]))), min: x.min })).reduce((a, b) => (b.dE / b.min < a.dE / a.min ? b : a));
    const others = chosen.map((o, j) => ({ j, dE: deltaE(c.V[0], o.V[0]), cvd: Math.min(...CVD_KINDS.map((_, k) => deltaE(c.V[k + 1], o.V[k + 1]))) })).filter((o) => o.j !== i);
    const near = others.length ? others.reduce((a, b) => (b.dE < a.dE ? b : a)) : null;
    const r3 = (x) => Math.round(x * 1000) / 1000;
    return { car: i, ground: { what: g.what, hex: g.hex, dE: r3(g.dE), cvd: r3(g.cvd) }, ...(near ? { nearest: { car: near.j, dE: r3(near.dE), cvd: r3(Math.min(...others.map((o) => o.cvd))) } } : {}) };
  });
  const laws = [
    { law: 'clear-of-ground', want: 'every car clear of what it is seen on, by each colour\'s distance (half that for colour-blind eyes)', ok: chosen.every((c) => ground.every((g, j) => margin(c.V, G[j], g.min) >= 1)) },
    { law: 'told-apart', want: `every two cars at least ${PAIR_MIN} apart (half that for colour-blind eyes)`, ok: chosen.every((c, i) => chosen.every((o, j) => j <= i || margin(c.V, o.V, PAIR_MIN) >= 1)) },
  ];
  return { liveries, against: ground, checks, laws };
}
