/**
 * LEAF CHIPS — a crown drawn the painted way: its masses a dark core, and over them small leaf CHIPS, each a cupped
 * oval (a potato chip: its rim rising and falling in a saddle), coloured LOW, MID or HIGH from the kit's foliage ramp by
 * where it sits in the crown's light — the successor, in spirit, of the X tree's crossed cards: many small cards in the
 * crown's volume instead of two planes through it.
 *
 *   leafChips(masses, opts)  → faces (group `isekai:chips`, one a chip, its six corners a saddle; each its `fill`,
 *                              doubly sided): over each mass ({ at, r }),
 *                              chips scattered on its skin by seeded dice (a share straying past it, breaking the
 *                              outline), each lit by the CLUMP's normal (its mass's and the crown's, blended) toward the
 *                              sun and whether the sun reaches it (`shadow`), a little noise so a band's edge runs chip
 *                              by chip; the low band thinned (the core shows between its chips)
 *   chipCore(masses, opts)   → the masses as the core, the darkest stop, drawn a little inside the chips
 *
 *   opts: { crown: { c, Rc, squash }, toSun, shadow(p, n) → 0..1, ramp (the foliage ramp, 0..255 rgb, dark to light),
 *           seed, count (chips a mass at the crown's radius), size (a chip's long radius over the crown's), stray, cup,
 *           tilt (how far a chip turns off the clump's normal),
 *           bands: [low|mid, mid|high] (the light a chip needs), keepLow (the low band's share kept), glint }
 *
 * Pure: hashed dice only.
 */
import { hash3 } from './dirt.js';
import { P, r5, rgbHex } from './geom.js';
import { blobTris } from '../vegetation/tree-mesh.js';

// (the gallery's choice, scripts/spikes/geotown/chips.mjs: rounded eight-cornered chips, about a thousand to a crown,
// gently cupped and tilted, the low band mostly kept so the core shows as depth, a few strays breaking the outline)
export const CHIP_DEFAULTS = Object.freeze({ corners: 8, tilt: 0.25, count: 1000, size: 0.09, stray: 0.12, cup: 0.16, bands: Object.freeze([0.3, 0.62]), keepLow: 0.8, glint: 0.08, noise: 0.14, shrink: 0.9 });

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const hexOf = (c) => rgbHex(c.map((v) => v / 255));

/** The chips over a crown's masses. */
export function leafChips(masses, opts) {
  const o = { ...CHIP_DEFAULTS, ...opts }, { c, Rc, squash = 1 } = o.crown, out = [], ramp = o.ramp, S = o.seed | 0;
  const stop = { low: ramp[Math.min(1, ramp.length - 1)], mid: ramp[Math.floor(ramp.length / 2)], high: ramp[Math.max(0, ramp.length - 2)], glint: ramp[ramp.length - 1] };
  masses.forEach((m, mi) => {
    const n = Math.round(o.count * (m.r / Rc) ** 2);
    for (let i = 0; i < n; i++) {
      const h = (k) => hash3(mi * 4099 + i, k, S + 5011);
      // a point on the mass's skin (an even spread: z uniform), a share of chips straying past it
      const z = 2 * h(1) - 1, a = 2 * Math.PI * h(2), rr = Math.sqrt(1 - z * z), d = [Math.cos(a) * rr, Math.sin(a) * rr, z];
      const out1 = h(3) < o.stray ? 1.1 + 0.25 * h(4) : 0.94 + 0.12 * h(4), p = [m.at[0] + d[0] * m.r * out1, m.at[1] + d[1] * m.r * out1, m.at[2] + d[2] * m.r * squash * out1];
      // the clump's normal: the mass's, leaned to the crown's (so the crown shades as one volume)
      const nc = unit(add(mul(unit([d[0], d[1], d[2] / squash]), 0.65), mul(unit([p[0] - c[0], p[1] - c[1], (p[2] - c[2]) / squash]), 0.35)));
      const lam = Math.max(0, (dot(nc, o.toSun) + 0.2) / 1.2), sun = o.shadow ? o.shadow(add(p, mul(nc, 0.05)), nc) : 1;
      const v = lam * (0.25 + 0.75 * sun) + o.noise * (2 * h(5) - 1);
      const band = v > o.bands[1] ? 'high' : v > o.bands[0] ? 'mid' : 'low';
      if (band === 'low' && h(6) > o.keepLow) continue;
      const col = band === 'high' && h(7) < o.glint ? stop.glint : stop[band];
      // the chip: an oval round its centre, tilted off the clump's normal a little each way, its rim a saddle
      const nrm = unit(add(nc, mul([h(8) - 0.5, h(9) - 0.5, h(10) - 0.35], 2 * o.tilt))), e0 = unit(Math.abs(nrm[2]) > 0.9 ? cross(nrm, [1, 0, 0]) : cross(nrm, [0, 0, 1]));
      const t = 2 * Math.PI * h(11), e1 = add(mul(e0, Math.cos(t)), mul(cross(nrm, e0), Math.sin(t))), e2 = cross(nrm, e1);
      const A = Rc * o.size * (0.75 + 0.5 * h(12)), B = A * (0.55 + 0.15 * h(13));
      const rim = Array.from({ length: o.corners }, (_, k) => { const q = (2 * Math.PI * k) / o.corners; return add(add(add(p, mul(e1, Math.cos(q) * A)), mul(e2, Math.sin(q) * B)), mul(nrm, o.cup * B * Math.cos(2 * q))); });
      // (one face, its corners the saddle's rim: the page fans it into triangles, two fewer than its corners)
      out.push({ corners: rim.map(P), normal: nrm.map(r5), outNormal: nrm.map(r5), fill: hexOf(col), group: 'isekai:chips', doubleSided: true });
    }
  });
  return out;
}

/** The masses as the crown's dark core, a little inside the chips: its darkest stop, the next where the sun (`toSun`,
 *  `shadow`) reaches it, so what shows between the chips reads as depth, not as a hole. */
export function chipCore(masses, opts) {
  const o = { ...CHIP_DEFAULTS, ...opts }, squash = o.crown?.squash ?? 1, dark = hexOf(o.ramp[0]), lit = hexOf(o.ramp[Math.min(1, o.ramp.length - 1)]), out = [];
  for (const m of masses) for (const tri of blobTris(m.at, [m.r * o.shrink, m.r * o.shrink, m.r * o.shrink * squash], null, { detail: 1 })) {
    const cs = tri.p.map(P), n = unit(cross(sub(cs[1], cs[0]), sub(cs[2], cs[0]))), out1 = dot(n, sub(cs[0], m.at)) < 0 ? mul(n, -1) : n;
    const c = [(cs[0][0] + cs[1][0] + cs[2][0]) / 3, (cs[0][1] + cs[1][1] + cs[2][1]) / 3, (cs[0][2] + cs[1][2] + cs[2][2]) / 3];
    const sunlit = o.toSun && dot(out1, o.toSun) > 0.15 && (!o.shadow || o.shadow(add(c, mul(out1, 0.05)), out1) > 0.5);
    out.push({ corners: cs, normal: out1.map(r5), outNormal: out1.map(r5), fill: sunlit ? lit : dark, group: 'isekai:crown' });
  }
  return out;
}
