// construction/rebar — the cage inside a concrete member: longitudinal bars, stirrups or ties, or a slab's mesh.
//
// A concrete member (frame.js, material 'concrete') carries `rebar` in millimetres:
//   { top?: [n, bar], bottom?: [n, bar], sides?: [n, bar], ring?: [n, bar], ties?: [bar, spacing],
//     mesh?: [bar, spacing], cover?: mm, finish? }        (`bar` is ⌀ in mm or a size: 16, '#5' …)
// Left out, a member gets the cage its shape asks for: a column (standing) a ring of 4 ⌀16 (8 when its least side is
// 400 mm or more) with ⌀8 ties at 12 bar diameters; a slab strip (three times wider than deep) a ⌀12 mesh at 200 in
// the bottom (both faces when 200 mm deep or more); a beam or footing 3 ⌀16 in the bottom, 2 ⌀12 in the top and ⌀8
// stirrups at 200. Cover defaults to 40 mm (75 mm for a member touching the ground). `rebar: false` leaves it plain.
// Bars stop at the cover; stirrups sit outside the bars, the bars inside their corners. No hooks or laps are drawn.
import { barMm, STEEL } from './sections.js';
import { prismPolys, ngon } from './prims.js';
import * as dmath from '../../util/dmath.js';

const MM = 0.001;

/** Why a rebar spec is invalid → string[]. */
export function validateRebar(r, at) {
  if (r === undefined || r === false || r === true) return [];
  if (!r || typeof r !== 'object') return [`${at}: an object { top, bottom, ring, ties, mesh, cover }, true, or false`];
  const e = [];
  for (const k of ['top', 'bottom', 'sides', 'ring']) {
    if (r[k] === undefined) continue;
    if (!(Array.isArray(r[k]) && r[k].length === 2 && Number.isInteger(r[k][0]) && r[k][0] >= 0 && barMm(r[k][1]))) e.push(`${at}.${k}: [count, bar] — e.g. [3, 16] or [2, '#5']`);
  }
  for (const k of ['ties', 'mesh']) {
    if (r[k] === undefined) continue;
    if (!(Array.isArray(r[k]) && r[k].length === 2 && barMm(r[k][0]) && Number.isFinite(r[k][1]) && r[k][1] >= 50)) e.push(`${at}.${k}: [bar, spacing mm ≥ 50] — e.g. [8, 200]`);
  }
  if (r.cover !== undefined && !(Number.isFinite(r.cover) && r.cover >= 10 && r.cover <= 150)) e.push(`${at}.cover: mm, 10–150`);
  return e;
}

/** The cage a member gets when its spec leaves it out (see the header). */
export function defaultCage(M, grounded) {
  const standing = Math.abs(M.F.ex[2]) > 0.9;
  const thin = Math.min(M.W, M.D), wide = Math.max(M.W, M.D);
  if (standing) return { ring: [thin >= 0.4 ? 8 : 4, 16], ties: [8, Math.min(192, thin * 1000)], cover: 40 };
  if (wide >= 3 * thin && thin <= 0.3) return { mesh: [12, 200], ...(thin >= 0.2 ? { top: [0, 12] } : {}), cover: grounded ? 75 : 30, both: thin >= 0.2 };
  return { bottom: [3, 16], top: [2, 12], ties: [8, 200], cover: grounded ? 75 : 40 };
}

/**
 * The cage of member M (local metres) → { polys: [{ corners, n }], summary }. `spec` is the member's rebar (or the
 * default). The summary carries the bottom steel area (for the capacity check), the effective depth and the bar mass.
 */
export function cage(M, spec) {
  const c = (spec.cover ?? 40) * MM;
  const x0 = M.xMin + c, x1 = M.xMax - c;
  const hy = M.W / 2, hz = M.D / 2;
  const polys = []; let mass = 0; let bars = 0, loops = 0;
  const bar = (from, to, d) => { polys.push(...prismPolys(from, to, ngon([to[0] - from[0], to[1] - from[1], to[2] - from[2]], d / 2, 8))); mass += (Math.PI * d * d / 4) * dmath.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) * STEEL.density; bars++; };
  const tie = spec.ties ? barMm(spec.ties[0]) * MM : 0;
  // the stirrup's centreline rectangle, and the bars' inset
  const sy = hy - c - tie / 2, sz = hz - c - tie / 2;
  const inset = (d) => c + tie + d / 2;
  const row = (n, d, z) => {
    if (n <= 0) return;
    const y0 = -hy + inset(d), y1 = hy - inset(d);
    for (let i = 0; i < n; i++) { const y = n === 1 ? 0 : y0 + ((y1 - y0) * i) / (n - 1); bar([x0, y, z], [x1, y, z], d); }
  };
  let As = 0, dEff = M.D - c;
  if (spec.bottom) { const d = barMm(spec.bottom[1]) * MM; row(spec.bottom[0], d, -hz + inset(d)); As = spec.bottom[0] * Math.PI * d * d / 4; dEff = M.D - inset(d); }
  if (spec.top) { const d = barMm(spec.top[1]) * MM; row(spec.top[0], d, hz - inset(d)); }
  if (spec.sides && spec.sides[0] > 0) {
    const d = barMm(spec.sides[1]) * MM; const n = spec.sides[0];
    for (let i = 1; i <= n; i++) { const z = -hz + inset(d) + ((M.D - 2 * inset(d)) * i) / (n + 1); for (const y of [-hy + inset(d), hy - inset(d)]) bar([x0, y, z], [x1, y, z], d); }
  }
  if (spec.ring) {
    const d = barMm(spec.ring[1]) * MM; const n = Math.max(4, spec.ring[0]);
    const ry = hy - inset(d), rz = hz - inset(d);
    // corners first, then the rest spread round the perimeter
    const per = 2 * (2 * ry + 2 * rz); const pts = [];
    for (let i = 0; i < n; i++) {
      let s = (per * i) / n;
      const legs = [[2 * ry, (t) => [-ry + t, -rz]], [2 * rz, (t) => [ry, -rz + t]], [2 * ry, (t) => [ry - t, rz]], [2 * rz, (t) => [-ry, rz - t]]];
      for (const [L, f] of legs) { if (s <= L) { pts.push(f(s)); break; } s -= L; }
    }
    for (const [y, z] of pts) bar([x0, y, z], [x1, y, z], d);
    As = (Math.ceil(n / 4) + 1) * Math.PI * d * d / 4;                 // one face's bars (nominal: a column is not checked in bending)
  }
  if (spec.ties) {
    const s = spec.ties[1] * MM;
    const count = Math.max(2, Math.floor((x1 - x0) / s) + 1);
    const step = (x1 - x0) / (count - 1);
    for (let k = 0; k < count; k++) {
      const x = x0 + k * step; const h = tie / 2;
      const sq = (a, b) => polys.push(...prismPolys(a, b, ngon([b[0] - a[0], b[1] - a[1], b[2] - a[2]], h * Math.SQRT2, 4)));
      // four legs of the loop, each a square bar (the ring's corners overlap)
      for (const [a, b] of [[[x, -sy - h, -sz], [x, sy + h, -sz]], [[x, -sy - h, sz], [x, sy + h, sz]], [[x, -sy, -sz - h], [x, -sy, sz + h]], [[x, sy, -sz - h], [x, sy, sz + h]]]) sq(a, b);
      mass += tie * tie * (2 * (2 * sy + 2 * sz)) * STEEL.density; loops++;
    }
  }
  if (spec.mesh) {
    const d = barMm(spec.mesh[0]) * MM; const s = spec.mesh[1] * MM;
    const layers = spec.both ? [-hz + c + d / 2, hz - c - 1.5 * d] : [-hz + c + d / 2];
    for (const z of layers) {
      for (let y = -hy + c + d / 2; y <= hy - c - d / 2 + 1e-9; y += s) bar([x0, y, z], [x1, y, z], d);
      for (let x = x0; x <= x1 + 1e-9; x += s) bar([x, -hy + c, z + d], [x, hy - c, z + d], d);
    }
    As = (M.W / s) * Math.PI * d * d / 4;
    dEff = M.D - c - d / 2;
  }
  return { polys, summary: { bars, ties: loops, massKg: Math.round(mass * 10) / 10, AsMm2: Math.round(As * 1e6), dEffMm: Math.round(dEff * 1000), coverMm: Math.round(c * 1000) } };
}
