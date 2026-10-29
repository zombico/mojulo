/**
 * THE BIPED'S COAT PATTERN: markings solved in an upright body's own anatomy, where the animal door's markings are windows
 * in a quadruped's frame (fauna/build.js: `t` from the spine down to the belly, `run` from the rump to the chest) and read
 * inside out on a biped (a belly a bib over the whole front, flank stripes hoops). A pattern is a list of LAYERS
 * (`beast.pattern`), each a field over the body's REST SURFACE in metres, painted in order (a later layer over an earlier
 * one), never the rings: ./coat-atlas.js samples it at texel density, so a stripe is as fine as it is drawn.
 *
 * The anatomy each layer reads (sampleFrame): a point's REGION (trunk, neck, arm, leg, tail, coil), its DORSALITY D (+1
 * the side an animal darkens, −1 the side it lightens: the trunk's and the neck's back against their front; a limb's outer
 * face against its inner one; a tail's and a coil's top against their underside), its ANGLE round
 * from the back (θ: 0 the spine, 1 the breastbone), its height, and its DISTANCE down its limb (`chain`: 0 the shoulder or
 * the hip, 1 the fingertip or the toe; `s` in metres from the limb's root, so a band runs on across the knee; a tail's and
 * a coil's down their length).
 *
 *   countershade { color = suit, reach = 0.34, soft = 0.1 }    the light underside: the throat, the chest and the belly,
 *                the inner arms and thighs, under the tail (reach: how far round from the front, 0 … 1)
 *   stripes      { color = seam, period = 0.085, width = 0.38, slant = 0.7, wobble = 0.3, reach = 0.72, limbs = true }
 *                chevrons swept down and forward from the spine round the flanks, thinning toward the front and stopping
 *                short of it (reach); bands across the limbs' outer faces; rings round the tail (period in metres)
 *   spots        { color = seam, size = 0.022, spacing = 0.06, reach = 0.8 }   round spots on a jittered lattice in metres,
 *                fewer toward the front (size a spot's radius)
 *   rosettes     { color = seam, fill = armor, size = 0.03, spacing = 0.075, ring = 0.4, reach = 0.8 }   a broken ring of
 *                dark round a darkened centre (a leopard's, a jaguar's)
 *   points       { color = seam, from = 0.62, soft = 0.12 }   the extremities darkened (a Siamese's): down each limb from
 *                `from`, the tail's far end
 *   socks        { color = suit, from = 0.84, soft = 0.04 }   the hands and the feet lightened
 *   saddle       { color = seam, reach = 0.45, top = 0.92, bottom = 0.3, soft = 0.08 }   a dark field over the back between
 *                the hips and the shoulders (shares of the trunk's height), round to `reach`
 *   dorsal       { color = seam, width = 0.025 }   a line down the spine, the neck's back and the tail's top (half width, m)
 *
 * A colour is '#rrggbb' or one of the coat's own words (mutagen/push.js colorWords: suit, armor, seam, accent, opposite).
 * Lengths are at a 1.8 m figure and scale with the body. Every field is deterministic (a hash of the place, no dice).
 *
 *   PATTERN_KINDS, patternErrors(pattern)
 *   patternField(layers, { coat, k })  → (sample) → '#rrggbb' or null (the coat): `sample` { region, D, theta, z, zt,
 *                                        chain, s, p }; ./coat-atlas.js builds the samples
 * Pure.
 */
import { colorWords, COLOR_WORDS } from '../mutagen/push.js';

export const PATTERN_KINDS = Object.freeze(['countershade', 'stripes', 'spots', 'rosettes', 'points', 'socks', 'saddle', 'dorsal']);
const DEFAULTS = Object.freeze({
  countershade: { color: 'suit', reach: 0.34, soft: 0.1 },
  stripes: { color: 'seam', period: 0.085, width: 0.38, slant: 0.7, wobble: 0.3, reach: 0.72, limbs: true },
  spots: { color: 'seam', size: 0.022, spacing: 0.06, reach: 0.8 },
  rosettes: { color: 'seam', fill: 'armor', size: 0.03, spacing: 0.075, ring: 0.4, reach: 0.8 },
  points: { color: 'seam', from: 0.62, soft: 0.12 },
  socks: { color: 'suit', from: 0.84, soft: 0.04 },
  saddle: { color: 'seam', reach: 0.45, top: 0.92, bottom: 0.3, soft: 0.08 },
  dorsal: { color: 'seam', width: 0.025 },
});
const RANGES = { reach: [0, 1], soft: [0, 0.5], period: [0.02, 0.4], width: [0.05, 0.9], slant: [-2, 2], wobble: [0, 1], size: [0.005, 0.15], spacing: [0.015, 0.4], ring: [0.1, 0.9], from: [0, 1], top: [0, 1], bottom: [0, 1] };
const HEX = /^#[0-9a-f]{6}$/i;

export function patternErrors(pattern, label = 'beast.pattern') {
  if (pattern === undefined) return [];
  if (!Array.isArray(pattern)) return [`${label}: a list of layers { kind: ${PATTERN_KINDS.join(' | ')}, color?, … }`];
  const errs = [];
  pattern.forEach((L, i) => {
    const at = `${label}[${i}]`;
    if (!L || typeof L !== 'object' || Array.isArray(L)) { errs.push(`${at}: { kind, color?, … }`); return; }
    if (!PATTERN_KINDS.includes(L.kind)) { errs.push(`${at}.kind: ${PATTERN_KINDS.join(' | ')}`); return; }
    const words = ['kind', ...Object.keys(DEFAULTS[L.kind])];
    for (const [k, v] of Object.entries(L)) {
      if (!words.includes(k)) errs.push(`${at}.${k}: a ${L.kind} takes ${words.slice(1).join(', ')}`);
      else if (k === 'color' || k === 'fill') { if (!(HEX.test(v) || COLOR_WORDS.includes(v))) errs.push(`${at}.${k}: '#rrggbb' or the coat's own (${COLOR_WORDS.join(' | ')})`); }
      else if (k === 'limbs') { if (typeof v !== 'boolean') errs.push(`${at}.limbs: true or false`); }
      else if (k !== 'kind' && !(Number.isFinite(v) && v >= RANGES[k][0] && v <= RANGES[k][1])) errs.push(`${at}.${k}: ${RANGES[k][0]} … ${RANGES[k][1]}`);
    }
  });
  return errs;
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a || 1e-9)); return t * t * (3 - 2 * t); };
const frac = (x) => x - Math.floor(x);
const ih = (x, y, z) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// smooth value noise in 3D (−1 … 1), a stripe's wobble
function noise3(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), fx = x - X, fy = y - Y, fz = z - Z, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t, c = (i, j, k) => ih(X + i, Y + j, Z + k);
  return 2 * L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w) - 1;
}
// the nearest centre of a jittered lattice of `cell` (mirror-symmetric: |x|): its distance and its own size factor
function nearest(p, cell, salt) {
  const q = [Math.abs(p[0]) / cell, p[1] / cell, p[2] / cell], b = q.map(Math.floor); let best = Infinity, size = 1;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const c = [b[0] + i, b[1] + j, b[2] + k], o = [ih(c[0], c[1], c[2] + salt), ih(c[1], c[2], c[0] + salt + 7), ih(c[2], c[0], c[1] + salt + 13)];
    const d = Math.hypot(q[0] - c[0] - 0.15 - 0.7 * o[0], q[1] - c[1] - 0.15 - 0.7 * o[1], q[2] - c[2] - 0.15 - 0.7 * o[2]) * cell;
    if (d < best) { best = d; size = 0.7 + 0.6 * ih(c[0] + 31, c[1], c[2] + salt); }
  }
  return { d: best, size };
}

const BODY = new Set(['trunk', 'neck']), LIMB = new Set(['arm', 'leg']);
/** each layer's weight at a sample (0 … 1): the share of its colour over what lies under it */
const WEIGHT = {
  countershade: (L, S) => (S.region === 'coil' || S.region === 'tail' || BODY.has(S.region) || LIMB.has(S.region) ? smooth(1 - L.reach - L.soft, 1 - L.reach + L.soft, (1 - S.D) / 2) : 0),
  stripes(L, S, k) {
    const P = L.period * k, wob = L.wobble * noise3(Math.abs(S.p[0]) / (2.2 * P), S.p[1] / (2.2 * P), S.p[2] / (2.2 * P));
    let phase, taper;
    if (BODY.has(S.region)) { if (S.theta > L.reach) return 0; phase = S.z / P + L.slant * S.theta * 2 + wob; taper = 1 - (S.theta / L.reach) ** 2; }
    else if (LIMB.has(S.region)) { if (!L.limbs || S.D < -0.25) return 0; phase = S.s / P + wob * 0.6; taper = smooth(-0.25, 0.35, S.D) * (S.chain > 0.9 ? 0 : 1); }
    else if (S.region === 'tail' || S.region === 'coil') { phase = S.s / (P * 1.3) + wob * 0.4; taper = S.region === 'coil' ? smooth(-0.3, 0.3, S.D) : 1; }
    else return 0;
    const w = L.width * taper, f = frac(phase), e = 0.06;
    return w <= 0 ? 0 : smooth(0, e, f) * (1 - smooth(w - e, w, f));
  },
  spots(L, S, k) {
    if (S.region === 'other' || (1 - S.D) / 2 > L.reach) return 0;
    const n = nearest(S.p, L.spacing * k, 101), r = L.size * k * n.size;
    return 1 - smooth(r * 0.85, r, n.d);
  },
  rosettes(L, S, k) {
    if (S.region === 'other' || (1 - S.D) / 2 > L.reach) return 0;
    const n = nearest(S.p, L.spacing * k, 211), r = L.size * k * n.size, rin = r * (1 - L.ring);
    // (the ring broken: a gap where the place's own noise is low)
    const gap = noise3(Math.abs(S.p[0]) * 60 / k, S.p[1] * 60 / k, S.p[2] * 60 / k) < -0.35 ? 0 : 1;
    return n.d < rin ? -1 : (1 - smooth(r * 0.88, r, n.d)) * gap;   // (−1: the centre, its fill)
  },
  points: (L, S) => (LIMB.has(S.region) ? smooth(L.from - L.soft, L.from + L.soft, S.chain) : S.region === 'tail' ? smooth(0.55, 0.85, S.chain) : 0),
  socks: (L, S) => (LIMB.has(S.region) ? smooth(L.from - L.soft, L.from + L.soft, S.chain) : 0),
  saddle: (L, S) => (S.region === 'trunk' ? smooth(1 - 2 * L.reach - L.soft, 1 - 2 * L.reach + L.soft, S.D) * smooth(L.bottom - L.soft, L.bottom + L.soft, S.zt) * (1 - smooth(L.top - L.soft, L.top + L.soft, S.zt)) : 0),
  dorsal(L, S, k) {
    if (!(BODY.has(S.region) || S.region === 'tail')) return 0;
    const facing = S.region === 'tail' ? S.D : S.D, w = L.width * k;
    return facing < 0.2 ? 0 : 1 - smooth(w * 0.7, w, Math.abs(S.p[0]));
  },
};

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;

/** a pattern's layers over a coat → the colour at a sample (null: the coat, untouched) */
export function patternField(layers, { coat, k = 1 }) {
  const W = colorWords(coat), word = (c) => (COLOR_WORDS.includes(c) ? W[c] : c);
  const Ls = layers.map((L) => { const D = { ...DEFAULTS[L.kind], ...L }; return { ...D, rgb: rgb(word(D.color)), ...(D.fill ? { fillRgb: rgb(word(D.fill)) } : {}) }; });
  const base = rgb(coat);
  return (S) => {
    let c = base, moved = false;
    for (const L of Ls) {
      const w = WEIGHT[L.kind](L, S, k);
      if (w === -1 && L.fillRgb) { c = L.fillRgb; moved = true; continue; }
      if (w > 0.002) { c = c.map((x, i) => x + (L.rgb[i] - x) * w); moved = true; }
    }
    return moved ? hex(c) : null;
  };
}
