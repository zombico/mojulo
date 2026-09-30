// construction/soft — the soft parts of a piece: cushions, pillows, bolsters and the padding over a frame, fluffed from
// the field primitives (polygonizer/field-terms.js) and surfaced by the surface-net polygonizer. A soft part is not a
// member: it carries no load in the span check and takes no joint; it rests on something and goes in last.
//
//   soft: [{ id, kind, box: { min, max } (the frame's unit), …
//     kind 'cushion': style? ('boxed' | 'knife' | 'bench'), crown?, round?, piping? (true | false | '#hex'),
//                     tufting? { pattern: 'diamond' | 'grid', rows, cols, depth? }
//     kind 'pillow':  a knife-edge throw or back pillow (every edge a seam, the corners points); piping?
//     kind 'bolster': a round cushion along the box's longest side, flat ends piped
//     kind 'pad':     tight padding over a member (an arm, a back); roll? (a rolled arm: true, or 'left' | 'right', the
//                     way it rolls over), crown?, tufting? (on its front)
//     kind 'custom':  terms: the field primitives as written (field-terms.js), in the frame's unit, the box's centre at
//                     the origin — fluff anything
//     any: tilt? (degrees about x: a back cushion leans back), fill?, fabric? (fabric.js), on? (what it rests on),
//          rest? ('down' | 'back': the way it goes in), group? }]
//
// How each is fluffed (all in the term language, so the report's `terms` can be copied into a `custom` part):
//   · a boxed cushion is a rounded box smooth-unioned with a flattened ellipsoid (the crown, top and bottom), its seams
//     where the top and bottom plates meet the boxing — the 45° point of the rounded edge — and its piping a cord there;
//   · a pillow is two superellipse extrusions crossed and smooth-intersected: each closes to a seam along two opposite
//     edges, so all four edges are seams and the corners come to points (a knife cushion is the same, fuller);
//   · a bolster is a round extrusion with rounded ends; a pad a rounded box with a small crown (a rolled arm adds a
//     capsule along its top);
//   · tufting smooth-subtracts a dimple at each button (a diamond grid staggers alternate rows) and, between buttons,
//     a shallow capsule for the pleat; the buttons are their own small parts.
// A part whose box is thinnest in y (a back cushion standing up) is fluffed in its own frame, its face toward the front.
//
// Fills: high-resilience and polyether foams by density (kg/m³) and 40 % indentation hardness (N, EN ISO 2439) with a
// support factor (the 65 % hardness over the 25 %), and loose fills. A seat cushion sinks under a sitter by a two-slope
// curve through those hardnesses (`est`: the foam's curve varies by maker). Mass is the fill's plus the cover's.
import { composeFieldTerms, validateFieldTerms } from '../polygonizer/field-terms.js';
import { surfaceNetFaces } from '../polygonizer/field-mesh.js';
import { shadeHexMat } from '../polygonizer/vexar.js';
import { frustumPolys, tubePolys } from './prims.js';
import { resolveFabric, fabricTile, fabricError } from './fabric.js';
import { hexRgb, rgbHex } from './timber.js';
import * as dmath from '../../util/dmath.js';

export const SOFT_KINDS = Object.freeze(['cushion', 'pillow', 'bolster', 'pad', 'custom']);
export const FILLS = Object.freeze({
  'foam-hr40': { title: 'high-resilience foam 40 kg/m³', kind: 'foam', density: 40, h40: 200, support: 2.6, est: true },
  'foam-hr35': { title: 'high-resilience foam 35 kg/m³', kind: 'foam', density: 35, h40: 170, support: 2.4, est: true },
  'foam-30': { title: 'polyether foam 30 kg/m³', kind: 'foam', density: 30, h40: 130, support: 1.9, est: true },
  fibre: { title: 'hollow-fibre fill', kind: 'loose', density: 18, sink: 0.5, est: true },
  feather: { title: 'feather and down', kind: 'loose', density: 24, sink: 0.6, est: true },
});
const DEFAULT_FILL = { cushion: 'foam-hr35', pad: 'foam-30', pillow: 'fibre', bolster: 'fibre', custom: 'fibre' };
// a sitter as the foam feels them: 75 kg, three quarters of it on the seat, spread over 0.13 m² of seat — about a
// 200 mm indenter's worth of the standard's test load in every 0.031 m² (est)
const SITTER = { kg: 75, onSeat: 0.75, contactM2: 0.13, indenterM2: Math.PI * 0.1 * 0.1 };
const COVER_KG_M2 = 0.45;                                   // an upholstery cloth, 300–500 g/m² (est)
const G = 9.81;

const isHex = (v) => typeof v === 'string' && !!hexRgb(v);
const num = (v) => Number.isFinite(v) && v >= 0;

/** Validate a frame's `soft` → string[]. `unitScale` metres per unit; `taken` ids already used by members. */
export function validateSoft(soft, at, { unitScale, taken = new Set() } = {}) {
  const e = [];
  if (soft === undefined) return e;
  if (!Array.isArray(soft)) return [`${at}: an array of { id, kind, box }`];
  const ids = new Set();
  soft.forEach((s, i) => {
    const st = `${at}[${i}]`;
    if (!s || typeof s !== 'object') { e.push(`${st}: an object { id, kind, box }`); return; }
    if (typeof s.id !== 'string' || !s.id || s.id.includes(':')) e.push(`${st}.id: a non-empty name without ':'`);
    else if (ids.has(s.id) || taken.has(s.id)) e.push(`${st}.id: '${s.id}' is used twice`);
    else ids.add(s.id);
    if (!SOFT_KINDS.includes(s.kind)) e.push(`${st}.kind: one of ${SOFT_KINDS.join(', ')}`);
    const b = s.box;
    if (!b || !Array.isArray(b.min) || !Array.isArray(b.max) || b.min.length !== 3 || b.max.length !== 3 || ![...b.min, ...b.max].every(Number.isFinite)) { e.push(`${st}.box: { min: [x, y, z], max: [x, y, z] } in the frame's unit`); return; }
    if (b.min.some((v, k) => (b.max[k] - v) * unitScale < 0.02)) e.push(`${st}.box: every side at least 20 mm`);
    if (s.style !== undefined && !(s.kind === 'cushion' && ['boxed', 'knife', 'bench'].includes(s.style))) e.push(`${st}.style: a cushion's 'boxed', 'knife' or 'bench'`);
    for (const k of ['crown', 'round']) if (s[k] !== undefined && !num(s[k])) e.push(`${st}.${k}: a size ≥ 0 in the frame's unit`);
    if (s.piping !== undefined && typeof s.piping !== 'boolean' && !isHex(s.piping)) e.push(`${st}.piping: true, false, or a colour '#rrggbb'`);
    if (s.tufting !== undefined) {
      const t = s.tufting;
      if (!t || typeof t !== 'object' || !['diamond', 'grid'].includes(t.pattern || 'diamond') || !(Number.isInteger(t.rows) && t.rows >= 1 && t.rows <= 8) || !(Number.isInteger(t.cols) && t.cols >= 1 && t.cols <= 16) || (t.depth !== undefined && !num(t.depth)) || (t.button !== undefined && !isHex(t.button))) e.push(`${st}.tufting: { pattern: 'diamond' | 'grid', rows (1–8), cols (1–16), depth?, button? '#rrggbb' }`);
      else if (!['cushion', 'pad'].includes(s.kind)) e.push(`${st}.tufting: a cushion or a pad is tufted`);
    }
    if (s.roll !== undefined && !(s.kind === 'pad' && [true, false, 'left', 'right'].includes(s.roll))) e.push(`${st}.roll: a pad's true, 'left' or 'right' (a rolled arm, rolling over toward −x or +x), or false`);
    if (s.tilt !== undefined && !(Number.isFinite(s.tilt) && Math.abs(s.tilt) <= 45)) e.push(`${st}.tilt: degrees about x, −45 to 45`);
    if (s.fill !== undefined && !FILLS[s.fill]) e.push(`${st}.fill: one of ${Object.keys(FILLS).join(', ')}`);
    if (fabricError(s.fabric)) e.push(`${st}.${fabricError(s.fabric)}`);
    if (s.on !== undefined && typeof s.on !== 'string') e.push(`${st}.on: the id of the member or soft part it rests on`);
    if (s.rest !== undefined && !['down', 'back'].includes(s.rest)) e.push(`${st}.rest: 'down' or 'back'`);
    if (s.group !== undefined && !(typeof s.group === 'string' && s.group)) e.push(`${st}.group: a name`);
    if (s.kind === 'custom') {
      if (!Array.isArray(s.terms) || !s.terms.length) e.push(`${st}.terms: the field primitives (a non-empty term list), in the frame's unit about the box's centre`);
      else e.push(...validateFieldTerms(s.terms, `${st}.terms`));
    } else if (s.terms !== undefined) e.push(`${st}.terms: only a 'custom' part is written in terms`);
  });
  return e;
}

// ── frames: a part's own axes ───────────────────────────────────────────────────────────────────────────────────

const AX = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dotV = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The part's frame: its centre (m), its axes as world vectors (X across, Y along, Z its thickness — a proper rotation),
 * its extents along them (m), then the tilt about world x. A cushion, pillow or pad is thickness-up unless it stands
 * thinnest in y (a back cushion, an upright pillow); a bolster runs along its longest side.
 */
export function softFrame(s, unitScale) {
  const lo = s.box.min.map((v) => v * unitScale), hi = s.box.max.map((v) => v * unitScale);
  const c = lo.map((v, k) => (v + hi[k]) / 2), ext = lo.map((v, k) => hi[k] - v);
  let X = 0, Y = 1, Z = 2;
  if (s.kind === 'bolster') { X = ext.indexOf(Math.max(...ext)); const rest = [0, 1, 2].filter((k) => k !== X); Y = rest[0]; Z = rest[1]; }
  let upright = false;
  if (s.kind !== 'custom' && s.kind !== 'bolster' && s.kind !== 'pad' && ext[1] < ext[2] && ext[1] < ext[0]) { X = 0; Y = 2; Z = 1; upright = true; }
  let ex = AX[X], ey = AX[Y], ez = AX[Z];
  // standing up, its thickness faces front (−y): its top face is the one a sitter leans on (and the one tufted)
  if (upright) ez = [0, -1, 0];
  if (dotV(crossV(ex, ey), ez) < 0) ey = ey.map((v) => -v);           // keep it a rotation
  const t = ((s.tilt || 0) * Math.PI) / 180, ct = dmath.cos(t), st = dmath.sin(t);
  const rx = (v) => [v[0], v[1] * ct + v[2] * st, -v[1] * st + v[2] * ct];  // a positive tilt leans the top back (+y)
  return { c, axes: [rx(ex), rx(ey), rx(ez)], size: [ext[X], ext[Y], ext[Z]], lo, hi };
}
const toWorld = (Fr, p) => [0, 1, 2].map((k) => Fr.c[k] + Fr.axes[0][k] * p[0] + Fr.axes[1][k] * p[1] + Fr.axes[2][k] * p[2]);
const toLocal = (Fr, w) => { const q = [w[0] - Fr.c[0], w[1] - Fr.c[1], w[2] - Fr.c[2]]; return [dotV(q, Fr.axes[0]), dotV(q, Fr.axes[1]), dotV(q, Fr.axes[2])]; };

// ── forms ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A superellipse (|u/a|ⁿ + |v/b|ⁿ = 1) as profile points. */
function superellipse(a, b, n, k = 40) {
  const pts = [];
  for (let i = 0; i < k; i++) {
    const t = (2 * Math.PI * i) / k, c = dmath.cos(t), s = dmath.sin(t);
    pts.push([Math.round(a * Math.sign(c) * dmath.pow(Math.abs(c), 2 / n) * 1e5) / 1e5, Math.round(b * Math.sign(s) * dmath.pow(Math.abs(s), 2 / n) * 1e5) / 1e5]);
  }
  return pts;
}
const r5 = (v) => Math.round(v * 1e5) / 1e5;

/** A rounded rectangle's outline in the XY plane at height z → closed path (m). */
function roundRectPath(hx, hy, r, z, per = 6) {
  const out = []; const cs = [[hx - r, hy - r, 0], [-(hx - r), hy - r, 1], [-(hx - r), -(hy - r), 2], [hx - r, -(hy - r), 3]];
  for (const [cx, cy, q] of cs) for (let i = 0; i <= per; i++) { const a = (Math.PI / 2) * (q + i / per); out.push([cx + r * dmath.cos(a), cy + r * dmath.sin(a), z]); }
  return out;
}

/**
 * The form in the part's own frame (metres): { terms, seams: [closed paths], tufts: [{ at, n }], face (+Z | −Y) }.
 * `terms` are field primitives about the origin.
 */
export function softForm(s, size, unitScale) {
  const [w, l, t] = size;
  const u = unitScale;
  if (s.kind === 'custom') return { terms: scaleTerms(s.terms, u), seams: [], custom: true };
  if (s.kind === 'bolster') {
    const R = Math.min(l, t) / 2, rr = Math.min(0.35 * R, 0.03);
    const ends = w / 2 - rr * (1 - Math.SQRT1_2);
    return {
      terms: [{ id: 'body', op: 'add', shape: { kind: 'extrude', axisFrom: [r5(-w / 2 + rr), 0, 0], axisTo: [r5(w / 2 - rr), 0, 0], profile: { points: superellipse(R - rr, R - rr, 2, 32) } } }, { op: 'round', radius: r5(rr) }],
      seams: [-1, 1].map((sg) => Array.from({ length: 25 }, (_, i) => { const a = (2 * Math.PI * i) / 24; return [sg * ends, (R - rr * (1 - Math.SQRT1_2)) * dmath.cos(a), (R - rr * (1 - Math.SQRT1_2)) * dmath.sin(a)]; })),
    };
  }
  if (s.kind === 'pillow' || (s.kind === 'cushion' && s.style === 'knife')) {
    // two superellipse extrusions crossed: each closes to a seam along two opposite edges
    const n = s.kind === 'pillow' ? 2.6 : 5;
    const e1 = { kind: 'extrude', axisFrom: [0, r5(-l / 2 - 0.01), 0], axisTo: [0, r5(l / 2 + 0.01), 0], profile: { points: superellipse(w / 2, t / 2, n) } };
    const e2 = { kind: 'extrude', axisFrom: [r5(-w / 2 - 0.01), 0, 0], axisTo: [r5(w / 2 + 0.01), 0, 0], profile: { points: superellipse(l / 2, t / 2, n) } };
    return { terms: [{ id: 'body', op: 'add', shape: e1 }, { id: 'body2', op: 'intersect', blend: r5(0.18 * t), shape: e2 }], seams: [roundRectPath(w / 2 - 0.004, l / 2 - 0.004, 0.004, 0, 2)] };
  }
  // boxed cushions, benches and pads: a rounded box and a crown
  const pad = s.kind === 'pad';
  const r = Number.isFinite(s.round) ? s.round * u : pad ? Math.min(0.25 * Math.min(w, l, t), 0.03) : Math.min(0.3 * t, 0.04);
  const c = Number.isFinite(s.crown) ? s.crown * u : pad ? Math.min(0.05 * t, 0.01) : Math.min(0.1 * t, 0.02);
  const terms = [{ id: 'body', op: 'add', shape: { kind: 'box', center: [0, 0, 0], size: [r5(w), r5(l), r5(t)], round: r5(Math.min(r, Math.min(w, l, t) / 2 - 1e-4)) } }];
  if (c > 0) {
    // the crown: a flattened ellipsoid reaching c past the top (and, for a cushion, the bottom) at the middle
    const zc = pad ? t / 2 - (t / 2 + c) * 0.5 : 0, rz = pad ? (t / 2 + c) * 0.5 + c : t / 2 + c;
    // its footprint stays a blend's width inside the sides, so the blend does not swell them
    const k = Math.min(0.6 * r, 0.03);
    terms.push({ id: 'crown', op: 'add', blend: r5(k), shape: { kind: 'ellipsoid', center: [0, 0, r5(zc)], radii: [r5(Math.min(w * 0.47, w / 2 - 1.5 * k)), r5(Math.min(l * 0.47, l / 2 - 1.5 * k)), r5(rz)] } });
  }
  if (pad && s.roll) {
    // a rolled arm: a round along the top, standing a little proud of both sides
    const R = 0.68 * (w / 2), out = s.roll === 'left' ? -0.22 * (w / 2) : s.roll === 'right' ? 0.22 * (w / 2) : 0;
    terms.push({ id: 'roll', op: 'add', blend: 0.03, shape: { kind: 'capsule', a: [r5(out), r5(-l / 2 + R), r5(t / 2 - R * 0.75)], b: [r5(out), r5(l / 2 - R), r5(t / 2 - R * 0.75)], radius: r5(R) } });
  }
  const e = r * (1 - Math.SQRT1_2), off = r * Math.SQRT1_2;
  const seams = pad ? [] : [-1, 1].map((sg) => roundRectPath(w / 2 - r + off, l / 2 - r + off, off, sg * (t / 2 - e)));
  return { terms, seams, faceAxis: pad ? 'front' : 'top' };
}

/** Custom terms in the frame's unit → the same terms in metres. */
function scaleTerms(terms, u) {
  const S = (v) => (Array.isArray(v) ? v.map(S) : typeof v === 'number' ? v * u : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'kind' || k === 'op' || k === 'id' || k === 'strength' || k === 'octaves' || k === 'persistence' || k === 'seed' || k === 'turns' ? x : S(x)])) : v);
  return terms.map(S);
}

/** Tuft points on the tufted face, each with the dimple terms (metres, the part's frame). */
function tufting(s, size, surface, u) {
  const T = s.tufting; if (!T) return { terms: [], tufts: [] };
  const [w, l, t] = size;
  const front = s.kind === 'pad';                                      // a pad is tufted on its front (−Y)
  const A = w, B = front ? t : l;                                      // the face's two sides
  const margin = 0.12;
  const depth = Number.isFinite(T.depth) ? T.depth * u : Math.min(0.035, 0.25 * (front ? l : t));
  const pts = [];
  for (let r = 0; r < T.rows; r++) {
    const stagger = T.pattern !== 'grid' && r % 2 === 1;
    const n = stagger ? T.cols - 1 : T.cols;
    for (let k = 0; k < n; k++) {
      const fa = T.cols === 1 ? 0.5 : (k + (stagger ? 0.5 : 0)) / (T.cols - 1);
      const fb = T.rows === 1 ? 0.5 : r / (T.rows - 1);
      pts.push([(-A / 2 + margin * A) + fa * A * (1 - 2 * margin), (-B / 2 + margin * B) + fb * B * (1 - 2 * margin), r]);
    }
  }
  // each point pressed onto the surface along the face's normal
  const at = pts.map(([a, b, row]) => {
    const dir = front ? [0, -1, 0] : [0, 0, 1];
    const base = front ? [a, 0, b] : [a, b, 0];
    let lo = 0, hi = (front ? l : t) / 2 + 0.05;                        // inside … outside along dir
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; const p = base.map((v, k) => v + dir[k] * m); if (surface(p) < 0) lo = m; else hi = m; }
    return { p: base.map((v, k) => v + dir[k] * lo), n: dir, row };
  });
  const terms = at.map((q, i) => ({ op: 'stroke', at: q.p.map(r5), radius: r5(depth), strength: -1, blend: r5(depth * 0.9), id: `tuft${i}` }));
  // pleats: a shallow crease from each button to its neighbours in the next row (the diamond), or along rows and columns
  const pleat = [];
  for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
    const a = at[i], b = at[j]; const d = dmath.hypot(...a.p.map((v, k) => v - b.p[k]));
    const next = T.pattern === 'grid' ? d < 1.05 * Math.min(A * (1 - 2 * margin) / Math.max(1, T.cols - 1), B * (1 - 2 * margin) / Math.max(1, T.rows - 1)) : Math.abs(a.row - b.row) === 1 && d < 1.2 * dmath.hypot(A * (1 - 2 * margin) / Math.max(1, T.cols - 1) / 2, B * (1 - 2 * margin) / Math.max(1, T.rows - 1));
    if (!next) continue;
    const rr = depth * 0.35; const lift = (q) => q.p.map((v, k) => r5(v + q.n[k] * rr * 0.4));
    pleat.push({ op: 'subtract', blend: r5(rr), shape: { kind: 'capsule', a: lift(a), b: lift(b), radius: r5(rr) } });
    pleat.push([a, b]);
  }
  return { terms: [...terms, ...pleat.filter((x) => !Array.isArray(x))], tufts: at, pleats: pleat.filter(Array.isArray), depth };
}

// ── the sink ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** How far (mm) a seat cushion of `tMm` sinks under the sitter. */
export function sinkMm(fillKey, tMm) {
  const f = FILLS[fillKey];
  if (f.kind === 'loose') return Math.round(f.sink * tMm);
  const F = SITTER.kg * G * SITTER.onSeat * (SITTER.indenterM2 / SITTER.contactM2);
  const h25 = f.h40 / 1.3, h65 = f.support * h25;
  const curve = [[0, 0], [0.05, 0.6 * h25], [0.25, h25], [0.4, f.h40], [0.65, h65], [0.8, 3 * h65]];
  for (let i = 1; i < curve.length; i++) if (F <= curve[i][1]) { const [e0, f0] = curve[i - 1], [e1, f1] = curve[i]; return Math.round((e0 + ((F - f0) / (f1 - f0)) * (e1 - e0)) * tMm); }
  return Math.round(0.8 * tMm);
}

// ── lowering ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * lowerSoft(s, { unitScale, light, mat, fabric, railroad, cellM, mode }) → { faces, row, extras: [group ids] }.
 * Faces in the recipe's unit, each with `group` (the part's id; `:piping`, `:buttons`), uv over the fabric's tile
 * (box-projected in the part's frame: v runs up the cloth — front to back on a seat, bottom to top on a front — and
 * `railroad` turns it), and the fabric's texture key unless `mode` is 'flat'.
 */
export function lowerSoft(s, { unitScale, light, mat, fabric: frameFabric, railroad = false, cellM = 0.02, mode = 'full' }) {
  const Fr = softFrame(s, unitScale);
  const form = softForm(s, Fr.size, unitScale);
  let composed = composeFieldTerms(form.terms);
  const tuft = s.tufting ? tufting(s, Fr.size, (p) => composed.d({ x: p[0], y: p[1], z: p[2] }), unitScale) : { terms: [], tufts: [] };
  if (tuft.terms.length) composed = composeFieldTerms([...form.terms, ...tuft.terms]);
  const fabricSpec = s.fabric !== undefined ? s.fabric : frameFabric !== undefined ? frameFabric : 'linen';
  const R = resolveFabric(fabricSpec); const tile = fabricTile(fabricSpec);
  // world bounds: the canonical bounds' corners carried out, padded two cells
  const b = composed.bounds; const pts = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(toWorld(Fr, [x, y, z]));
  const wl = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k]))), wh = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
  const longest = Math.max(...wh.map((v, k) => v - wl[k]));
  // a flat pad reads at a coarser grid than a crowned cushion; tufting needs a finer one for its dimples
  const cell = s.tufting ? Math.min(cellM, Math.max(0.012, cellM * 0.45)) : s.kind === 'pad' && !s.roll ? cellM * 1.5 : cellM;
  const cells = Math.max(16, Math.min(128, Math.round(longest / cell)));
  const h = longest / cells;
  const bounds = { min: { x: wl[0] - 2 * h, y: wl[1] - 2 * h, z: wl[2] - 2 * h }, max: { x: wh[0] + 2 * h, y: wh[1] + 2 * h, z: wh[2] + 2 * h } };
  const field = (p) => { const q = toLocal(Fr, [p.x, p.y, p.z]); return composed.d({ x: q[0], y: q[1], z: q[2] }); };
  const quads = surfaceNetFaces(field, bounds, { cells });
  const inv = 1 / unitScale;
  const peak = [0, 1, 2].map((k) => Math.max(...[...R.warp, ...R.weft].map((c) => c[k])));
  const peakHex = rgbHex(peak), meanHex = rgbHex(R.meanRgb);
  const textured = mode !== 'flat' && !!tile;
  const [tu, tv] = railroad ? [tile.tileM[1], tile.tileM[0]] : tile.tileM;
  const faces = []; let area = 0, vol = 0;
  for (const q of quads) {
    const W = q.corners.map((c) => [c.x, c.y, c.z]);
    // area and the divergence-theorem volume, from the two triangles
    for (const [a, b2, c] of [[W[0], W[1], W[2]], [W[0], W[2], W[3]]]) {
      const cr = crossV([b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
      area += dmath.hypot(...cr) / 2; vol += dotV(a, crossV(b2, c)) / 6;
    }
    const face = { corners: W.map((c) => c.map((v) => v * inv)), fill: shadeHexMat(textured ? peakHex : meanHex, q.n, mat, { light }), doubleSided: true, outNormal: q.n, group: s.id };
    if (textured) {
      const L = W.map((c) => toLocal(Fr, c)); const nl = [dotV(q.n, Fr.axes[0]), dotV(q.n, Fr.axes[1]), dotV(q.n, Fr.axes[2])].map(Math.abs);
      const [iu, iv] = nl[2] >= nl[0] && nl[2] >= nl[1] ? [0, 1] : nl[1] >= nl[0] ? [0, 2] : [1, 2];
      const uv = L.map((c) => (railroad ? [c[iv] / tu + 0.5, c[iu] / tv + 0.5] : [c[iu] / tu + 0.5, c[iv] / tv + 0.5]).map((v) => Math.round(v * 1e4) / 1e4));
      Object.assign(face, { texture: tile.key, uv, textureLit: true });
    }
    faces.push(face);
  }
  const extras = [];
  // piping along each seam
  if (s.piping !== undefined && s.piping !== false && form.seams.length) {
    const hex = isHex(s.piping) ? s.piping : rgbHex(R.meanRgb.map((v) => v * 0.9));
    const cord = 0.0032;
    for (const path of form.seams) for (const p of tubePolys(path.map((c) => toWorld(Fr, c)), cord, { closed: true })) faces.push({ corners: p.corners.map((c) => c.map((v) => v * inv)), fill: shadeHexMat(hex, p.n, mat, { light }), doubleSided: true, outNormal: p.n, group: `${s.id}:piping` });
    extras.push(`${s.id}:piping`);
  }
  // buttons, one in each dimple
  if (tuft.tufts.length) {
    const hex = s.tufting.button || rgbHex(R.meanRgb.map((v) => v * 0.82));
    for (const t of tuft.tufts) {
      const base = toWorld(Fr, t.p.map((v, k) => v - t.n[k] * 0.002)), dirW = [0, 1, 2].map((k) => Fr.axes[0][k] * t.n[0] + Fr.axes[1][k] * t.n[1] + Fr.axes[2][k] * t.n[2]);
      const at = (d) => base.map((v, k) => v + dirW[k] * d);
      for (const p of [...frustumPolys(at(0), at(0.004), 0.011, 0.01, 10), ...frustumPolys(at(0.004), at(0.007), 0.01, 0.004, 10)]) faces.push({ corners: p.corners.map((c) => c.map((v) => v * inv)), fill: shadeHexMat(hex, p.n, mat, { light }), doubleSided: true, outNormal: p.n, group: `${s.id}:buttons` });
    }
    extras.push(`${s.id}:buttons`);
  }
  const fillKey = s.fill || DEFAULT_FILL[s.kind];
  const fill = FILLS[fillKey];
  const volM3 = Math.abs(vol);
  const mm = (v) => Math.round(v * 1000);
  const sizeMm = Fr.size.map(mm);
  const upright = Math.abs(Fr.axes[2][2]) > 0.9;
  const row = {
    id: s.id, kind: s.kind, ...(s.style ? { style: s.style } : {}), fill: fillKey, sizeMm,
    volumeL: Math.round(volM3 * 10000) / 10, massKg: Math.round((volM3 * fill.density + area * COVER_KG_M2) * 100) / 100,
    ...(fill.kind === 'foam' && s.kind !== 'custom' ? { foamMm: s.kind === 'cushion' ? [sizeMm[0] + 10, sizeMm[1] + 10, sizeMm[2]] : sizeMm } : {}),
    ...(s.kind === 'pillow' || s.kind === 'bolster' ? { insertMm: sizeMm.map((v, k) => (k === 2 && s.kind === 'pillow' ? v : v + 50)) } : {}),
    ...(s.kind === 'cushion' && upright && (s.rest || 'down') === 'down' ? { sinkMm: sinkMm(fillKey, sizeMm[2]) } : {}),
    ...(s.piping !== undefined && s.piping !== false ? { piping: form.seams.length } : {}),
    ...(tuft.tufts.length ? { buttons: tuft.tufts.length } : {}),
    areaM2: Math.round(area * 1000) / 1000,
  };
  return { faces, row, extras, frame: Fr, form, fabric: R, pleats: (tuft.pleats || []).map(([a, b2]) => [toWorld(Fr, a.p), toWorld(Fr, b2.p)]) };
}
