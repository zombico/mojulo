/**
 * crystal-faces — gems placed in a solid as exact polytopes (crystal-shine S5).
 *
 * A workbench `fields` term `{ op: 'add', shape: { kind: 'crystal', … } }` is not blended into the field: a crystal's
 * faces are its lattice's planes, so it is PLACED beside the field as an exact solid, and every face carries the
 * `crystal` tag the World page's crystal channel shades live (and the GLB exports as a transmissive material).
 *
 *   { kind: 'crystal', gem, center, size, cut?, axis?, spin?, unit?, cluster? }
 *     gem     one of crystal-optics' gems; size: its longest extent (world units); cut: natural | brilliant | cabochon
 *     axis    the direction its c axis points (default up); spin: degrees about it
 *     unit    what one world unit is ('cm' by default, like the workbench; 'm' | 'mm'), so colour-by-path is true
 *     glow    0–1: the stone shines in its own body colour, whatever its optics say (a game's glowing geode; a ruby
 *             glows by nature, any gem glows by this dial)
 *     cluster a seeded druse instead of one stone: { count, seed, on, lengths: [min, max], tilt, bury }
 *       on: { disc: { center, radius, normal? } } — a flat bed; or { ellipsoid: { center, radii, zMax? } } — the inner
 *           wall of a cavity, stones growing inward (a geode); lengths follow a power law (many small, a few large)
 *       avoid: [{ center, radius }] — clear a spot (for a hero stone, a path for light): a stone whose base falls inside
 *           is not placed, and every other stone stays exactly where it was
 */

import { crystalPolytope, crystalOptics, CRYSTAL_GEMS, CRYSTAL_CUTS } from './crystal-optics.js';
import { shadeHexMat } from './vexar.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const apply = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
const CM_PER = Object.freeze({ cm: 1, m: 100, mm: 0.1 });
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** The rotation whose third column is `z` (the c axis), spun `spin` degrees about it. */
function frameFor(z, spin = 0) {
  const c = unit(z); let x = unit(cross(Math.abs(c[2]) < 0.95 ? [0, 0, 1] : [1, 0, 0], c)); let y = cross(c, x);
  const a = (spin * Math.PI) / 180; const xs = add(scale(x, Math.cos(a)), scale(y, Math.sin(a))); y = cross(c, xs); x = xs;
  return [[x[0], y[0], c[0]], [x[1], y[1], c[1]], [x[2], y[2], c[2]]];
}
/** A polygon of any size → the World mesh's quads and triangles (a triangle padded as [a,b,c,c]). */
function lower(c) {
  if (c.length <= 4) return [c.length === 3 ? [...c, c[2]] : c];
  const out = []; let i = 1;
  while (i + 2 < c.length) { out.push([c[0], c[i], c[i + 1], c[i + 2]]); i += 2; }
  if (i + 1 < c.length) out.push([c[0], c[i], c[i + 1], c[i + 1]]);
  return out;
}

/** One stone's faces: posed, tagged, shaded for renderers that do not read the tag. */
function stoneFaces({ gem, cut, size, center, base, R, cmu, stone, group, light, glow }) {
  const p = crystalPolytope(gem, { size, cut }); const tint = crystalOptics(gem).tint;
  const V = p.vertices.map((v) => add(apply(R, v), center)); const r = Math.max(...p.vertices.map((v) => Math.hypot(v[0], v[1], v[2])));
  const tag = { gem, stone, c: center.map((x) => +x.toFixed(6)), r: +r.toFixed(6), axis: [R[0][2], R[1][2], R[2][2]].map((x) => +x.toFixed(6)), cmu, ...(base ? { base: base.map((x) => +x.toFixed(6)) } : {}), ...(glow ? { glow } : {}) };
  const out = [];
  p.faces.forEach((ix, i) => {
    const n = apply(R, p.normals[i]); const fill = shadeHexMat(tint, n, null, { light });
    for (const corners of lower(ix.map((k) => V[k]))) out.push({ corners, fill, doubleSided: true, outNormal: n, group, crystal: tag });
  });
  return out;
}

/** The placements of a crystal term: one stone, or a seeded cluster. */
export function crystalPlacements(shape) {
  if (!shape.cluster) { const R = frameFor(shape.axis || [0, 0, 1], shape.spin || 0); return [{ center: shape.center, size: shape.size, R, base: shape.center.map((x, i) => x - R[i][2] * shape.size * 0.5) }]; }
  const k = shape.cluster; const rnd = mulberry32(Number.isInteger(k.seed) ? k.seed : 1); const n = Math.max(1, Math.min(600, k.count | 0 || 12));
  const [lo, hi] = Array.isArray(k.lengths) ? k.lengths : [shape.size * 0.4, shape.size]; const tilt = ((k.tilt ?? 22) * Math.PI) / 180; const bury = k.bury ?? 0.3;
  const out = [];
  for (let i = 0; i < n; i++) {
    let base, normal;
    if (k.on && k.on.ellipsoid) {
      const e = k.on.ellipsoid; const zMax = Number.isFinite(e.zMax) ? e.zMax : Infinity; let tries = 0;
      do { const zf = 1 - 2 * ((i + rnd() * 0.5 + tries * 0.37) / n % 1), az = i * 2.39996323 + rnd() * 0.3 + tries; const ring = Math.sqrt(Math.max(0, 1 - zf * zf));
        const u = [ring * Math.cos(az), ring * Math.sin(az), zf]; base = add(e.center, [u[0] * e.radii[0], u[1] * e.radii[1], u[2] * e.radii[2]]); tries++; } while (base[2] > zMax && tries < 12);
      if (base[2] > zMax) continue;
      normal = unit([-(base[0] - e.center[0]) / e.radii[0] ** 2, -(base[1] - e.center[1]) / e.radii[1] ** 2, -(base[2] - e.center[2]) / e.radii[2] ** 2]);   // inward
    } else {
      const d = (k.on && k.on.disc) || { center: shape.center, radius: shape.size }; const nz = unit(d.normal || [0, 0, 1]);
      const tx = unit(cross(Math.abs(nz[2]) < 0.95 ? [0, 0, 1] : [1, 0, 0], nz)), ty = cross(nz, tx); const rr = d.radius * Math.sqrt(rnd()), a = 2 * Math.PI * rnd();
      base = add(d.center, add(scale(tx, rr * Math.cos(a)), scale(ty, rr * Math.sin(a)))); normal = nz;
    }
    const jitter = unit([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]); const axis = unit(add(normal, scale(unit(sub(jitter, scale(normal, dot(jitter, normal)))), Math.tan(tilt * rnd()))));
    const L = lo + (hi - lo) * Math.pow(rnd(), 3);                                    // a power law: many small, a few large
    const R = frameFor(axis, 360 * rnd());                                            // drawn before `avoid`, so a cleared spot moves nothing else
    if (Array.isArray(k.avoid) && k.avoid.some((a) => Math.hypot(base[0] - a.center[0], base[1] - a.center[1], base[2] - a.center[2]) < a.radius)) continue;
    out.push({ center: add(base, scale(axis, L * (0.5 - bury))), size: L, R, base });
  }
  return out;
}

/** A crystal term's faces. `index` makes stone ids unique across a solid's terms. */
export function crystalTermFaces(term, { light, index = 0 } = {}) {
  const s = term.shape; const gem = s.gem; const cut = s.cut || 'natural'; const cmu = CM_PER[s.unit || 'cm'];
  const glow = Number.isFinite(s.glow) && s.glow > 0 ? Math.min(1, s.glow) : 0;
  return crystalPlacements(s).flatMap((pl, i) => stoneFaces({ gem, cut, size: pl.size, center: pl.center, base: pl.base, R: pl.R, cmu, stone: `${term.id || 'crystal'}#${index}.${i}`, group: term.id || 'crystal', light, glow }));
}

/** Errors (strings) for a crystal shape; [] when it resolves. */
export function validateCrystalShape(s, at = 'crystal') {
  const e = []; const v3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  if (!CRYSTAL_GEMS.includes(s.gem)) e.push(`${at}.gem: one of ${CRYSTAL_GEMS.join(', ')}`);
  if (s.cut !== undefined && !CRYSTAL_CUTS.includes(s.cut)) e.push(`${at}.cut: one of ${CRYSTAL_CUTS.join(', ')}`);
  if (!(Number.isFinite(s.size) && s.size > 0)) e.push(`${at}.size: the stone's longest extent in world units, > 0`);
  if (!s.cluster && !v3(s.center)) e.push(`${at}.center: [x, y, z]`);
  if (s.axis !== undefined && !(v3(s.axis) && Math.hypot(...s.axis) > 0)) e.push(`${at}.axis: [x, y, z], the direction its c axis points`);
  if (s.glow !== undefined && !(Number.isFinite(s.glow) && s.glow >= 0 && s.glow <= 1)) e.push(`${at}.glow: 0–1, how strongly the stone shines in its own colour`);
  if (s.unit !== undefined && !(s.unit in CM_PER)) e.push(`${at}.unit: what one world unit is — 'cm' (the workbench default), 'm' or 'mm'`);
  if (s.cluster) {
    const k = s.cluster; const on = k.on || {};
    if (k.count !== undefined && !(Number.isInteger(k.count) && k.count >= 1 && k.count <= 600)) e.push(`${at}.cluster.count: an integer 1–600`);
    if (k.lengths !== undefined && !(Array.isArray(k.lengths) && k.lengths.length === 2 && k.lengths[0] > 0 && k.lengths[1] >= k.lengths[0])) e.push(`${at}.cluster.lengths: [min, max] world units, 0 < min ≤ max`);
    if (on.ellipsoid && !(v3(on.ellipsoid.center) && v3(on.ellipsoid.radii) && on.ellipsoid.radii.every((x) => x > 0))) e.push(`${at}.cluster.on.ellipsoid: { center: [x,y,z], radii: [a,b,c], zMax? } — the cavity the stones line`);
    if (on.disc && !(v3(on.disc.center) && Number.isFinite(on.disc.radius) && on.disc.radius > 0)) e.push(`${at}.cluster.on.disc: { center: [x,y,z], radius, normal? } — the bed the stones grow from`);
    if (k.avoid !== undefined && !(Array.isArray(k.avoid) && k.avoid.every((a) => a && v3(a.center) && Number.isFinite(a.radius) && a.radius > 0))) e.push(`${at}.cluster.avoid: [{ center: [x,y,z], radius }] — spots no stone grows in`);
    if (!on.ellipsoid && !on.disc && !v3(s.center)) e.push(`${at}.cluster.on: { disc } or { ellipsoid }, or give the shape a center (a disc of radius size)`);
  }
  return e;
}
