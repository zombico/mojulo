// construction/log — a synthetic log: the formation-time field of a stem, without growing the tree.
//
// vegetation/wood.js reads the field off a grown skeleton, which costs a growth run (18–46 s for a 25-year tree). A
// member needs only a log, and a log's wood is set by a few numbers, so this builds the field directly:
//   · the leader passes height z in year y0(z) = z / heightGrowth, so the stem at z carries age − y0 rings (the log
//     tapers because its upper sections are younger);
//   · ring n at height z is w(n, y) wide: a juvenile factor on the cambial age n (wide rings near the pith) times a
//     climate factor on the CALENDAR year y = y0 + n, so a dry year is a narrow ring at every height, as in a real stem;
//   · each year's sheath is a little out of round, drifting slowly so the sheaths nest (the wobble of wood.js), and the
//     pith wanders a few millimetres along the log;
//   · branches are cones from the pith, born the year the leader passed them. A live branch's wood runs to the bark;
//     a dead one stops growing and leaves a stub that later rings engulf, with a ring of bark around it (a loose knot).
//     Conifers carry whorls, one a year; hardwoods scatter them.
// Field: t(p) = the fractional calendar year the wood at p was laid (the min over trunk and branches, as in wood.js),
// plus the ring fraction, the heartwood share and what the point is (trunk, knot, bark inclusion, bark, air).
//
// Coordinates are metres in the log's frame: z up the log from the butt, the pith near x = y = 0. Deterministic in the
// spec: integer hashing only, no Math.random, no clock.
import { TIMBERS } from './timber.js';

// ─── dice: integer lattice hash → floats (the rock-fracture idiom) ──────────────────────────────────────────────────
function mix(n) { n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0; }
const hash3 = (a, b, c) => mix((Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0);
const hf = (h, n) => mix((h + Math.imul(n + 1, 0x9e3779b9)) | 0) / 4294967296;   // the n-th float of a hash

/** How many knots a log carries: branches per whorl (or per scattered site) and the years a branch lives. */
export const KNOT_GRADES = Object.freeze({
  clear: { per: [0, 0], live: 0 },
  few: { per: [1, 2], live: 5 },
  normal: { per: [3, 5], live: 10 },
  many: { per: [4, 6], live: 18 },
});

const DEFAULTS = { heightGrowth: 0.35, juvenile: 0.6, climate: 0.25, wobble: 0.018, ovality: 0.02, wander: 0.004, barkMm: 14, knots: 'normal', clearBelow: 0, spiral: 0 };

/** Why a log spec is invalid → string[] (empty when fine). */
export function validateLog(spec, at = 'log') {
  const e = [];
  const posNum = (k, lo, hi) => { if (spec[k] !== undefined && !(Number.isFinite(spec[k]) && spec[k] >= lo && spec[k] <= hi)) e.push(`${at}.${k}: must be a number in [${lo}, ${hi}]`); };
  if (!spec || typeof spec !== 'object') return [`${at}: must be an object`];
  posNum('age', 3, 600); posNum('ringMm', 0.4, 20); posNum('heightGrowth', 0.05, 2); posNum('clearBelow', 0, 40); posNum('spiral', -12, 12);
  if (spec.seed !== undefined && !Number.isInteger(spec.seed)) e.push(`${at}.seed: must be an integer`);
  if (spec.knots !== undefined && !KNOT_GRADES[spec.knots]) e.push(`${at}.knots: must be one of ${Object.keys(KNOT_GRADES).join(', ')}`);
  return e;
}

/**
 * makeLog({ species, age, length, ringMm?, heightGrowth?, knots?, clearBelow?, spiral?, seed? }) → the log:
 *   { sample(p) → { el, t, f, heart, rho, theta, ringW }, frame(p) → { L, R, T }, radiusAt(z, year?), pithAt(z), … }
 * `age` in years, `length` in metres (the field is defined for 0 ≤ z ≤ length).
 */
export function makeLog(spec) {
  const sp = TIMBERS[spec.species];
  if (!sp) throw new Error(`makeLog: unknown timber '${spec.species}'`);
  const o = { ...DEFAULTS, ...spec };
  const seed = Number.isInteger(o.seed) ? o.seed : 1;
  const age = Math.round(o.age);
  const length = Math.max(0.1, +o.length || 4);
  const hG = o.heightGrowth;
  const ringM = (Number.isFinite(o.ringMm) ? o.ringMm : sp.ringMm) / 1000;

  // ring widths: juvenile (cambial age) × climate (calendar year)
  const clim = new Float64Array(age + 2);
  for (let y = 0; y < clim.length; y++) clim[y] = 1 + o.climate * (2 * hf(hash3(seed, y, 11), 0) - 1);
  const juv = (n) => 1 + o.juvenile * Math.exp(-n / 6);
  // cumulative radius tables, one per year of height growth: R[i][Y] = the radius at z_i = i·hG after calendar year Y
  const nz = Math.min(age, Math.ceil(length / hG) + 1) + 1;
  const R = [];
  for (let i = 0; i < nz; i++) {
    const row = new Float64Array(age + 1);
    for (let Y = i + 1; Y <= age; Y++) row[Y] = row[Y - 1] + ringM * juv(Y - 1 - i) * clim[Y - 1];
    R.push(row);
  }
  /** The (unwobbled) radius at height z after calendar year Y (may be fractional in z). */
  function radius(Y, z) {
    const u = Math.max(0, z / hG); const i = Math.min(nz - 2, Math.floor(u)); const a = u - i;
    const r0 = R[i][Y], r1 = R[Math.min(nz - 1, i + 1)][Y];
    return r0 + (r1 - r0) * a;
  }
  // each sheath a little out of round, drifting slowly with the year (so the sheaths nest), plus a fixed ovality
  const ph = [hf(hash3(seed, 3, 1), 0), hf(hash3(seed, 3, 2), 0), hf(hash3(seed, 3, 3), 0)].map((v) => v * 2 * Math.PI);
  const wob = (Y, th) => 1 + o.wobble * (Math.sin(3 * th + 0.23 * Y + ph[0]) * 0.6 + Math.sin(5 * th - 0.31 * Y + ph[1]) * 0.4) + o.ovality * Math.cos(2 * (th - ph[2]));
  const pithAt = (z) => [o.wander * Math.sin(0.9 * z + ph[0]), o.wander * Math.sin(0.7 * z + ph[1])];

  // ── branches (knots) ──
  const grade = KNOT_GRADES[o.knots];
  const branches = [];
  if (grade.live > 0) {
    const sites = [];
    if (sp.whorled) for (let i = 0; (i + 0.5) * hG < length; i++) sites.push({ z: (i + 0.3 + 0.4 * hf(hash3(seed, i, 21), 0)) * hG, key: i });
    else for (let i = 0; (i + 0.5) * 0.9 < length; i++) sites.push({ z: (i + 0.2 + 0.6 * hf(hash3(seed, i, 23), 0)) * 0.9, key: i });
    for (const s of sites) {
      const h = hash3(seed, s.key, 31);
      const n = grade.per[0] + Math.floor(hf(h, 0) * (grade.per[1] - grade.per[0] + 1));
      const born = s.z / hG;
      if (born >= age - 1) continue;
      const live = s.z < o.clearBelow ? 2 : grade.live;
      const az0 = hf(h, 1) * 2 * Math.PI;
      for (let k = 0; k < n; k++) {
        const hk = hash3(seed, s.key, 40 + k);
        const az = sp.whorled ? az0 + (2 * Math.PI * (k + 0.25 * (hf(hk, 0) - 0.5))) / n : hf(hk, 0) * 2 * Math.PI;
        const el = ((sp.whorled ? 35 : 45) + 20 * (hf(hk, 1) - 0.5)) * (Math.PI / 180);
        const dir = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
        const kb = (1.4 + 1.2 * hf(hk, 2)) / 1000;                      // branch radius growth, m/yr
        const years = Math.min(live, age - born);
        const rEnd = Math.min(0.028, kb * years);
        const died = born + live;
        const dead = died < age;
        const sMax = dead ? radius(Math.ceil(died), s.z) + 0.03 : Infinity;   // a stub 3 cm past the stem at death
        const pz = s.z; const pp = pithAt(pz);
        branches.push({ z: pz, origin: [pp[0], pp[1], pz], dir, kb, rEnd, born, died, dead, sMax });
      }
    }
    branches.sort((a, b) => a.z - b.z);
  }
  const barkM = o.barkMm / 1000;
  const sapM = sp.sapMm == null ? null : sp.sapMm / 1000;

  /** The trunk's own reading at p (no branches). */
  function trunk(p) {
    const z = Math.max(0, Math.min(length, p[2]));
    const pc = pithAt(z); const dx = p[0] - pc[0], dy = p[1] - pc[1];
    const rho = Math.hypot(dx, dy), theta = Math.atan2(dy, dx);
    const y0 = z / hG;
    const Rz = (Y) => radius(Y, z) * wob(Y, theta);
    const outer = Rz(age);
    if (rho >= outer) return { el: rho < outer + barkM ? 'bark' : 'air', rho, theta, t: Infinity, outer };
    // the calendar year whose sheath first reaches rho: binary search over Y in (y0, age]
    let lo = Math.max(0, Math.floor(y0)), hi = age;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (Rz(mid) > rho) hi = mid; else lo = mid; }
    const r0 = Rz(lo), r1 = Rz(hi);
    const f = r1 > r0 ? Math.max(0, Math.min(1, (rho - r0) / (r1 - r0))) : 0;
    const heart = sapM == null ? 0 : Math.max(0, Math.min(1, (outer - sapM - rho) / 0.003 + 0.5));
    return { el: rho < 0.0015 ? 'pith' : 'trunk', rho, theta, t: lo + f, f, heart, ringW: r1 - r0, outer };
  }

  /** The log's reading at p: the trunk, unless a branch laid the wood there first. */
  function sample(p) {
    const tr = trunk(p);
    if (!branches.length || tr.el === 'air') return tr;
    let best = tr;
    // branches whose base lies within half a metre of p's height (a branch leaves the pith at 35–45°, so its wood
    // inside a stem of radius < 0.5 m stays within that band)
    let lo = 0, hi = branches.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (branches[m].z < p[2] - 0.5) lo = m + 1; else hi = m; }
    for (let i = lo; i < branches.length && branches[i].z <= p[2] + 0.05; i++) {
      const b = branches[i];
      const q = [p[0] - b.origin[0], p[1] - b.origin[1], p[2] - b.origin[2]];
      const s = q[0] * b.dir[0] + q[1] * b.dir[1] + q[2] * b.dir[2];
      if (s < 0 || s > b.sMax) continue;
      const d = Math.hypot(q[0] - s * b.dir[0], q[1] - s * b.dir[1], q[2] - s * b.dir[2]);
      if (d < b.rEnd) {
        const tb = b.born + d / b.kb;
        if (tb < best.t) { const f = (d / b.kb) % 1; best = { ...tr, el: 'knot', t: tb, f, heart: tr.heart, ringW: b.kb }; }
      } else if (b.dead && d < b.rEnd + 0.0018 && tr.el === 'trunk' && tr.t > b.died) {
        best = { ...tr, el: 'inclusion' };                              // the bark the dead stub wore, engulfed
      }
    }
    return best;
  }

  /** The grain frame at p: L along the fibres (the log axis, leaned by the spiral grain), R out from the pith, T round. */
  function frame(p) {
    const pc = pithAt(Math.max(0, Math.min(length, p[2]))); const dx = p[0] - pc[0], dy = p[1] - pc[1];
    const r = Math.hypot(dx, dy) || 1; const Rv = [dx / r, dy / r, 0]; const Tv = [-Rv[1], Rv[0], 0];
    const g = (o.spiral * Math.PI) / 180;
    return { L: [Tv[0] * Math.sin(g), Tv[1] * Math.sin(g), Math.cos(g)], R: Rv, T: Tv };
  }

  return {
    species: spec.species, age, length, seed, ringMm: ringM * 1000, heightGrowth: hG, knots: o.knots, branches,
    sample, frame, pithAt,
    /** The outer radius of the wood at height z (the log's under-bark radius, wobble averaged out). */
    radiusAt: (z, Y = age) => radius(Y, Math.max(0, Math.min(length, z))),
  };
}

/**
 * The age a log needs so its wood, at height `zTop`, reaches `rNeeded` metres (under bark) — the smallest integer age,
 * for a species' ring width (or `ringMm`). Used to size a log to the member cut from it.
 */
export function ageForRadius(species, rNeeded, zTop, { ringMm, heightGrowth = DEFAULTS.heightGrowth } = {}) {
  const sp = TIMBERS[species];
  const w = (Number.isFinite(ringMm) ? ringMm : sp.ringMm) / 1000;
  const y0 = Math.ceil(zTop / heightGrowth);
  let r = 0, n = 0;
  // mean climate is 1; the wobble and ovality can take ~4% off one side, so size with a margin
  while (r < rNeeded * 1.06 && n < 2000) { r += w * (1 + DEFAULTS.juvenile * Math.exp(-n / 6)) * (1 - DEFAULTS.climate * 0.5); n++; }
  return y0 + n;
}
