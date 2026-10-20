/**
 * DERMAL HEAD — the realistic register's head (polygonizer/head-relational.js) as a dermal chart (dermal-chart.js):
 * the shape the texturizer is built for. The head's field is surface-netted and welded into a mesh in metres (its
 * normals the field's gradient), the globes left off the skin (`paint`), and every vertex addressed on a plumb axis
 * through the middle of glabella and opisthocranion, menton to vertex (skin-head.js's chart: `along` the height,
 * `around` the angle about it). The head's RELATIONS ride with the chart as MARKS: each landmark's place on the face
 * in millimetres (X the arc at the face's radius, + the head's right; Y up from the menton), so the dermal map lays the
 * hairline from the trichion, the temples from the brow's outer ends, the sideburn and the ear from the porion, the
 * nose down its dorsum, the lids about the eyes, the cheeks on their apexes, the lips about the stomion and the mouth's
 * corners, the beard's cheek line from the ear's front to the mouth's corner. An action that moves a relation moves
 * the skin's layout with it.
 *
 *   relationalHeadChart(head, { cells })  → a chart (one part, `head`, its `marks`; the ear's points its `ear` feature)
 *   headMarks(head)                       → { r0, length, cy, points: { name: { X, Y } } } (mm)
 *
 * Pure: the field and its relations in, a mesh and addresses out; no dice, no clock.
 */
import { headFieldMesh } from '../polygonizer/head-field-view.js';
import { chartFromMesh } from './dermal-chart.js';

/** metres in a STAND unit (the protoform's frame: 1 unit = 1.8 m) */
export const STAND_M = 1.8;

/** The head's relations as marks on its chart (mm): X the arc about the plumb axis at the face's radius, Y the height. */
export function headMarks(head) {
  const L = head.landmarks, m = (p) => [p.x * STAND_M, p.y * STAND_M, p.z * STAND_M];
  const cy = ((L.g.y + L.op.y) / 2) * STAND_M, r0 = (L.g.y * STAND_M - cy) * 1000, length = L.H * STAND_M;
  const at = (p) => { const q = m(p); return { X: Math.atan2(q[0], q[1] - cy) * r0, Y: q[2] * 1000 }; };
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
  const vertices = [], normals = [], skin = [], faces = [], index = new Map();
  const weld = (c) => {
    const k = `${Math.round(c.x * 1e6)},${Math.round(c.y * 1e6)},${Math.round(c.z * 1e6)}`;
    let i = index.get(k);
    if (i === undefined) { i = vertices.length; index.set(k, i); vertices.push([c.x * STAND_M, c.y * STAND_M, c.z * STAND_M]); normals.push(grad(c)); skin.push(!head.paint?.(c)); }
    return i;
  };
  for (const q of quads) {
    const [a, b, c, d] = q.corners.map(weld);
    if (a !== b && b !== c && a !== c) faces.push([a, b, c]);
    if (a !== c && c !== d && a !== d) faces.push([a, c, d]);
  }
  const M = headMarks(head);
  const axis = [[0, M.cy, 0], [0, M.cy, M.length]];
  const ear = earTest(head);
  return chartFromMesh({ vertices, faces, normals }, (vi) => (skin[vi] ? 'head' : null), { head: { part: 'head', side: '', axis, marks: M, feature: (vi) => (ear(vertices[vi]) ? 'ear' : undefined) } });
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
