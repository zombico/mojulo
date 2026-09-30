// construction/figure — what a cut face of a log shows, as a colour RELATIVE to the species' base colour.
//
// The figure is the log field seen through a plane: rings from the formation time, the latewood band (conifers) or the
// earlywood pore band (ring-porous hardwoods), heartwood, knots with their own rings, the pith, bark on a waney edge,
// and the broad rays that give quarter-sawn oak its fleck. It is stored relative to the base colour (≤ 1 per channel),
// so the member's tint (species × finish, timber.js memberColor) multiplies over it in the renderer: a stain recolours
// the member and the figure stays the same bytes.
//
// Filtering, per pixel, from the field itself: the formation time is sampled a pixel along each face axis, so the
// rings a pixel spans are measured on THIS plane (a flat-sawn face's cathedral stretches them; an end-grain face packs
// them near the pith). Past about a ring a pixel they fade to their mean, as the rock grain does; rays are box-filtered
// by their width against the pixel's footprint. No supersampling.
//
// Rays are radial sheets: at fixed angles round the pith (spaced so they sit `rayGapMm` apart at mid-radius), each a
// stack of short ribbons up the log. A plane through the pith cuts them edge-on over long runs (the fleck); a plane
// across the rings meets them as short lines.
import { TIMBERS, ratioTo } from './timber.js';
import * as dmath from '../../util/dmath.js';

function mix(n) { n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0; }
const hash3 = (a, b, c) => mix((Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0);
const hf = (h, n) => mix((h + Math.imul(n + 1, 0x9e3779b9)) | 0) / 4294967296;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Luminance within one ring, f ∈ [0,1) from earlywood to latewood: the latewood band and the earlywood pore band. */
export function ringLuminance(sp, f) {
  const lateStart = 1 - sp.lateShare;
  const late = sp.late * smooth(lateStart - 0.06, lateStart + 0.04, f);
  const pores = sp.pores ? sp.pores * (1 - smooth(0.1, 0.2, f)) : 0;
  return 1 - late - pores;
}
/**
 * ringLuminance box-filtered over a pixel that spans `perPx` rings, centred at f: the pore band and a thin latewood
 * band are often narrower than a pixel, and point-sampling them strobes (dashes on a quarter-sawn face). Past a ring a
 * pixel it is the ring's mean.
 */
export function ringFiltered(sp, f, perPx) {
  if (perPx >= 1) return ringMean(sp);
  const n = Math.min(16, 1 + Math.ceil(perPx * 40));
  if (n === 1) return ringLuminance(sp, f);
  let s = 0;
  for (let i = 0; i < n; i++) { const g = f + perPx * ((i + 0.5) / n - 0.5); s += ringLuminance(sp, g - Math.floor(g)); }
  return s / n;
}
/** The mean of ringLuminance over a ring: the colour the rings fade to when a pixel holds several. */
const MEANS = new Map();
export function ringMean(sp) {
  if (MEANS.has(sp)) return MEANS.get(sp);
  let s = 0; const n = 64;
  for (let i = 0; i < n; i++) s += ringLuminance(sp, (i + 0.5) / n);
  MEANS.set(sp, s / n); return s / n;
}

const RATIO_CACHE = new Map();
function ratios(species) {
  if (RATIO_CACHE.has(species)) return RATIO_CACHE.get(species);
  const sp = TIMBERS[species];
  const r = {
    heart: ratioTo(sp.heart, sp.base),
    bark: ratioTo(sp.bark, sp.base),
    knot: [0.7, 0.6, 0.5],
    inclusion: ratioTo([58, 48, 40], sp.base),
    pith: [0.66, 0.56, 0.46],
    mean: ringMean(sp),
  };
  RATIO_CACHE.set(species, r); return r;
}

/**
 * A ray field for a log: `at(sample, z) → { d, w }` — the tangential distance (m) from the nearest ray sheet at this
 * point, and the sheet's width there (0 where no ribbon stands). A ribbon is lens-shaped up the log (full width at its
 * middle, tapering to its top and bottom) and its sheet waves a millimetre or so as it runs out from the pith, so a
 * quarter-sawn face meets it in irregular flecks rather than straight bars. Null for a species without broad rays.
 */
export function rayField(log) {
  const sp = TIMBERS[log.species];
  if (!sp.ray) return null;
  const rMid = Math.max(0.02, log.radiusAt(log.length / 2));
  const dTheta = (sp.rayGapMm / 1000) / rMid;
  const count = Math.max(8, Math.round((2 * Math.PI) / dTheta));
  const step = (2 * Math.PI) / count;
  const w0 = sp.rayMm / 1000;
  return {
    at(s, z) {
      const u = (s.theta + Math.PI) / step; const k0 = Math.floor(u);
      let best = { d: Infinity, w: 0 };
      for (const k of [k0 - 1, k0, k0 + 1]) {
        const kk = ((k % count) + count) % count; const h = hash3(log.seed, kk, 77);
        const thK = -Math.PI + (k + 0.5 + 0.6 * (hf(h, 0) - 0.5)) * step;
        // ribbons up the log: 12–60 mm tall, about two in three present, lens-shaped
        const H = (12 + 48 * hf(h, 1)) / 1000; const zz = z + hf(h, 2) * H; const j = Math.floor(zz / H);
        if (hf(hash3(log.seed, kk, 1000 + j), 0) > 0.66) continue;
        const e = 2 * (zz / H - j) - 1; const w = w0 * Math.sqrt(Math.max(0, 1 - e * e));
        const wave = 0.0012 * dmath.sin((2 * Math.PI * s.rho) / (0.018 + 0.02 * hf(h, 3)) + 6.28 * hf(hash3(log.seed, kk, 2000 + j), 1));
        const d = s.rho * (s.theta - thK) + wave;
        if (Math.abs(d) < Math.abs(best.d)) best = { d, w };
      }
      return best;
    },
  };
}

/**
 * The figure at log point p on a face whose pixel steps are the vectors du, dv (m) → [r, g, b] relative to the base
 * colour (each ≤ 1). `rays` is rayField(log) (or null).
 */
export function figureAt(log, rays, p, du, dv) {
  const sp = TIMBERS[log.species];
  const R = ratios(log.species);
  const s = log.sample(p);
  if (s.el === 'air') return R.bark;                                        // past the bark: draw it as bark
  if (s.el === 'bark') return R.bark;
  if (s.el === 'inclusion') return R.inclusion;
  if (s.el === 'pith') return R.pith;
  // rings a pixel spans on THIS plane, from the formation time one pixel along each axis
  const su = log.sample([p[0] + du[0], p[1] + du[1], p[2] + du[2]]);
  const sv = log.sample([p[0] + dv[0], p[1] + dv[1], p[2] + dv[2]]);
  const dt = (q) => (Number.isFinite(q.t) && q.el === s.el ? Math.abs(q.t - s.t) : 0);
  const perPx = Math.max(dt(su), dt(sv));
  let L = ringFiltered(sp, s.f, perPx);
  // rays: box-filter the sheet's width against the pixel's tangential footprint
  if (rays && s.el === 'trunk') {
    const r = rays.at(s, p[2]);
    if (r.w > 0) {
      const tan = (q) => (Number.isFinite(q.rho) ? q.rho * q.theta : 0);
      const foot = Math.max(1e-5, Math.abs(tan(su) - tan(s)) + Math.abs(tan(sv) - tan(s)));
      const lo = Math.max(r.d - foot / 2, -r.w / 2), hi = Math.min(r.d + foot / 2, r.w / 2);
      const cover = clamp01((hi - lo) / foot);
      L += (1 - L) * sp.ray * cover;
    }
  }
  L = Math.min(1, L);
  let c = [L, L, L];
  if (s.el === 'knot') c = c.map((v, i) => v * R.knot[i]);
  else if (s.heart > 0) c = c.map((v, i) => v * (1 + (R.heart[i] - 1) * s.heart));
  return c;
}

/**
 * Bake one face: the plane origin + u·a + v·b (a, b unit vectors in log metres, `w` × `h` metres) at `nu` × `nv`
 * pixels → an RGB byte buffer, row 0 at v = h (the top of the image is the far edge along b, uv's convention:
 * uv (0,0) is the image's bottom-left).
 */
export function bakeFigure(log, { origin, a, b, w, h, nu, nv }) {
  const rays = rayField(log);
  const rgb = Buffer.alloc(nu * nv * 3);
  const pu = w / nu, pv = h / nv;
  const du = a.map((x) => x * pu), dv = b.map((x) => x * pv);
  for (let j = 0; j < nv; j++) {
    const v = h - (j + 0.5) * pv;
    for (let i = 0; i < nu; i++) {
      const u = (i + 0.5) * pu;
      const p = [origin[0] + a[0] * u + b[0] * v, origin[1] + a[1] * u + b[1] * v, origin[2] + a[2] * u + b[2] * v];
      const c = figureAt(log, rays, p, du, dv);
      const k = (j * nu + i) * 3;
      rgb[k] = Math.round(255 * c[0]); rgb[k + 1] = Math.round(255 * c[1]); rgb[k + 2] = Math.round(255 * c[2]);
    }
  }
  return rgb;
}

/** The colour the figure averages to (relative to base): what a far or untextured face is drawn in. */
export function figureMean(species) {
  const R = ratios(species); const sp = TIMBERS[species];
  // heartwood covers most of a boxed-heart section; weight it by a typical share
  const heartShare = sp.sapMm == null ? 0 : 0.6;
  return R.heart.map((hc) => R.mean * (1 + (hc - 1) * heartShare));
}
