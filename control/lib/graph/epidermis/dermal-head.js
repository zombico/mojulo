/**
 * DERMAL HEAD — the realistic register's head (polygonizer/head-relational.js) as a dermal chart (dermal-chart.js):
 * the shape the texturizer is built for. The head's field is surface-netted and welded into a mesh in metres (its
 * normals the field's gradient), the globes left off the skin (`paint`), what the head closes over marked `enclosed` (the
 * teeth, the mouth's and the nostrils' insides: a point that meets the head again marched out from its centre), and
 * every vertex addressed on a plumb axis
 * through the middle of glabella and opisthocranion, then re-addressed on the head's SPHERE (`headSphere`: `along` the
 * elevation from a centre at the ear's height, `around` the azimuth), so the undersides keep texels of their own. The head's RELATIONS ride with the chart as MARKS: each landmark's place on the face
 * in millimetres (X the arc at the face's radius, + the head's right; Y up from the menton), so the dermal map lays the
 * hairline from the trichion, the temples from the brow's outer ends, the sideburn and the ear from the porion, the
 * nose down its dorsum, the lids about the eyes, the cheeks on their apexes, the lips about the stomion and the mouth's
 * corners, the beard's cheek line from the ear's front to the mouth's corner. An action that moves a relation moves
 * the skin's layout with it.
 *
 *   relationalHeadChart(head, { cells })  → a chart (one part, `head`, its `marks`; the ear's points its `ear` feature)
 *   headChartOf(head, mesh, skinAt, shutAt) → the same, of a head mesh given in the head's frame
 *   headSphere(head)                      → { c, R, length, of(p) → { along, around, el } }
 *   headMarks(head)                       → { r0, length, cy, points: { name: { X, Y, Z } } } (mm)
 *
 * Pure: the field and its relations in, a mesh and addresses out; no dice, no clock.
 */
import { headFieldMesh } from '../polygonizer/head-field-view.js';
import { chartFromMesh, meshOcclusion } from './dermal-chart.js';

/** the head's height (m): the plumb line's run, menton to vertex */
const L_HEAD = (head) => head.landmarks.H * 1.8;

/** metres in a STAND unit (the protoform's frame: 1 unit = 1.8 m) */
export const STAND_M = 1.8;

/**
 * The head's SPHERE: its chart is spherical about a centre inside it (on the plumb line through the middle of glabella
 * and opisthocranion, at the ear's height), so a surface that faces down (under the jaw, under the occiput, the nose's
 * base) has texels of its own; a cylinder about the plumb line laid them over the face above them. `along` is the
 * elevation from the centre (0 straight down … 1 the vertex), `around` the azimuth (0 the face, + the head's right), the
 * chart's `length` the meridian's arc at the head's mean radius. Metres.
 */
export function headSphere(head) {
  const L = head.landmarks, m = (p) => [p.x * STAND_M, p.y * STAND_M, p.z * STAND_M];
  const c = [0, ((L.g.y + L.op.y) / 2) * STAND_M, L.porionR.z * STAND_M];
  const r = ['vertex', 'me', 'g', 'op', 'euR', 'euL', 'zyR', 'zyL'].map((k) => Math.hypot(...m(L[k]).map((v, i) => v - c[i])));
  const R = r.reduce((a, b) => a + b, 0) / r.length;
  const of = (q) => { const dx = q[0] - c[0], dy = q[1] - c[1], dz = q[2] - c[2], h = Math.hypot(dx, dy), el = Math.atan2(dz, h); return { along: (el + Math.PI / 2) / Math.PI, around: ((Math.atan2(dx, dy) / (2 * Math.PI)) % 1 + 1) % 1, el, h, dx, dy }; };
  return { c, R, length: Math.PI * R, of };
}

/** The head's relations as marks on its chart (mm): X the arc about the plumb line at the face's radius (+ the head's
 * right), Y up the meridian (the sphere's `along` × its length), Z the true height above the menton (a cut's levels). */
export function headMarks(head) {
  const L = head.landmarks, m = (p) => [p.x * STAND_M, p.y * STAND_M, p.z * STAND_M], sp = headSphere(head);
  const cy = sp.c[1], r0 = (L.g.y * STAND_M - cy) * 1000, length = sp.length;
  const at = (p) => { const q = m(p), a = sp.of(q); return { X: Math.atan2(q[0], q[1] - cy) * r0, Y: a.along * length * 1000, Z: q[2] * 1000 }; };
  const names = ['vertex', 'trichion', 'g', 'n', 'rhinion', 'prn', 'sn', 'ls', 'sto', 'li', 'pg', 'me', 'op'];
  const sided = ['eye', 'en', 'ex', 'fz', 'cheek', 'malar', 'zy', 'al', 'ch', 'porion', 'go', 'condyle', 'eu'];
  const points = {};
  for (const k of names) if (L[k]) points[k] = at(L[k]);
  for (const k of sided) for (const s of ['L', 'R']) if (L[k + s]) points[k + s] = at(L[k + s]);
  return { r0, length, cy, points };
}

/**
 * The chart of a relational head: its skin surface-netted at `cells` along its longest side, welded (the net's quads
 * each carry their own corners), in metres, z up, +y the face, +x the head's right.
 */
export function relationalHeadChart(head, { cells = 110 } = {}) {
  const quads = headFieldMesh(head, { cells });
  const f = head.field, e = 1e-5;
  const grad = (c) => { const g = [f({ ...c, x: c.x + e }) - f({ ...c, x: c.x - e }), f({ ...c, y: c.y + e }) - f({ ...c, y: c.y - e }), f({ ...c, z: c.z + e }) - f({ ...c, z: c.z - e })], l = Math.hypot(...g) || 1; return g.map((v) => v / l); };
  const vertices = [], normals = [], skin = [], shut = [], faces = [], index = new Map();
  // a surface the head closes over (the teeth and the mouth's inside behind the lips, a nostril's inside, the lips' line):
  // marched out from the head's centre, it meets the head again within 3 cm. It stays skin, marked `enclosed`: it grows no
  // hair and is left out of a bake (it shares its address with the skin over it)
  // (marched out from the head's centre, not along the normal: the hollow under the lower lip faces up into the lip's
  // overhang, yet nothing lies beyond it outward; the teeth have the lips in front of them that way)
  const sc = headSphere(head).c.map((v) => v / STAND_M);
  const enclosed = (c) => { const d = [c.x - sc[0], c.y - sc[1], c.z - sc[2]], l = Math.hypot(...d) || 1; for (const mm of [2, 3.5, 5.5, 8, 12, 18, 26]) { const t = mm / 1000 / STAND_M / l; if (f({ x: c.x + d[0] * t, y: c.y + d[1] * t, z: c.z + d[2] * t }) < 0) return true; } return false; };
  const weld = (c) => {
    const k = `${Math.round(c.x * 1e6)},${Math.round(c.y * 1e6)},${Math.round(c.z * 1e6)}`;
    let i = index.get(k);
    if (i === undefined) { i = vertices.length; index.set(k, i); vertices.push([c.x * STAND_M, c.y * STAND_M, c.z * STAND_M]); const n = grad(c); normals.push(n); skin.push(!head.paint?.(c)); shut.push(enclosed(c, n)); }
    return i;
  };
  for (const q of quads) {
    const [a, b, c, d] = q.corners.map(weld);
    if (a !== b && b !== c && a !== c) faces.push([a, b, c]);
    if (a !== c && c !== d && a !== d) faces.push([a, c, d]);
  }
  return headChartOf(head, { vertices, faces, normals }, (vi) => skin[vi], (vi) => shut[vi]);
}

/**
 * The chart of a head MESH in the head's own frame (metres, z up, +y the face; its `normals` unit, one a vertex):
 * `skinAt(vi)` whether a vertex is skin (else no sample: a globe, a point the skin closes over), `shutAt(vi)` whether
 * the skin closes over it (`enclosed`), `shownAt(vi)` (default: the skin) whether it is seen, so a layer let down under
 * another casts and takes no occlusion. Addressed on the head's sphere with its marks, as `relationalHeadChart`'s: the
 * surface net's, or the realistic hero's grid head read back into the head's frame (epidermis/dermal-hero.js).
 */
export function headChartOf(head, { vertices, faces, normals }, skinAt, shutAt = () => false, { shownAt = null } = {}) {
  const M = headMarks(head), sp = headSphere(head);
  const axis = [[0, M.cy, 0], [0, M.cy, L_HEAD(head)]];
  const ear = earTest(head);
  const chart = chartFromMesh({ vertices, faces, normals }, (vi) => (skinAt(vi) ? 'head' : null), { head: { part: 'head', side: '', axis, marks: M, feature: (vi) => (ear(vertices[vi]) ? 'ear' : undefined) } });
  // re-addressed on the sphere: `along` the elevation, `ta` up the meridian; the girth by the sphere's own rings
  const bins = Array.from({ length: 12 }, () => [0, 0]);
  chart.samples.forEach((s, vi) => {
    if (!s) return;
    const a = sp.of(vertices[vi]), n = s.n, hz = a.h > 1e-9 ? [a.dx / a.h, a.dy / a.h, 0] : [0, 1, 0];
    const up = [-Math.sin(a.el) * hz[0], -Math.sin(a.el) * hz[1], Math.cos(a.el)], dn = up[0] * n[0] + up[1] * n[1] + up[2] * n[2];
    const ta = [up[0] - n[0] * dn, up[1] - n[1] * dn, up[2] - n[2] * dn], tl = Math.hypot(...ta) || 1;
    s.along = a.along; s.ta = ta.map((v) => v / tl); s.length = sp.length;
    const b = Math.min(11, Math.floor(a.along * 12)); bins[b][0] += a.h; bins[b][1]++;
  });
  const girths = bins.map(([h, k]) => (k ? (2 * Math.PI * h) / k : 0)), gmax = Math.max(...girths);
  for (let i = 0; i < 12; i++) if (!girths[i]) girths[i] = gmax * Math.sin((Math.PI * (i + 0.5)) / 12);
  chart.parts.head = { ...chart.parts.head, length: sp.length, girths, girth: gmax };
  chart.samples.forEach((s) => { if (s) s.girth = girths[Math.min(11, Math.floor(s.along * 12))]; });
  chart.samples.forEach((s, vi) => { if (s && shutAt(vi)) s.enclosed = true; });
  // the occlusion each skin point sits in, read from the mesh (a game bakes it into the skin's colour: the sockets, the
  // nostrils, the lips' line, the ear's folds, under the jaw)
  chart.ao = meshOcclusion(vertices, normals, { skin: shownAt ? (vi) => !!chart.samples[vi] && shownAt(vi) : (vi) => !!chart.samples[vi] });
  return chart;
}

/**
 * Which points are the EAR (a feature: no hair grows on it, the beard stops at it): the pinna stands off the skull, so
 * a point is the ear's where it lies in the box from the tragion back to the helix and from under the lobe to the ear's
 * top, and further out than the skin at the porion by more than the ear's own root (3 mm). Metres in, a boolean out.
 */
export function earTest(head) {
  const L = head.landmarks, S = STAND_M, tr = L.tragionR, top = L.earTopR, por = L.porionR;
  const y0 = (tr.y + 0.004 / S) * S, y1 = (tr.y - 0.034 / S) * S, z0 = (tr.z - 0.03 / S) * S, z1 = (top.z + 0.006 / S) * S, x0 = (por.x + 0.003 / S) * S;
  return (p) => Math.abs(p[0]) > x0 && p[1] <= y0 && p[1] >= y1 && p[2] >= z0 && p[2] <= z1;
}
