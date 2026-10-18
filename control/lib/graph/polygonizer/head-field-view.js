/**
 * head-field-view — the protoform head's FIELD seen as it is, not as the latitude march shows it.
 *
 * `figure-head.js` surfaces its field by latitude rings from a centre inside the braincase: star-shaped and coarse
 * (52 × 44), so the march faceted the face and flattened every undercut. Tuning the field against that view tunes the
 * march. This module is the instrument for tuning the field itself:
 *
 *   mesh       the field's iso-surface by surface nets (`field-mesh.js`) inside the head's own bounds, with corner
 *              normals for a smooth light;
 *   sections   the field's zero contour on a plane (marching squares): the mid-sagittal PROFILE, and the
 *              transverse cuts at named landmark heights;
 *   measures   CALIPER readings taken off the field itself (no mesh): a ray from outside along an axis, stepped in
 *              until the field goes negative and bisected, the extreme hit over a band of rays. Anthropometric
 *              names (g, op, eu, zy, go, n, gn, prn, sn, pg, al), millimetres at the canonical stature, and the
 *              scale-free indices with their textbook classes.
 *
 * Frame: the head's LOCAL frame (figure-head.js): origin under the chin on the head axis, +z up, +y the face, +x the
 * figure's right, STAND units at headScale 1 (1 unit = 1.8 m, hero-form SCALE). Pure, deterministic: fixed loops,
 * no dice.
 */
import { buildHeadField, HEAD_POLE_DEFAULT, HEAD_KNOB_DEFAULTS } from './figure-head.js';
import { surfaceNetFaces } from './field-mesh.js';
import { SM } from '../../util/math-scope.js';

/** STAND units → millimetres at the canonical stature (hero-form SCALE: 1 unit = 1.8 m) */
export const MM = 1800;

/** The head field for a pole + knobs + face dials (figure-head.js), with the box it lives in. */
export function headFieldOf({ pole = HEAD_POLE_DEFAULT, knobs = HEAD_KNOB_DEFAULTS, face = null } = {}) {
  const { field, landmarks: L } = buildHeadField({ pole, knobs, face });
  const bounds = { min: { x: -0.09, y: -0.11, z: L.menton.z - 0.03 }, max: { x: 0.09, y: 0.12, z: L.H + 0.02 } };
  return { field, landmarks: L, bounds };
}

/** The field's iso-surface by surface nets: outward quads with corner normals (field-mesh.js). */
export function headFieldMesh(head, { cells = 160 } = {}) {
  return surfaceNetFaces(head.field, head.bounds, { cells, smooth: true });
}

// ─── sections ─────────────────────────────────────────────────────────────
// A plane is { axis: 'x' | 'y' | 'z', at }. Its 2D coordinates (u, v): x-plane → (y, z) the profile, the face to
// +u; z-plane → (x, y) a transverse cut seen from above; y-plane → (x, z) a coronal cut seen from the front.
const PLANE_UV = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] };

/**
 * The field's zero contour on a plane, by marching squares at `res` cells along the plane's longer side.
 * Returns { axis, at, u, v, segments: [[u0, v0, u1, v1], …] } in the local frame's units.
 */
export function headSection(head, plane, { res = 240 } = {}) {
  const [ua, va] = PLANE_UV[plane.axis];
  const { min, max } = head.bounds;
  const h = Math.max(max[ua] - min[ua], max[va] - min[va]) / res;
  const nu = Math.ceil((max[ua] - min[ua]) / h), nv = Math.ceil((max[va] - min[va]) / h);
  const at = (i, j) => ({ [plane.axis]: plane.at, [ua]: min[ua] + i * h, [va]: min[va] + j * h });
  const D = new Float64Array((nu + 1) * (nv + 1));
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) D[j * (nu + 1) + i] = head.field(at(i, j));
  const d = (i, j) => D[j * (nu + 1) + i];
  const cross = (i0, j0, i1, j1) => {
    const a = d(i0, j0), b = d(i1, j1), t = a / (a - b);
    return [min[ua] + (i0 + (i1 - i0) * t) * h, min[va] + (j0 + (j1 - j0) * t) * h];
  };
  const segments = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    // corners 0 (i,j) 1 (i+1,j) 2 (i+1,j+1) 3 (i,j+1); edges 0:01 1:12 2:23 3:30
    const c = [d(i, j) < 0, d(i + 1, j) < 0, d(i + 1, j + 1) < 0, d(i, j + 1) < 0];
    const code = (c[0] ? 1 : 0) | (c[1] ? 2 : 0) | (c[2] ? 4 : 0) | (c[3] ? 8 : 0);
    if (code === 0 || code === 15) continue;
    const E = [() => cross(i, j, i + 1, j), () => cross(i + 1, j, i + 1, j + 1), () => cross(i + 1, j + 1, i, j + 1), () => cross(i, j + 1, i, j)];
    const pairs = SEG_TABLE[code];
    for (const [e0, e1] of pairs) { const p = E[e0](), q = E[e1](); segments.push([p[0], p[1], q[0], q[1]]); }
  }
  return { axis: plane.axis, at: plane.at, u: ua, v: va, segments };
}
// marching-squares edge pairs per inside-corner code (saddles split by the cell's corners, consistently)
const SEG_TABLE = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]], [[1, 3]], [[0, 1]], [[3, 0]], []];

/** The named sections the visualizer cuts: the mid-sagittal profile and transverse cuts at landmark heights. */
export function headSections(head, opts) {
  const L = head.landmarks;
  return {
    profile: headSection(head, { axis: 'x', at: 0 }, opts),
    brow: headSection(head, { axis: 'z', at: L.glabella.z }, opts),
    eyes: headSection(head, { axis: 'z', at: L.eyeL.z }, opts),
    noseBase: headSection(head, { axis: 'z', at: L.subnasale.z }, opts),
    mouth: headSection(head, { axis: 'z', at: L.stomion.z }, opts),
  };
}

// ─── calipers ─────────────────────────────────────────────────────────────
const FAR = 0.2, STEP = 0.0008, BISECT = 18;
const AX = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
/**
 * The first surface a ray meets coming in from outside: from `p` + FAR·dir travelling −dir. Returns the hit point
 * or null. `dir` is the OUTWARD direction (the side the caliper jaw comes from).
 */
export function rayIn(field, p, dir) {
  const at = (t) => ({ x: p.x + dir[0] * t, y: p.y + dir[1] * t, z: p.z + dir[2] * t });
  let t = FAR;
  if (field(at(t)) < 0) return null;   // the start is inside: no outside to come from
  for (; t > -FAR; t -= STEP) {
    if (field(at(t - STEP)) < 0) {
      let lo = t - STEP, hi = t;          // lo inside, hi outside
      for (let k = 0; k < BISECT; k++) { const m = (lo + hi) / 2; if (field(at(m)) < 0) lo = m; else hi = m; }
      return at((lo + hi) / 2);
    }
  }
  return null;
}
const range = (a, b, n) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));
/**
 * The extreme hit along `axis` (`sign` +1 the far + side, −1 the − side) over a band of rays: the band gives the
 * other two coordinates as [lo, hi] ranges sampled `n` × `n`. Returns the hit with the extreme coordinate, or null.
 */
export function caliper(field, axis, sign, band, n = 9) {
  const [ua, va] = PLANE_UV[axis];
  const dir = AX[axis].map((c) => c * sign);
  let best = null;
  for (const u of range(band[ua][0], band[ua][1], n)) for (const v of range(band[va][0], band[va][1], n)) {
    const hit = rayIn(field, { x: 0, y: 0, z: 0, [ua]: u, [va]: v }, dir);
    if (hit && (!best || sign * hit[axis] > sign * best[axis])) best = hit;
  }
  return best;
}

const dist = (a, b) => SM.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const r1 = (v) => Math.round(v * 10) / 10;
/** The textbook classes of the scale-free indices (Martin & Saller's head and face, the nasal index). */
export const INDEX_CLASSES = Object.freeze({
  cephalic: [[75, 'dolichocephalic'], [80, 'mesocephalic'], [85, 'brachycephalic'], [Infinity, 'hyperbrachycephalic']],
  facial: [[80, 'hypereuryprosopic'], [85, 'euryprosopic'], [90, 'mesoprosopic'], [95, 'leptoprosopic'], [Infinity, 'hyperleptoprosopic']],
  nasal: [[70, 'leptorrhine'], [85, 'mesorrhine'], [Infinity, 'platyrrhine']],
});
const classOf = (kind, v) => (v == null ? null : INDEX_CLASSES[kind].find(([hi]) => v < hi)[1]);

/**
 * Caliper measurements read off the head field. Returns { points, mm, index, classes }: the soft-tissue points found
 * (local frame), the distances in millimetres at the canonical stature, and the indices (×100) with their classes.
 * A point the field does not yield (a ray that found no surface) leaves its measures null.
 */
export function headMeasures(head) {
  const { field, landmarks: L } = head;
  const s = L.s, H = L.H;
  const mid = [-0.0015, 0.0015];
  // the front profile: front-most hits on the midline at a ladder of heights
  const front = (z0, z1, n = 25) => {
    const out = [];
    for (const z of range(z0, z1, n)) { const p = rayIn(field, { x: 0, y: 0, z }, [0, 1, 0]); if (p) out.push(p); }
    return out;
  };
  const maxBy = (ps, f) => ps.reduce((b, p) => (b == null || f(p) > f(b) ? p : b), null);
  // the ladder finds the extremum to a rung; a ternary search between the neighbouring rungs refines it, so a reading
  // moves smoothly with the field instead of in rung-sized jumps
  const refine = (best, z0, z1, n, sign) => {
    if (!best) return best;
    const h = (z1 - z0) / (n - 1);
    let a = Math.max(z0, best.z - h), b = Math.min(z1, best.z + h);
    const yAt = (z) => { const p = rayIn(field, { x: 0, y: 0, z }, [0, 1, 0]); return p ? sign * p.y : -Infinity; };
    for (let k = 0; k < 24; k++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3; if (yAt(m1) < yAt(m2)) a = m1; else b = m2; }
    return rayIn(field, { x: 0, y: 0, z: (a + b) / 2 }, [0, 1, 0]) || best;
  };
  const maxFront = (z0, z1, n = 25) => refine(maxBy(front(z0, z1, n), (p) => p.y), z0, z1, n, 1);
  const minFront = (z0, z1, n = 25) => refine(maxBy(front(z0, z1, n), (p) => -p.y), z0, z1, n, -1);

  const g = maxFront(L.nasion.z, L.glabella.z + 0.03 * s);                                              // glabella
  const op = caliper(field, 'y', -1, { x: mid, z: [0.40 * H, 0.95 * H] });                              // opisthocranion
  const n = minFront(L.noseBridge.z, g ? g.z : L.glabella.z);                                           // soft nasion
  const prn = maxFront(L.subnasale.z, L.noseBridge.z);                                                  // pronasale
  const sn = prn && minFront(L.stomion.z + 0.01 * s, prn.z, 31);                                        // subnasale (profile)
  const gn = gnathion(field, L);                                                                        // gnathion
  const pg = maxFront(gn ? gn.z : L.menton.z, L.stomion.z - 0.01 * s);                                  // pogonion
  const above = L.earTopR.z + 0.01 * s;                                                                 // euryon: above the ears
  const eu = [-1, 1].map((sg) => caliper(field, 'x', sg, { y: [-0.06 * s, 0.04 * s], z: [above, H] }));
  const ahead = L.tragionR.y + 0.012 * s;                                                               // zygion: ahead of the ear
  const zy = [-1, 1].map((sg) => caliper(field, 'x', sg, { y: [ahead, 0.06 * s], z: [L.zygionR.z - 0.03 * H, L.zygionR.z + 0.03 * H] }));
  const go = [-1, 1].map((sg) => caliper(field, 'x', sg, { y: [L.gonionR.y - 0.012 * s, L.gonionR.y + 0.012 * s], z: [L.gonionR.z - 0.02 * H, L.gonionR.z + 0.02 * H] }));
  const al = alarPair(field, L);

  const mm = (a, b) => (a && b ? r1(dist(a, b) * MM) : null);
  const angleAt = (a, o, b) => {
    if (!a || !o || !b) return null;
    const u = [a.y - o.y, a.z - o.z], v = [b.y - o.y, b.z - o.z];
    return r1((SM.acos((u[0] * v[0] + u[1] * v[1]) / (SM.hypot(...u) * SM.hypot(...v))) * 180) / Math.PI);
  };
  const out = {
    'g-op': mm(g, op), 'eu-eu': mm(eu[0], eu[1]), 'zy-zy': mm(zy[0], zy[1]), 'go-go': mm(go[0], go[1]),
    'n-gn': mm(n, gn), 'n-sn': mm(n, sn), 'al-al': mm(al[0], al[1]), 'sn-prn': mm(sn, prn),
    'g-sn-pg': angleAt(g, sn, pg),
    // how far the nasion sits behind the glabella (0: no nasion dip, the forehead runs straight into the nose)
    'nasion depth': g && n ? r1((g.y - n.y) * MM) : null,
  };
  const ix = (a, b) => (out[a] && out[b] ? r1((out[a] / out[b]) * 100) : null);
  const index = { cephalic: ix('eu-eu', 'g-op'), facial: ix('n-gn', 'zy-zy'), jaw: ix('go-go', 'zy-zy'), nasal: ix('al-al', 'n-sn') };
  return {
    points: { g, op, n, prn, sn, gn, pg, euL: eu[0], euR: eu[1], zyL: zy[0], zyR: zy[1], goL: go[0], goR: go[1], alL: al[0], alR: al[1] },
    mm: out,
    index,
    classes: { cephalic: classOf('cephalic', index.cephalic), facial: classOf('facial', index.facial), nasal: classOf('nasal', index.nasal) },
  };
}

// Soft-tissue gnathion: the chin's point farthest FRONT-AND-DOWN on the midline — a caliper on the diagonal, since the
// submental floor slopes on into the throat and has no lowest point of its own.
function gnathion(field, L) {
  const s = L.s, out = [0, Math.SQRT1_2, -Math.SQRT1_2], across = [0, Math.SQRT1_2, Math.SQRT1_2];
  const hit = (o) => rayIn(field, { x: 0, y: L.menton.y + across[1] * o, z: L.menton.z + across[2] * o }, out);
  const reach = (o) => { const p = hit(o); return p ? p.y * out[1] + p.z * out[2] : -Infinity; };
  const os = range(-0.03 * s, 0.03 * s, 31), h = os[1] - os[0];
  let bo = null, bestT = -Infinity;
  for (const o of os) { const t = reach(o); if (t > bestT) { bestT = t; bo = o; } }
  if (bo == null) return null;
  let a = bo - h, b = bo + h;
  for (let k = 0; k < 24; k++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3; if (reach(m1) < reach(m2)) a = m1; else b = m2; }
  return hit((a + b) / 2) || hit(bo);
}

// The alae: a caliper would take the cheek (wider than the nose at its base), so read the front depth y(x) across the
// nose at the alae's height and take the alar-facial groove — the first local minimum of y walking out from the
// midline past the wing's crest — as the alare, the wing's lateral edge seen from the front; without a groove, the
// knee where the wing turns into the cheek.
function alarPair(field, L) {
  const z = L.alaR.z, s = L.s, xs = range(0, 0.03 * s, 61);
  const ys = xs.map((x) => { const p = rayIn(field, { x, y: 0, z }, [0, 1, 0]); return p ? p.y : null; });
  let crest = -1;
  for (let i = 1; i < xs.length - 1; i++) {
    if (ys[i] == null || ys[i - 1] == null || ys[i + 1] == null) continue;
    if (crest < 0 && xs[i] > L.alaR.x * 0.5 && ys[i] >= ys[i - 1] && ys[i] >= ys[i + 1]) crest = i;
    if (crest >= 0 && i > crest && ys[i] <= ys[i - 1] && ys[i] < ys[i + 1]) {
      return [{ x: -xs[i], y: ys[i], z }, { x: xs[i], y: ys[i], z }];
    }
  }
  // no groove: the alare is still where the wing turns into the cheek — the strongest concave bend of y(x) past the
  // crest (the knee). No crest either (the tip's slope runs down over the wing at this height, so the wing makes no
  // ridge of its own): the knee past half the alare's landmark width
  const from = crest >= 0 ? crest + 1 : xs.findIndex((x) => x > L.alaR.x * 0.5);
  let knee = -1, best = 0;
  for (let i = Math.max(1, from); i < xs.length - 1; i++) {
    if (ys[i - 1] == null || ys[i] == null || ys[i + 1] == null) continue;
    const bend = ys[i - 1] - 2 * ys[i] + ys[i + 1];
    if (bend > best) { best = bend; knee = i; }
  }
  return knee < 0 ? [null, null] : [{ x: -xs[knee], y: ys[knee], z }, { x: xs[knee], y: ys[knee], z }];
}

/**
 * THROUGH-HOLES — lines straight across the head (along x) that meet no skin, though skin closes round them on every
 * side in the side view (above, below, before and behind): a hole you could see through from the side. The open air
 * round the head's outline is not one. `step` is the grid in the side view, in head heights `H`. Returns the holes'
 * { y, z } (local frame), empty when the head is closed.
 */
export function throughHoles(head, { step = 0.01, reach = 0.25 } = {}) {
  const { field, bounds, landmarks: L } = head;
  const H = L.H, minStep = 0.002 * H;
  // a line meets skin: march it by the field's own distance (sphere tracing — the summed wave never overestimates
  // the distance, so a step of f(p) cannot jump the surface), at least `minStep` a step
  const solid = (y, z) => {
    for (let x = bounds.min.x; x <= bounds.max.x;) { const d = field({ x, y, z }); if (d < 0) return true; x += Math.max(d, minStep); }
    return false;
  };
  const h = step * H, R = reach * H, memo = new Map();
  const at = (y, z) => { const k = `${y.toFixed(9)},${z.toFixed(9)}`; if (!memo.has(k)) memo.set(k, solid(y, z)); return memo.get(k); };
  const cells = [];
  for (let z = bounds.min.z + h; z < bounds.max.z; z += h) for (let y = bounds.min.y + h; y < bounds.max.y; y += h) {
    if (at(y, z)) continue;
    // closed round on every side within `reach` (head heights): skin above, below, before and behind
    const closed = [[0, 1], [0, -1], [1, 0], [-1, 0]].every(([sy, sz]) => { for (let r = 2 * h; r <= R; r += 2 * h) if (at(y + sy * r, z + sz * r)) return true; return false; });
    if (closed) cells.push({ y, z });
  }
  return cells;
}
