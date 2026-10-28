/**
 * THE SCREE'S STONES (gen-7): the larger stones of a scree stood up as real ones, where the overlay lays scree
 * (form/land-layers.js), so a cliff's foot has rubble with a silhouette and a shadow, not only a texture's. The finer
 * stones stay the layer's (its normal map, its parallax); these are the ones a walker steps round.
 *
 *   landStones(faces, layers, { seed?, density?, sizes?, rubble? }) → [{ at: [x, y, z], r, n: [x, y, z], tone, v }]
 *       faces: a payload's faces; layers: their overlay (landLayers: `layered(i)`, `weightAt(corner)`). On each layered
 *       face level enough to hold a stone (its normal within STONE_N of up), stones by its area × the scree's mean share
 *       of its corners × `density` (per square metre where the ground is all scree), each where its dice put it on the
 *       face, its radius from `sizes` (most small, a few large: r = lo + (hi − lo) × u³), sunk a share of it into the
 *       ground (`at` its centre), `n` the face's normal (the stone's up), `tone` a seeded wander about 1, `v` its shape
 *       (one of SHAPES). Fewer where the scree thins: the edge of a talus is its stones growing fewer.
 *       `rubble` (0–1, a trail's dress): stones along the trail too (its mask, `layers.path`), most just past its edge
 *       (the verge, RUBBLE_AT metres out, wearing out over RUBBLE_SPREAD), a few on it (RUBBLE_ON), as many as `rubble`
 *       of a scree's at the most, and smaller (RUBBLE_SIZES) where the trail's share is the face's larger; none without a
 *       trail.
 *
 *   stoneForms({ rock?, seed?, aspect? }) → { near: [{ pos, nrm }], far: [{ pos, nrm }] }: the SHAPES shapes the stones are
 *       drawn from, as the rock studies break a rock (polygonizer/rock-fracture.js: the minerals' cleavage, a block of
 *       planar fractures, chips at halving scales on a Hurst law). `near` each shape chipped (STONE_NEAR: its octaves and
 *       cells), for the stones that cast; `far` its block alone, the exact polytope of its fractures (a few dozen
 *       facets), for the small. Triangles about the origin, of a bulk STONE_BULK (its half extents' geometric mean), flatter
 *       up `aspect` as a stone lies: `pos` Float32Array (x, y, z per corner), `nrm` the corner's normal (Float32Array), creased at STONE_CREASE
 *       so a fracture's edge stays sharp and the chips between read round. No light in them: the form render lights them.
 *       Painted once per rock and kept (the shapes are the rock's, no cube's).
 *
 * Pure, seeded: the same faces and layers, the same stones. Nothing in the recipe reads it.
 */
import { strHash } from '../city/plan/dice.js';
import { rockBlockFaces } from '../polygonizer/rock-fracture.js';
import { fieldToFaces } from '../polygonizer/field-faces.js';

/** Stones per square metre of all-scree ground; the radii (metres); how level a face must be; how deep a stone sits. */
export const STONE_DENSITY = 1.6, STONE_SIZES = Object.freeze([0.07, 0.4]), STONE_N = 0.55, SINK = 0.45;
/** How many shapes the stones are drawn from. */
export const SHAPES = 4;
/** A trail's rubble: where its verge's stones lie thickest (metres past its edge), how far they spread, the share on it. */
export const RUBBLE_AT = 0.45, RUBBLE_SPREAD = 0.7, RUBBLE_ON = 0.15;
/** A trail's rubble's radii (metres): smaller than a talus's, what a walked way sheds and kicks aside. */
export const RUBBLE_SIZES = Object.freeze([0.035, 0.18]);

const u01 = (seed, tag, k) => strHash(`${seed}|${tag}|${k}`) / 4294967296;

export function landStones(faces, layers, { seed = 1, density = STONE_DENSITY, sizes = STONE_SIZES, rubble = 0 } = {}) {
  const out = [], M = rubble > 0 ? layers.path : null;
  // (a trail's verge: the rubble's share at a point, by its distance to the trail)
  const verge = (c) => {
    const i = Math.round((c[0] - M.origin[0]) / M.cell), j = Math.round((c[1] - M.origin[1]) / M.cell);
    if (i < 0 || j < 0 || i >= M.size[0] || j >= M.size[1]) return 0;
    const d = M.dist[j * M.size[0] + i];
    return rubble * (d <= 0 ? RUBBLE_ON : Math.exp(-(((d - RUBBLE_AT) / RUBBLE_SPREAD) ** 2)));
  };
  faces.forEach((f, i) => {
    if (!layers.layered(i)) return;
    const cs = f.corners, n = f.normal || [0, 0, 1];
    if (n[2] < STONE_N) return;
    const talus = cs.reduce((s, c) => s + (layers.weightAt(c)?.[1] ?? 0), 0) / cs.length, rub = M ? cs.reduce((s, c) => s + verge(c), 0) / cs.length : 0;
    const scree = Math.max(talus, rub), R = rub > talus ? RUBBLE_SIZES : sizes;
    if (scree <= 0.02) return;
    // a fan of triangles from the first corner: each its area's share of the stones
    for (let t = 1; t + 1 < cs.length; t++) {
      const a = cs[0], b = cs[t], c = cs[t + 1];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      // (the count: the expected number, its fraction kept by a die so a face's share is never rounded away)
      const want = area * scree * density, k = Math.floor(want) + (u01(seed, 'stone-n', `${i},${t}`) < want - Math.floor(want) ? 1 : 0);
      for (let s = 0; s < k; s++) {
        const key = `${i},${t},${s}`;
        let p = u01(seed, 'stone-p', key), q = u01(seed, 'stone-q', key);
        if (p + q > 1) { p = 1 - p; q = 1 - q; }
        const r = R[0] + (R[1] - R[0]) * u01(seed, 'stone-r', key) ** 3;
        const at = [0, 1, 2].map((d) => a[d] + (b[d] - a[d]) * p + (c[d] - a[d]) * q + n[d] * r * (1 - SINK));
        out.push({ at: at.map((v) => Math.round(v * 1e4) / 1e4), r: Math.round(r * 1e4) / 1e4, n, tone: Math.round((0.85 + 0.3 * u01(seed, 'stone-t', key)) * 1e3) / 1e3, v: Math.floor(u01(seed, 'stone-v', key) * SHAPES) });
      }
    }
  });
  return out;
}

/** A near stone's chipping (the rock field's octaves, the mesher's cells over it); the crease (degrees) its normals keep. */
export const STONE_NEAR = Object.freeze({ octaves: 2, cells: 18 }), STONE_CREASE = 40;
/** A stone form's bulk: the geometric mean of its half extents (the radius a stone's `r` scales). */
export const STONE_BULK = 0.85;
/** A stone lies on its flattest side: its proportions along x, y, up. */
export const STONE_ASPECT = Object.freeze([1, 0.85, 0.65]);

const formMemo = new Map();
export function stoneForms({ rock = 'granite', seed = 1, aspect = STONE_ASPECT } = {}) {
  const memo = `${typeof rock === 'string' ? rock : JSON.stringify(rock)}|${seed}|${aspect.join(',')}`;
  if (formMemo.has(memo)) return formMemo.get(memo);
  const near = [], far = [];
  for (let v = 0; v < SHAPES; v++) {
    // (a rock a metre across, unit metres: its block and its chips, then centred and scaled to a stone's bulk)
    const shape = { kind: 'rock', center: [0, 0, 0], size: 1, unit: 'm', rock, seed: strHash(`${seed}|stone-form|${v}`) % 1000000, color: false, aspect: [...aspect] };
    far.push(packTris(rockBlockFaces(shape).map((f) => f.corners)));
    near.push(packTris(fieldToFaces({ terms: [{ id: 'stone', op: 'add', shape: { ...shape, octaves: STONE_NEAR.octaves } }], cells: STONE_NEAR.cells }, {}).map((f) => f.corners)));
  }
  const out = { near, far };
  formMemo.set(memo, out);
  return out;
}
// polygons → triangles (fans), centred and scaled to a stone's bulk (STONE_BULK: the mean of its half extents, its own
// proportions kept), with normals creased: each corner the mean of the faces round its point within the crease of its own
// face's
function packTris(polys) {
  let tris = [];
  for (const cs of polys) for (let k = 1; k + 1 < cs.length; k++) tris.push([cs[0], cs[k], cs[k + 1]]);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of t) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], p[c]); hi[c] = Math.max(hi[c], p[c]); }
  const mid = lo.map((v, c) => (v + hi[c]) / 2), half = lo.map((v, c) => (hi[c] - v) / 2), k = STONE_BULK / Math.cbrt(half[0] * half[1] * half[2]);
  // (a stone settles on its flattest side: its least extent turned up, the axes swapped and the winding kept)
  const least = half.indexOf(Math.min(...half)), swap = (p) => (least === 2 ? p : least === 0 ? [p[2], p[1], p[0]] : [p[0], p[2], p[1]]);
  tris = tris.map((t) => { const q = t.map((p) => swap(p.map((x, c) => (x - mid[c]) * k))); return least === 2 ? q : [q[0], q[2], q[1]]; });
  const fn = tris.map(([a, b, c]) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; });
  const key = (p) => p.map((x) => Math.round(x * 1e4)).join(','), at = new Map();
  tris.forEach((t, i) => t.forEach((p) => { const q = key(p); if (!at.has(q)) at.set(q, []); at.get(q).push(i); }));
  const unit = (n) => { const l = Math.hypot(...n) || 1; return n.map((x) => x / l); }, cosC = Math.cos((STONE_CREASE * Math.PI) / 180);
  const pos = new Float32Array(tris.length * 9), nrm = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => {
    const own = unit(fn[i]);
    t.forEach((p, k) => {
      const n = [0, 0, 0];
      for (const j of at.get(key(p))) { const o = unit(fn[j]); if (o[0] * own[0] + o[1] * own[1] + o[2] * own[2] >= cosC) { n[0] += fn[j][0]; n[1] += fn[j][1]; n[2] += fn[j][2]; } }
      const m = unit(n);
      pos.set(p, i * 9 + k * 3); nrm.set(m, i * 9 + k * 3);
    });
  });
  return { pos, nrm };
}
