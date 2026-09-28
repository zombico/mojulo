/**
 * rock-fracture — a rock as three layers with three scale laws (rock-formation.plan.md R2):
 *
 *   lattice  → a set of cleavage ANGLES, no size          (rock-minerals.js, rotated per grain)
 *   grains   → ONE length: a seeded Voronoi of nucleation sites; each grain a mineral by modal share and an
 *              orientation, random or aligned by a fabric (slate's mica)
 *   fracture → ONE exponent: a BLOCK of big planar fractures (the ones that released the fragment), then `octaves` of
 *              chips at halving scales. Chips seek edges and corners (tested ON the surface: inside, an SDF of
 *              intersected planes has medial-axis ridges that only look like edges), break along the cleavage of the
 *              grain at their seed or conchoidally (a shallow scallop, edges only) where it has none, and cut to a
 *              depth that follows a Hurst law. Above `joints.above` metres, joint sets can take over.
 *
 * The result is a signed-distance field (negative inside) with bounds, a grain colour function filtered to a
 * footprint, and the block as an exact convex polytope (`blockPolytope`) for the far level of detail.
 *
 * Why these rules (each was a failure in the spike): cell-confined chips left paper-thin fins, so chips are
 * ball-bounded and overlap; block-sized scallops made craters, so big breaks are planar at every size; aligned rocks
 * lost their body to opposite cuts sharing one normal, so a core guard keeps every block plane ≥ 0.4 of the extent
 * out; chips on flat faces bored round pits, so flat faces take none.
 *
 * Pure: integer hashing and a local mulberry32, no Math.random, no clock. Imports only rock-minerals.js, so the pair
 * can ride a recipe-book builder unchanged. Same spec → the same field, forever.
 */
import { MINERALS, cleavageNormals, resolveRock } from './rock-minerals.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const apply = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];

// ─── dice: integer lattice hash → floats; mulberry32 for longer streams ─────────────────────────────────────
function mix(n) { n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0; }
const hash4 = (a, b, c, d) => mix((Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177) + Math.imul(d, 2246822519)) | 0);
const hf = (h, n) => mix((h + Math.imul(n + 1, 0x9e3779b9)) | 0) / 4294967296;   // the n-th float of a hash
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function randomRotation(r) {                                   // Shoemake: uniform on SO(3); columns = crystal axes in world
  const u1 = r(), u2 = r(), u3 = r(); const s1 = Math.sqrt(1 - u1), s2 = Math.sqrt(u1);
  const x = s1 * Math.sin(2 * Math.PI * u2), y = s1 * Math.cos(2 * Math.PI * u2), z = s2 * Math.sin(2 * Math.PI * u3), w = s2 * Math.cos(2 * Math.PI * u3);
  return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
}
function rotationTaking(zTo, spin) {                           // third column = zTo, spun about it
  const f = unit(zTo); const t = Math.abs(f[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; let e1 = unit(cross(t, f)); let e2 = cross(f, e1);
  const cs = Math.cos(spin), sn = Math.sin(spin); [e1, e2] = [add(scale(e1, cs), scale(e2, sn)), add(scale(e1, -sn), scale(e2, cs))];
  return [[e1[0], e2[0], f[0]], [e1[1], e2[1], f[1]], [e1[2], e2[2], f[2]]];
}
function tilt(v, deg, r) { const a = unit([r() - 0.5, r() - 0.5, r() - 0.5]); return unit(add(v, scale(unit(cross(v, a)), Math.tan(deg * Math.PI / 180) * (r() * 2 - 1)))); }
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (c) => `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;

export const ROCK_UNITS = Object.freeze({ m: 1, cm: 100, mm: 1000 });   // world units per metre
export const ROCK_DEFAULTS = Object.freeze({ unit: 'cm', seed: 1, octaves: 4, hurst: 0.8, alpha: 0.3, aspect: [1, 0.8, 0.66], blockPlanes: 13, depthCap: 0.35, edgeChip: 0.7, edgeDeg: 18, color: 'grain' });
const L0_FRACTION = 0.45;

/**
 * rockField(spec) → { d(p), bounds, colorAt(p, footprint), meanColor, blockPolytope(), meta }
 * spec: { size (the longest extent), rock (preset | { modes, grain, fabric?, colors? }), unit? ('cm' default, 'm',
 *         'mm': what one world unit is, so the rock's grain — stored in metres — lands at its true size), center?, seed?,
 *         octaves?, hurst?, alpha?, aspect?, blockPlanes?, grain? (world units, overrides the rock's), joints? { above
 *         (world units), prob? }, color? }
 * Points are [x, y, z] in world units.
 */
export function rockField(spec) {
  const o = { ...ROCK_DEFAULTS, ...spec };
  const S = o.size; const rock = resolveRock(o.rock); const g = Number.isFinite(o.grain) && o.grain > 0 ? o.grain : rock.grain * ROCK_UNITS[o.unit];
  const center = o.center || [0, 0, 0]; const seed = o.seed | 0;
  const cleav = Object.fromEntries(rock.modes.map(([m]) => [m, cleavageNormals(m)]));
  const cum = []; let acc = 0; for (const [m, f] of rock.modes) { acc += f; cum.push([m, acc]); }
  const toneOf = (m) => hexRgb(rock.colors?.[m] ?? MINERALS[m].color);
  const mean = [0, 1, 2].map((k) => rock.modes.reduce((s, [m, f]) => s + f * toneOf(m)[k], 0) / acc);

  // grains: a jittered-grid Voronoi; seed points by pure hash, props only for the winner
  const gSalt = seed * 31 + 7;
  const grainSeed = (i, j, k) => { const h = hash4(i, j, k, gSalt); return [(i + 0.1 + 0.8 * hf(h, 0)) * g, (j + 0.1 + 0.8 * hf(h, 1)) * g, (k + 0.1 + 0.8 * hf(h, 2)) * g]; };
  const grainProps = (i, j, k) => {
    const r = mulberry32(hash4(i, j, k, gSalt + 1)); const pick = r() * acc; const mineral = cum.find(([, a]) => pick <= a)[0];
    const Q = rock.fabric ? rotationTaking(tilt(unit(rock.fabric.normal), rock.fabric.scatterDeg ?? 8, r), r() * 2 * Math.PI) : randomRotation(r);
    return { mineral, Q, shade: 0.93 + 0.14 * r() };
  };
  const grainAt = (q) => {                                     // q local
    const i0 = Math.floor(q[0] / g), j0 = Math.floor(q[1] / g), k0 = Math.floor(q[2] / g); let best = null, bd = Infinity;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) {
      const c = grainSeed(i0 + a, j0 + b, k0 + e); const d = (c[0] - q[0]) ** 2 + (c[1] - q[1]) ** 2 + (c[2] - q[2]) ** 2; if (d < bd) { bd = d; best = [i0 + a, j0 + b, k0 + e]; }
    }
    return grainProps(...best);
  };

  // base: an ellipsoid (a bound with the right sign, like field-terms' ellipsoid)
  const rad = o.aspect.map((a) => (a * S) / 2);
  const ellipsoid = (q) => { const k0 = Math.hypot(q[0] / rad[0], q[1] / rad[1], q[2] / rad[2]); const k1 = Math.hypot(q[0] / rad[0] ** 2, q[1] / rad[1] ** 2, q[2] / rad[2] ** 2); return (k0 * (k0 - 1)) / (k1 || 1e-12); };
  const L0 = L0_FRACTION * S; const Ls = [...Array(o.octaves + 1)].map((_, k) => L0 / 2 ** k);   // Ls[0] the block, Ls[1..] chips
  const budget = Ls.map((L) => Math.min(o.alpha * L0 * (L / L0) ** o.hurst, o.depthCap * L));
  const reach = budget.slice(1).reduce((s, x) => s + x, 0) + 0.3 * S;
  const jr = mulberry32(hash4(seed, 97, 5, 3)); const JOINTS = [[1, 0, 0], [0, 1, 0]].map((v) => tilt(v, 6, jr));

  function breakAt(c, u, L, r) {                               // joints (above `joints.above`), else cleavage, else conchoidal
    const G = grainAt(c); let n = null, kind = 'plane';
    if (o.joints && L >= o.joints.above && r() < (o.joints.prob ?? 0.6)) {
      const pj = r(); n = pj < 0.34 ? u : JOINTS[pj < 0.67 ? 0 : 1]; if (dot(n, u) < 0) n = scale(n, -1); if (dot(n, u) < 0.25) n = null;
      if (n) kind = pj < 0.34 ? 'sheet' : 'plane';
    }
    if (!n) {
      let best = -1;
      for (const cv of cleav[G.mineral]) { if (!(r() < cv.q)) continue; const w = apply(G.Q, cv.n); const d = Math.abs(dot(w, u)); if (d > best) { best = d; n = dot(w, u) < 0 ? scale(w, -1) : w; } }
      if (best < 0.15) n = null;
    }
    if (!n) { kind = 'scallop'; n = tilt(u, 30, r); }
    return { n, kind, mineral: G.mineral };
  }

  // the block: global planes around the base, with the core guard
  const block = [];
  if (o.blockPlanes > 0) {
    const r = mulberry32(hash4(seed, 17, 29, 3)); const N = o.blockPlanes;
    for (let i = 0; i < N; i++) {
      const zf = 1 - (2 * (i + 0.5)) / N, az = i * 2.39996 + r() * 0.6;
      const dir = unit([Math.sqrt(1 - zf * zf) * Math.cos(az), Math.sqrt(1 - zf * zf) * Math.sin(az), zf * 0.8 + 0.2]);
      const surf = scale([dir[0] * rad[0], dir[1] * rad[1], dir[2] * rad[2]], 1 / Math.hypot(...dir));
      const u = unit([surf[0] / rad[0] ** 2, surf[1] / rad[1] ** 2, surf[2] / rad[2] ** 2]);
      const c = sub(surf, scale(u, (0.1 + 0.2 * r()) * S)); const br = breakAt(c, u, Ls[0], r);
      const support = Math.hypot(br.n[0] * rad[0], br.n[1] * rad[1], br.n[2] * rad[2]); const off = dot(br.n, c);
      block.push({ n: br.n, kind: br.kind === 'scallop' ? 'plane' : br.kind, mineral: br.mineral, c: off < 0.4 * support ? add(c, scale(br.n, 0.4 * support - off)) : c });
    }
  }
  const cut = (chip, q, d) => {
    let t = chip.kind === 'scallop' ? chip.Rs - len(sub(q, add(chip.c, scale(chip.n, chip.Rs)))) : dot(chip.n, sub(q, chip.c));
    if (chip.rho) t = Math.min(t, chip.rho - len(sub(q, chip.c)));
    return Math.max(d, t);
  };

  const memo = Ls.map(() => new Map());
  const cellKey = (i, j, k) => (i + 1024) * 4194304 + (j + 1024) * 2048 + (k + 1024);
  const chipSeed = (lv, i, j, k) => { const h = hash4(i, j, k, seed * 131 + lv * 17 + 3); const L = Ls[lv]; return [(i + 0.15 + 0.7 * hf(h, 0)) * L, (j + 0.15 + 0.7 * hf(h, 1)) * L, (k + 0.15 + 0.7 * hf(h, 2)) * L]; };
  const normalAt = (lv, q, h) => unit([upTo(lv, add(q, [h, 0, 0])) - upTo(lv, add(q, [-h, 0, 0])), upTo(lv, add(q, [0, h, 0])) - upTo(lv, add(q, [0, -h, 0])), upTo(lv, add(q, [0, 0, h])) - upTo(lv, add(q, [0, 0, -h]))]);
  function chipOf(lv, i, j, k) {
    const key = cellKey(i, j, k); const hit = memo[lv].get(key); if (hit) return hit;
    const c = chipSeed(lv, i, j, k); const dPrev = upTo(lv, c); let chip = { active: false };
    if (dPrev <= 0 && dPrev > -budget[lv]) {
      const h = 0.04 * Ls[lv]; const u0 = normalAt(lv, c, h); const q = add(c, scale(u0, -dPrev));
      const t1 = unit(cross(u0, Math.abs(u0[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), t2 = cross(u0, t1);
      const ring = [t1, scale(t1, -1), t2, scale(t2, -1)].map((t) => normalAt(lv, add(q, scale(t, 0.35 * Ls[lv])), h));
      const spread = Math.max(...ring.map((v) => Math.acos(Math.max(-1, Math.min(1, dot(v, u0)))))) * (180 / Math.PI);
      const u = unit(ring.reduce((s, v) => add(s, v), u0)); const r = mulberry32(hash4(i, j, k, seed * 7919 + lv * 101 + 11));
      if (spread > o.edgeDeg && r() < o.edgeChip) chip = { active: true, ...breakAt(c, u, Ls[lv], r), c, Rs: Ls[lv] * (2.5 + 2 * r()), rho: Ls[lv] * (0.7 + 0.25 * r()) };
    }
    memo[lv].set(key, chip); return chip;
  }
  function applyOctave(lv, q, d) {
    const L = Ls[lv]; const i0 = Math.floor(q[0] / L), j0 = Math.floor(q[1] / L), k0 = Math.floor(q[2] / L); const r2 = (0.95 * L) ** 2;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) {
      const c = chipSeed(lv, i0 + a, j0 + b, k0 + e); if ((c[0] - q[0]) ** 2 + (c[1] - q[1]) ** 2 + (c[2] - q[2]) ** 2 > r2) continue;
      const chip = chipOf(lv, i0 + a, j0 + b, k0 + e); if (chip.active) d = cut(chip, q, d);
    }
    return d;
  }
  // Outside the base the cuts still matter: an offset of the rock (`round`, `shell`) draws the level set d = +r, which
  // lies outside the ellipsoid, so the cascade is evaluated through an outer band too. Beyond it the ellipsoid is a
  // lower bound with the right sign (a cut only raises d).
  const band = 0.25 * S;
  function upTo(lv, q) {                                       // the field with levels < lv (level 0 = the block)
    let d = ellipsoid(q); if (d > band || d < -reach) return d;
    if (lv > 0) for (const pl of block) d = cut(pl, q, d);
    for (let k = 1; k < lv; k++) d = applyOctave(k, q, d);
    return d;
  }

  const JIT = [...Array(8)].map((_, i) => [hf(hash4(i, 1, 2, 3), 0) - 0.5, hf(hash4(i, 1, 2, 3), 1) - 0.5, hf(hash4(i, 1, 2, 3), 2) - 0.5]);
  const grainTone = (q) => { const G = grainAt(q); return toneOf(G.mineral).map((c) => c * G.shade); };
  /** Grain colour at p (world), filtered to `footprint` (world units): resolved grains, a jittered average, or the mean. */
  const colorAt = (p, footprint = 0) => {
    if (o.color === 'mean' || footprint > 4 * g) return rgbHex(mean);
    const q = sub(p, center);
    if (footprint < 0.35 * g) return rgbHex(grainTone(q));
    const s = [0, 0, 0]; for (const j of JIT) { const t = grainTone(add(q, scale(j, 2 * footprint))); for (let k = 0; k < 3; k++) s[k] += t[k] / JIT.length; }
    return rgbHex(s);
  };
  const lo = sub(center, rad), hi = add(center, rad);
  return {
    d: (p) => upTo(o.octaves + 1, sub(p, center)),
    bounds: { min: lo, max: hi },
    colorAt: o.color === false ? null : colorAt,
    meanColor: rgbHex(mean),
    blockPolytope: () => blockPolytope(block, rad, center),
    meta: { size: S, grain: g, levels: Ls, block: block.length, seed },
  };
}

/** The block as an exact convex polytope: the block planes plus 26 tangent planes of the base ellipsoid (so an uncut
 *  side stays bounded and faceted). → { vertices:[[x,y,z]], faces:[[i…]] (outward, CCW), normals } */
function blockPolytope(block, rad, center) {
  const planes = block.map((b) => ({ n: b.n, d: dot(b.n, b.c) }));
  for (let i = 0; i < 26; i++) {
    const zf = 1 - (2 * (i + 0.5)) / 26, az = i * 2.39996; const dir = [Math.sqrt(1 - zf * zf) * Math.cos(az), Math.sqrt(1 - zf * zf) * Math.sin(az), zf];
    const surf = scale([dir[0] * rad[0], dir[1] * rad[1], dir[2] * rad[2]], 1); const u = unit([surf[0] / rad[0] ** 2, surf[1] / rad[1] ** 2, surf[2] / rad[2] ** 2]);
    planes.push({ n: u, d: dot(u, surf) });
  }
  const verts = [];
  for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) for (let k = j + 1; k < planes.length; k++) {
    const P = planes[i], Q = planes[j], R = planes[k]; const det = dot(P.n, cross(Q.n, R.n)); if (Math.abs(det) < 1e-9) continue;
    const p = scale(add(add(scale(cross(Q.n, R.n), P.d), scale(cross(R.n, P.n), Q.d)), scale(cross(P.n, Q.n), R.d)), 1 / det);
    if (planes.every((s) => dot(s.n, p) <= s.d + 1e-7 * (1 + Math.abs(s.d))) && !verts.some((v) => len(sub(v, p)) < 1e-6 * (1 + len(p)))) verts.push(p);
  }
  const faces = [], normals = [];
  for (const pl of planes) {
    const on = verts.map((v, i) => [v, i]).filter(([v]) => Math.abs(dot(pl.n, v) - pl.d) < 1e-6 * (1 + Math.abs(pl.d)));
    if (on.length < 3) continue;
    const c = scale(on.reduce((s, [v]) => add(s, v), [0, 0, 0]), 1 / on.length); const u = unit(sub(on[0][0], c)); const w = cross(pl.n, u);
    on.sort(([a], [b]) => Math.atan2(dot(sub(a, c), w), dot(sub(a, c), u)) - Math.atan2(dot(sub(b, c), w), dot(sub(b, c), u)));
    faces.push(on.map(([, i]) => i)); normals.push(pl.n);
  }
  return { vertices: verts.map((v) => add(v, center)), faces, normals };
}

/** The far level of detail as a face list ({ corners, tint, normal }): the exact block polytope, one tint (the mean). */
export function rockBlockFaces(spec) {
  const f = rockField({ ...spec, octaves: 0 }); const poly = f.blockPolytope();
  return poly.faces.map((ix, i) => ({ corners: ix.map((k) => poly.vertices[k]), tint: f.meanColor, normal: poly.normals[i] }));
}

/** Errors (strings) for a rock spec's own keys (the mix is checked by rock-minerals' validateRockMix). */
export function validateRockSpec(spec, at = 'rock') {
  const e = []; const num = (k, lo, hi, what) => { if (spec[k] !== undefined && !(Number.isFinite(spec[k]) && spec[k] >= lo && spec[k] <= hi)) e.push(`${at}.${k}: ${what}`); };
  if (!(Number.isFinite(spec.size) && spec.size > 0)) e.push(`${at}.size: the rock's longest extent in metres, > 0`);
  if (spec.octaves !== undefined && !(Number.isInteger(spec.octaves) && spec.octaves >= 0 && spec.octaves <= 6)) e.push(`${at}.octaves: an integer 0–6 (0 = the block alone, the far level of detail)`);
  if (spec.seed !== undefined && !Number.isInteger(spec.seed)) e.push(`${at}.seed: an integer`);
  num('hurst', 0.2, 1.2, 'the fracture roughness exponent, 0.2–1.2 (fractured rock ≈ 0.8)');
  num('alpha', 0, 1, 'the chip depth budget as a share of the block scale, 0–1');
  num('grain', 1e-6, 10, 'a grain size in metres overriding the rock\'s');
  if (spec.blockPlanes !== undefined && !(Number.isInteger(spec.blockPlanes) && spec.blockPlanes >= 0 && spec.blockPlanes <= 32)) e.push(`${at}.blockPlanes: an integer 0–32`);
  if (spec.aspect !== undefined && !(Array.isArray(spec.aspect) && spec.aspect.length === 3 && spec.aspect.every((a) => Number.isFinite(a) && a > 0 && a <= 1))) e.push(`${at}.aspect: [x, y, z] proportions of the base, each in (0, 1]`);
  if (spec.joints != null && !(Number.isFinite(spec.joints.above) && spec.joints.above > 0 && (spec.joints.prob === undefined || (spec.joints.prob >= 0 && spec.joints.prob <= 1)))) e.push(`${at}.joints: { above: metres > 0, prob?: 0–1 }`);
  if (spec.color !== undefined && !['grain', 'mean', false].includes(spec.color)) e.push(`${at}.color: 'grain' | 'mean' | false`);
  if (spec.unit !== undefined && !(spec.unit in ROCK_UNITS)) e.push(`${at}.unit: what one world unit is — 'cm' (the workbench default), 'm' or 'mm'; match the manifest's units`);
  return e;
}
