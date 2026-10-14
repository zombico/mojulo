// vegetation/wildflowers — the flowers that stand in a meadow's grass, as stems and heads a tuft carries.
//
// A wildflower in a sward is a stem standing a little over the blades with its head on top: the eye finds the head's
// colour over the green long before it finds the plant. So a flower here is a stem and a HEAD, grown in the units of the
// tuft it stands in (the tuft's height is 1), and it is drawn with that tuft: the same root, the same scale, the same
// bend in the wind and under a foot (scene/channels/stage-grass.js), so a field of flowers moves as one with its grass.
//
// Five heads, each one way a flower reads at a distance:
//   daisy      a flat ring of white rays round a yellow eye, turned to the sky (Leucanthemum, Bellis)
//   buttercup  five glossy cupped petals, gold, a small eye (Ranunculus)
//   clover     a ball of florets, pink to violet (Trifolium pratense)
//   lupine     a spike of stacked florets, violet, palest at the top (Lupinus)
//   poppy      four broad crumpled petals, red, a dark eye (Papaver rhoeas)
// A plant carries `stems` heads (a daisy a few, a lupine one). Each part is coloured by its kind's ramp in the kit's
// palette (`colours`), every vertex carrying its coordinate up its part's window (stem: root 0 to head 1; petal: base 0
// to tip 1; eye: rim 0 to centre 1), so the page locks it to the ramp's stops as it locks the blades.
// Levels: L2 every petal; L1 half the rays and cups of three; L0 the head as two crossed triangles over a one-triangle
// stem. `size` scales the heads and `lift` the stems: a stylized field reads its flowers big and standing clear (the
// isekai meadow's twice and more), a natural one at 1. Deterministic from its seed (mulberry32).
import { mulberry32 } from './grow.js';
import * as dmath from '../../util/dmath.js';

const DEG = Math.PI / 180;
/**
 * The kinds. stems: [lo, hi] heads a plant carries; height: [lo, hi] the head's height over the tuft's; r: the head's
 * radius (tuft units); tilt: [lo, hi] degrees the head turns from the sky; colours: the ramps its petal and eye take
 * (names in the kit's palette, tried in order: the first a kit has).
 */
export const WILDFLOWERS = Object.freeze({
  daisy: { label: 'oxeye daisy', stems: [2, 4], height: [0.95, 1.2], r: 0.07, tilt: [10, 35], colours: { petal: ['cloud'], eye: ['gold', 'soil'] } },
  buttercup: { label: 'buttercup', stems: [2, 3], height: [1.0, 1.25], r: 0.05, tilt: [5, 25], colours: { petal: ['gold', 'soil'], eye: ['gold', 'soil'] } },
  clover: { label: 'red clover', stems: [2, 4], height: [0.8, 1.0], r: 0.05, tilt: [0, 20], colours: { petal: ['violet', 'blossom', 'cloud'] } },
  lupine: { label: 'lupine', stems: [1, 1], height: [1.25, 1.5], r: 0.05, tilt: [0, 8], colours: { petal: ['violet', 'blossom', 'cloud'] } },
  poppy: { label: 'corn poppy', stems: [1, 2], height: [1.05, 1.3], r: 0.085, tilt: [5, 30], colours: { petal: ['fruit', 'soil'], eye: ['bark'] } },
});
export const WILDFLOWER_KINDS = Object.freeze(Object.keys(WILDFLOWERS));
/** The ramp a part of a kind takes in a palette: the first of its names the palette has, else null. */
export const flowerRamp = (kind, part, palette) => (WILDFLOWERS[kind].colours[part] || []).find((n) => palette[n]) ?? null;

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = dmath.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** A head's frame: its axis (turned `tilt` from the sky toward `az`) and two directions across it. */
function frame(tilt, az) {
  const st = dmath.sin(tilt * DEG), ax = [st * dmath.cos(az), st * dmath.sin(az), dmath.cos(tilt * DEG)];
  const u = unit(cross(ax, Math.abs(ax[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), v = cross(ax, u);
  return { ax, u, v };
}
const at = (F, c, x, y, z) => add(c, add(add(mul(F.u, x), mul(F.v, y)), mul(F.ax, z)));

// the head of a kind at c in its frame, at a level → tris { p, part, v }
function head(kind, c, F, r, lv, rng, tris) {
  const tri = (p, part, v) => tris.push({ p, part, v });
  if (lv === 'L0') {
    const part = kind === 'clover' || kind === 'lupine' ? 'petal' : 'petal', top = kind === 'lupine' ? 3 * r : 0.6 * r;
    for (const [x, y] of [[1, 0], [0, 1]]) tri([at(F, c, -x * r, -y * r, 0), at(F, c, x * r, y * r, 0), at(F, c, 0, 0, top)], part, [0.2, 0.2, 1]);
    return;
  }
  const disc = (n, rr, z, part, vRim, vMid) => { for (let i = 0; i < n; i++) { const a0 = (2 * Math.PI * i) / n, a1 = (2 * Math.PI * (i + 1)) / n; tri([at(F, c, rr * dmath.cos(a0), rr * dmath.sin(a0), z), at(F, c, rr * dmath.cos(a1), rr * dmath.sin(a1), z), at(F, c, 0, 0, z + 0.15 * rr)], part, [vRim, vRim, vMid]); } };
  // a petal from the centre out along angle a: base half-width wb, tip at reach R, cupped up by `cup` (radians)
  const petal = (a, R, wb, cup, z0 = 0, wTip = 0.35) => {
    const d = [dmath.cos(a), dmath.sin(a)], s = [-d[1], d[0]], up = dmath.sin(cup) * R, out = dmath.cos(cup) * R;
    const b0 = at(F, c, s[0] * wb, s[1] * wb, z0), b1 = at(F, c, -s[0] * wb, -s[1] * wb, z0);
    const mid = 0.55, m0 = at(F, c, d[0] * out * mid + s[0] * wb * 1.6, d[1] * out * mid + s[1] * wb * 1.6, z0 + up * mid * mid), m1 = at(F, c, d[0] * out * mid - s[0] * wb * 1.6, d[1] * out * mid - s[1] * wb * 1.6, z0 + up * mid * mid);
    const tp = at(F, c, d[0] * out + s[0] * wb * wTip, d[1] * out + s[1] * wb * wTip, z0 + up), tq = at(F, c, d[0] * out - s[0] * wb * wTip, d[1] * out - s[1] * wb * wTip, z0 + up);
    tri([b0, b1, m1], 'petal', [0, 0, mid]); tri([b0, m1, m0], 'petal', [0, mid, mid]); tri([m0, m1, tq], 'petal', [mid, mid, 1]); tri([m0, tq, tp], 'petal', [mid, 1, 1]);
  };
  const half = lv === 'L1';
  if (kind === 'daisy') {
    const n = half ? 8 : 14, a0 = rng() * Math.PI;
    for (let i = 0; i < n; i++) petal(a0 + (2 * Math.PI * i) / n, r, r * 0.12, 0.12 + 0.1 * rng(), 0.01 * r, 0.6);
    disc(half ? 5 : 7, r * 0.3, 0.06 * r, 'eye', 0, 1);
  } else if (kind === 'buttercup' || kind === 'poppy') {
    const poppy = kind === 'poppy', n = poppy ? 4 : 5, a0 = rng() * Math.PI;
    for (let i = 0; i < (half ? Math.min(3, n) : n); i++) petal(a0 + (2 * Math.PI * i) / n, r, r * (poppy ? 0.42 : 0.3), poppy ? 0.7 : 0.85, 0, poppy ? 1.1 : 0.8);
    disc(half ? 4 : 6, r * (poppy ? 0.22 : 0.25), r * 0.12, 'eye', 0, 1);
  } else if (kind === 'clover') {
    // a ball: two rings of florets round a crown, each a small petal turned up and out, the top palest
    for (const [ring, z, cup] of half ? [[0, 0.2, 0.9]] : [[0, -0.15, 0.3], [1, 0.35, 1.1]]) {
      const n = half ? 5 : 7; for (let i = 0; i < n; i++) petal((2 * Math.PI * (i + 0.5 * ring)) / n + rng() * 0.3, r * 0.95, r * 0.28, cup, z * r, 0.9);
    }
    disc(half ? 4 : 5, r * 0.45, r * 0.45, 'petal', 0.6, 1);
  } else if (kind === 'lupine') {
    // a spike: whorls of florets up a third of the stem, smaller as they rise; the coordinate climbs the spike
    const whorls = half ? 4 : 7, len = 3.2 * r;
    for (let w = 0; w < whorls; w++) {
      const t = w / (whorls - 1), z = t * len, rr = r * (1 - 0.6 * t), n = half ? 3 : 4;
      for (let i = 0; i < n; i++) {
        const a = (2 * Math.PI * (i + 0.5 * (w % 2))) / n, d = [dmath.cos(a), dmath.sin(a)], s = [-d[1], d[0]];
        const b = at(F, c, 0, 0, z), o = at(F, c, d[0] * rr, d[1] * rr, z + 0.35 * rr);
        tri([add(b, mul(add(mul(F.u, s[0]), mul(F.v, s[1])), 0.4 * rr)), add(b, mul(add(mul(F.u, s[0]), mul(F.v, s[1])), -0.4 * rr)), o], 'petal', [t * 0.85, t * 0.85, Math.min(1, t * 0.85 + 0.2)]);
      }
    }
  }
}

/**
 * One plant of a kind at a level, in the units of the tuft it stands in (the tuft's height 1), its root at the origin.
 * → tris [{ p: [3 points], part: 'stem' | 'petal' | 'eye', v: [3 coordinates up the part's window] }]
 */
export function wildflower(kind, { seed = 1, level = 'L2', size = 1, lift = 1 } = {}) {
  const K = WILDFLOWERS[kind]; if (!K) throw new Error(`unknown wildflower '${kind}' (one of ${WILDFLOWER_KINDS.join(', ')})`);
  const rng = mulberry32((seed * 2654435761 + 977) >>> 0), tris = [];
  const n = K.stems[0] + Math.floor(rng() * (K.stems[1] - K.stems[0] + 1));
  for (let q = 0; q < n; q++) {
    const a = rng() * 2 * Math.PI, rr = 0.06 * Math.sqrt(rng()), root = [rr * dmath.cos(a), rr * dmath.sin(a), 0];
    const h = lift * (K.height[0] + (K.height[1] - K.height[0]) * rng()), az = rng() * 2 * Math.PI, tilt = K.tilt[0] + (K.tilt[1] - K.tilt[0]) * rng();
    // the stem: a strip bowing a little toward the head's turn, a few segments (one triangle at L0)
    const lean = 0.04 + 0.05 * rng(), top = [root[0] + lean * dmath.cos(az), root[1] + lean * dmath.sin(az), h];
    const side = [-dmath.sin(az), dmath.cos(az), 0], w = 0.006;
    if (level === 'L0') tris.push({ p: [add(root, mul(side, 2 * w)), add(root, mul(side, -2 * w)), top], part: 'stem', v: [0, 0, 1] });
    else {
      const segs = level === 'L2' ? 3 : 2;
      for (let i = 0; i < segs; i++) {
        const s0 = i / segs, s1 = (i + 1) / segs, p = (s) => [root[0] + (top[0] - root[0]) * s * s, root[1] + (top[1] - root[1]) * s * s, h * s];
        const a0 = add(p(s0), mul(side, w)), a1 = add(p(s0), mul(side, -w)), b0 = add(p(s1), mul(side, w)), b1 = add(p(s1), mul(side, -w));
        tris.push({ p: [a0, a1, b1], part: 'stem', v: [s0, s0, s1] }, { p: [a0, b1, b0], part: 'stem', v: [s0, s1, s1] });
      }
    }
    head(kind, top, frame(tilt, az), size * K.r * (0.85 + 0.3 * rng()), level, rng, tris);
  }
  return tris;
}

/** A kind's ladder: { L2, L1, L0 } → tris. */
export const wildflowerLadder = (kind, { seed = 1, size = 1, lift = 1 } = {}) => Object.fromEntries(['L2', 'L1', 'L0'].map((l) => [l, wildflower(kind, { seed, level: l, size, lift })]));
