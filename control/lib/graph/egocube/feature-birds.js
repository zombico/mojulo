/**
 * THE FEATURE STYLE'S BIRDS: each bird told by its own beak, its own plumage and a head that matches them, in a side
 * silhouette of golden proportions (docs/feature-style.md). All of it is read from the fauna roster's realistic bird
 * (fauna/species.js speciesParams: the cranium's rows give the beak's shape, the colours its plumage).
 *
 *   PHI                    the golden ratio. In the side silhouette the three masses fall in it: the tail : the head : the
 *                          body as 1 : φ : φ² (the beak apart)
 *   beakOf(id)             → { len, slender, wide, droop, hook } (the beak against the skull, its length against its
 *                          depth, its width against its depth, how far its tip curves down, how far its upper tip
 *                          overhangs the lower: negative a hook) or null
 *   beakParts(m, hd)       → the beak as a muzzle module (feature-grammar.js MUZZLES): the upper mandible a tuft bent by
 *                          the droop and aimed down by the depth, the lower a shorter one under it (shorter still under a
 *                          hook), or a flat egg where the beak is wider than deep (a bill); its mouth along it
 *   headOf(m)              → the head that matches the beak: [long, across, up] scales on the cranium and the jaw, and a
 *                          brow ridge over the eyes on a hooked beak (a raptor's frown)
 *   plumageOf(id)          → the colours that are the bird's pattern: its head (a crown of its own colour; a hood when the
 *                          neck shares it), its neck (a band), its tail's tip (and its primaries when that is darker), its
 *                          wing bars (a value step of the coat's own greys), its legs, its beak; only those that read
 *                          apart from the coat
 *   extentAlong(eggs, d)   → [lo, hi]: how far a set of eggs reaches along a direction (each an ellipsoid on its frame)
 *
 * Head units (h), z up, y front. Pure: data and arithmetic.
 */
import { speciesParams } from '../fauna/species.js';

export const PHI = (1 + Math.sqrt(5)) / 2;

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function beakOf(id) {
  let q = null; try { q = speciesParams(id); } catch { return null; }
  const C = q?.craniumRows, J = q?.jawRows, m = q?.muzzleFrom ?? 3;
  if (!Array.isArray(C) || !Array.isArray(J) || C.length <= m + 2 || !J.length) return null;
  const y = (r) => r[1], top = (r) => r[2], ring = (r) => r.slice(3).filter(Array.isArray), wid = (r) => Math.max(...ring(r).map((p) => p[0]));
  const skull = y(C[m]) - y(C[0]), len = y(C.at(-1)) - y(C[m]), depth = top(C[m]) - J[0][2].bottom, width = 2 * wid(C[m + 1]);
  if (!(skull > 0 && len > 0 && depth > 0)) return null;
  const slope = (a, b) => (top(b) - top(a)) / (y(b) - y(a)), lo = (r) => Math.min(...ring(r).map((p) => p[1]));
  return { len: r4(len / skull), slender: r4(len / depth), wide: r4(width / depth), droop: r4(slope(C.at(-2), C.at(-1)) - slope(C[m], C.at(-2))), hook: r4((lo(C.at(-1)) - J.at(-1)[2].bottom) / len) };
}

/** THE BEAK'S NUMBERS: its length in head units from its measures (a base, the share of the skull, the slenderness), its
 *  limits, its root's radius against its depth, the curl a unit of droop gives, the depth that aims it down, the width
 *  over depth that makes it a bill */
export const FEATURE_BEAK = Object.freeze({ base: 0.3, perLen: 0.38, perSlender: 0.08, len: [0.42, 1.5], root: [0.06, 0.3], curl: 40, down: 0.45, bill: 1.2 });

export function beakParts(m, hd = 1) {
  const B = FEATURE_BEAK, L = clamp(B.base + B.perLen * m.len + B.perSlender * m.slender, B.len[0], B.len[1]) * hd;
  const depth = L / Math.max(m.slender, 0.3), R = clamp(depth / 2, B.root[0] * hd, B.root[1] * hd), curl = clamp(-m.droop * B.curl, 0, 80);
  const root = [0, 0.42, 2.54], s = Math.min(L, 0.7 * hd);
  const mouth = { nose: [0, root[1] + 0.5 * s, 2.56], centre: [0, root[1] + 0.7 * s, 2.48], corner: [0.14, 0.5, 2.5], pivot: [0, 0.3, 2.56] };
  if (m.wide >= B.bill) return { eggs: [{ name: 'bill', c: [0, root[1] + L / 2, 2.5], u: [0, 1, -0.1], r: [L / 2, (depth * m.wide) / 2, depth * 0.3], hint: [1, 0, 0], bone: 'head', group: 'Beak', join: 0.06 }], mouth, nose: 'bill', kind: 'bill' };
  const down = -clamp(B.down / Math.max(m.slender, 0.3), 0.1, 1);
  return {
    eggs: [],
    tufts: [
      { name: 'beak', root: [0, root[1], root[2] + 0.02], aim: unit([0, 1, down]), len: L, r: R, tip: 0.12, curl, bend: [0, 0, -1], bone: 'head', group: 'Beak', join: 0.06 },
      { name: 'beakLow', root: [0, root[1] - 0.02, root[2] - 0.07], aim: unit([0, 1, down - 0.05]), len: L * (curl > 18 ? 0.55 : 0.8), r: R * 0.62, tip: 0.2, curl: curl * 0.3, bend: [0, 0, -1], bone: 'head', group: 'Beak', join: 0.05 },
    ],
    mouth, nose: 'beak', kind: raptor(m) ? 'hook' : m.slender < 0.7 ? 'deep' : curl > 18 ? 'bent' : m.slender > 2.4 ? 'needle' : 'point',
  };
}

/** the head that matches its beak: a hooked beak's head long and low under a brow ridge; a deep beak's big and round; a
 *  needle's small and sleek; a bill's broad and low; a beak longer than the skull's a small head behind it */
/** a raptor's beak: its tip curving down and overhanging the lower, on a beak no deeper than long (a parrot's is deep) */
const raptor = (m) => m.droop <= -0.45 && (m.hook ?? 0) < 0.03 && m.slender >= 0.8;

export function headOf(m) {
  if (!m) return { shape: [1, 1, 1], brow: false };
  const hook = raptor(m), k = m.len > 2 ? 0.86 : 1;
  const shape = m.wide >= FEATURE_BEAK.bill ? [1.04, 1.06, 0.9] : hook ? [1.08, 0.94, 0.88] : m.slender < 0.7 ? [1, 1.06, 1.06] : m.slender > 2.4 ? [0.94, 0.88, 0.92] : [1, 1, 1];
  return { shape: shape.map((x) => r4(x * k)), brow: hook };
}

const rgb = (h) => (typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) : null);
const apart = (a, b) => { const x = rgb(a), y = rgb(b); return x && y ? Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) / Math.sqrt(3) : 0; };
const lum = (h) => { const c = rgb(h); return c ? 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] : 0; };
const sat = (h) => { const c = rgb(h); if (!c) return 0; const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
const hue = (h) => { const c = rgb(h); if (!c) return 0; const [r, g, b] = c, mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return 0; const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
/** two colours that read apart: far apart in the cube, or a saturated one of another hue (a pigeon's green neck on grey) */
const distinct = (a, b) => apart(a, b) >= PLUMAGE_APART || (Math.max(sat(a), sat(b)) >= 0.25 && Math.min(Math.abs(hue(a) - hue(b)), 360 - Math.abs(hue(a) - hue(b))) >= 50);

/** the least difference (a share of the colour cube's diagonal) that makes a colour a pattern of its own */
export const PLUMAGE_APART = 0.12;

export function plumageOf(id) {
  let C = {}; try { C = speciesParams(id)?.colors ?? {}; } catch { return {}; }
  const coat = C.coat, own = (c) => c && distinct(c, coat);
  const crown = own(C.skull) ? C.skull : null, neck = own(C.mane) && (!crown || distinct(C.mane, crown)) ? C.mane : null;
  // (wing bars: a value step of the coat's own greys and browns, not a saturated colour of another part)
  const bar = own(C.ash) && sat(C.ash) < 0.35 && Math.abs(lum(C.ash) - lum(coat)) <= 0.35 && apart(C.ash, C.tip ?? '#000000') >= PLUMAGE_APART ? C.ash : null;
  // (the tail's tip is the roster's `tip`; the wing's primaries take it only where it is darker than the coat: a pale
  // tail, an eagle's, is not a pale wingtip)
  const tip = own(C.tip) ? C.tip : null;
  return { ...(crown ? { crown } : {}), ...(neck ? { neck } : {}), ...(tip ? { tip, ...(lum(tip) < lum(coat) ? { primaries: tip } : {}) } : {}), ...(bar ? { bar } : {}), ...(C.sock ? { sock: C.sock } : {}), ...(C.snout ? { beak: C.snout } : {}), ...(crown && C.mane && !neck && !distinct(C.mane, crown) ? { hood: true } : {}) };
}

/** an egg's frame (feature-body.js egg()) */
function frameOf(e) {
  const U = unit(e.u), h = e.hint ?? [1, 0, 0], h0 = Math.abs(dot(unit(h), U)) > 0.95 ? [0, 1, 0] : h;
  const d = dot(h0, U), V = unit([h0[0] - U[0] * d, h0[1] - U[1] * d, h0[2] - U[2] * d]);
  return [U, V, cross(U, V)];
}

/** a colour stepped darker (k < 0, toward black) or lighter (k > 0, toward white) */
export const shade = (h, k) => { const c = rgb(h); if (!c) return h; return `#${c.map((x) => Math.round(255 * Math.max(0, Math.min(1, k < 0 ? x * (1 + k) : x + (1 - x) * k))).toString(16).padStart(2, '0')).join('')}`; };

/** a bird's wing tones: the wing a value step off the coat (darker; lighter on a coat already dark), its flight
 *  feathers a step further, or the primaries' own colour where the bird has one */
export function wingTones(coat, plume = {}) {
  const dark = lum(coat) < 0.18, wing = shade(coat, dark ? 0.16 : -0.2);
  return { Wing: wing, Flight: plume.primaries ?? shade(wing, dark ? 0.14 : -0.25) };
}

export function extentAlong(eggs, dir) {
  const D = unit(dir); let lo = Infinity, hi = -Infinity;
  for (const e of eggs) { const [U, V, W] = frameOf(e), c = dot(e.c, D), h = Math.hypot(e.r[0] * dot(U, D), e.r[1] * dot(V, D), e.r[2] * dot(W, D)); lo = Math.min(lo, c - h); hi = Math.max(hi, c + h); }
  return [lo, hi];
}
