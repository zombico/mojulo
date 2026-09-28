/**
 * crystal-prints — the light each stone on a World page throws, traced once when the page is emitted
 * (crystal-shine S4). Faces tagged `crystal: { gem, stone, c, r, axis, cmu }` are gathered by stone, the
 * stone's convex polytope is rebuilt from its faces, and crystal-print.js traces its shadow and caustic onto the plane
 * it rests on, under the scene's light. A budget keeps a page light: the largest stones first, three bands, one
 * internal reflection, a polygon cap. Pure and deterministic.
 */

import { crystalPrint, printOptics } from '../polygonizer/crystal-print.js';
import { shineOptics } from '../polygonizer/crystal-shine.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export const PRINT_BUDGET = Object.freeze({ stones: 24, bands: 3, depth: 1, maxPolygons: 160, minFace: 0.03, albedo: 0.35 });

/** A World page's sun for crystals: the payload's `toLight`, turned upward if it points below the horizon. */
export const crystalSun = (toLight) => { const t = unit(toLight); return t[2] < 0 ? [-t[0], -t[1], -t[2]] : t; };

/** The page's crystal stones: faces gathered by stone, with the stone's tag and its group. */
function stonesOf(faces) {
  const stones = new Map();
  for (const f of faces) {
    const k = f && f.crystal; if (!k || typeof k.gem !== 'string' || !Array.isArray(f.corners) || f.corners.length < 3) continue;
    const key = k.stone != null ? String(k.stone) : (Array.isArray(k.c) ? k.c.map((x) => x.toFixed(5)).join(',') : 'stone');
    const st = stones.get(key) || stones.set(key, { k, group: typeof f.group === 'string' ? f.group : 'static', faces: [] }).get(key);
    st.faces.push(f.corners.length === 4 && sameP(f.corners[2], f.corners[3]) ? f.corners.slice(0, 3) : f.corners);
  }
  return [...stones.values()].sort((a, b) => (b.k.r || 0) - (a.k.r || 0));
}
/** A stone in its own frame (c on z, the print kernel's optic axis) and the pose that places it: v_world = R·v + at. */
function posedStone({ k, faces: F }) {
  const c = Array.isArray(k.c) ? k.c : centreOf(F); const z = unit(Array.isArray(k.axis) ? k.axis : [0, 0, 1]);
  const x = unit(Math.abs(z[0]) < 0.9 ? [0, z[2], -z[1]] : [-z[2], 0, z[0]]); const y = cross(z, x);
  const R = [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];
  const world = polyOf(F, c); const local = (v) => { const d = sub(v, c); return [dot(x, d), dot(y, d), dot(z, d)]; };
  const poly = { vertices: world.vertices.map(local), faces: world.faces, normals: world.normals.map((n) => [dot(x, n), dot(y, n), dot(z, n)]) };
  return { poly, R, at: c, zMin: Math.min(...world.vertices.map((v) => v[2])), cmu: Number.isFinite(k.cmu) && k.cmu > 0 ? k.cmu : 1 };
}
const r5 = (p) => p.map((x) => +x.toFixed(5));

/**
 * faces (the page's expanded face list) + toLight → [{ shadow: [[x,y,z]…], polys: [{ v: [[x,y,z]…], rgb }] }].
 * `skip`: groups whose prints are traced live on the page instead (a stone a mover turns).
 */
export function crystalPrintsFor(faces, toLight, budget = PRINT_BUDGET, { skip = null } = {}) {
  const sun = crystalSun(toLight); if (sun[2] < 0.05) return [];
  const list = stonesOf(faces).filter((st) => !(skip && skip.has(st.group))).slice(0, budget.stones);
  const out = [];
  for (const st of list) {
    const { poly, R, at, zMin, cmu } = posedStone(st);
    const r = crystalPrint({ gem: st.k.gem, poly, pose: { R, at }, light: { dir: sun.map((x) => -x) }, receiver: { z: zMin - 1e-4 * (st.k.r || 1) }, bands: budget.bands, depth: budget.depth,
      maxPolygons: budget.maxPolygons, minFace: budget.minFace, unit: 100 / cmu });
    out.push({ shadow: r.shadow.map(r5), polys: r.polygons.map((q) => ({ v: q.corners.map(r5), rgb: q.rgb.map((x) => +Math.min(1.5, x * budget.albedo).toFixed(4)) })) });
  }
  return out;
}
/**
 * The stones of `groups` (driven by a mover) as the page re-traces them: each in its own frame, its rest pose, the
 * plane it rests over, and the print optics of its gem. { stones: [{ group, gem, poly, R, at, z, unit }], optics }.
 */
export function crystalLivePrints(faces, groups, budget = PRINT_BUDGET) {
  const list = stonesOf(faces).filter((st) => groups.has(st.group)).slice(0, budget.stones);
  const optics = {};
  const stones = list.map((st) => {
    const { poly, R, at, zMin, cmu } = posedStone(st); if (!optics[st.k.gem]) optics[st.k.gem] = printOptics(st.k.gem, budget.bands);
    return { group: st.group, gem: st.k.gem, poly: { vertices: poly.vertices.map(r5), faces: poly.faces, normals: poly.normals.map(r5) }, R: R.map(r5), at: r5(at), z: +(zMin - 1e-4 * (st.k.r || 1)).toFixed(6), unit: +(100 / cmu).toFixed(4) };
  });
  return { stones, optics };
}
/**
 * The light a glowing stone spills (ruby by nature, any gem by the glow dial): a soft pool of its colour on the surface
 * it grew from, a disc ⟂ its c axis at its base. [{ c, n, r, rgb }] for every glowing stone (cheap: a fan each).
 */
export function crystalGlowPools(faces, max = 400) {
  const seen = new Map();
  for (const f of faces) { const k = f && f.crystal; if (!k || typeof k.gem !== 'string' || !Array.isArray(k.c)) continue; const key = k.stone != null ? String(k.stone) : k.c.join(','); if (!seen.has(key)) seen.set(key, k); }
  const out = [];
  for (const k of seen.values()) {
    const g = shineOptics(k.glow ? `${k.gem}~${k.glow}` : k.gem).glow; if (!g || !(g.strength > 0)) continue;
    const a = unit(Array.isArray(k.axis) ? k.axis : [0, 0, 1]); const r = k.r || 1;
    // the disc is tangent where the stone grew (`base`): flush on a floor, a hair above a concave cavity wall
    const base = Array.isArray(k.base) ? k.base : k.c.map((x, i) => x - a[i] * r);
    out.push({ c: [0, 1, 2].map((i) => +(base[i] + a[i] * r * 0.02).toFixed(5)), n: a.map((x) => +x.toFixed(5)), r: +(r * 1.8).toFixed(5), rgb: g.rgb.map((x) => +(x * g.strength * 0.4).toFixed(4)) });
    if (out.length >= max) break;
  }
  return out;
}
const sameP = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-12;
function centreOf(F) { const all = F.flat(); return [0, 1, 2].map((k) => all.reduce((s, p) => s + p[k], 0) / all.length); }
/** A stone's faces (polygons, any winding) → { vertices, faces (index lists, outward CCW), normals (outward) }. */
function polyOf(F, c) {
  const vertices = [], index = new Map(); const id = (p) => { const key = p.map((x) => x.toFixed(6)).join(','); if (!index.has(key)) { index.set(key, vertices.length); vertices.push(p); } return index.get(key); };
  const faces = [], normals = [];
  for (const P of F) {
    let n = [0, 0, 0]; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
    n = unit(n); const ctr = centreOf([P]); let ix = P.map(id);
    if (dot(n, sub(ctr, c)) < 0) { n = n.map((x) => -x); ix = ix.slice().reverse(); }
    faces.push(ix); normals.push(n);
  }
  return { vertices, faces, normals };
}
