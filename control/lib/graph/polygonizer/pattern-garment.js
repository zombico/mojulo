/**
 * PATTERN GARMENT — a garment CUT flat and SEWN onto a body (research:
 * 0913 garment-pattern-stitching; plan: pattern-garment.plan.md).
 *
 * Every garment in figure-garments.js is an offset shell of the body's own rings. This one
 * is the tailor's construction instead: PIECES are closed outlines in centimetres, each
 * placed on a body CHART (body-chart.js) by an anchor and its grain; SEAMS pair two named
 * piece edges; the sheet those pieces lie on is the recipe's 2D face. The 3D face is lowered
 * by closed-form maps only:
 *
 *   1. mesh    — a Coons patch over the piece's four outline runs (top/right/bottom/left),
 *                so an arbitrary quad-ish outline becomes a rows x columns grid whose every
 *                vertex knows its flat (x, y) in cm and, on the boundary, which edge it is on.
 *   2. place   — flat (x, y) - anchor -> arc lengths along and around -> the chart point,
 *                pushed out along the row's radial by `ease_cm`. Arc-length on both axes, so
 *                a piece lands without stretch along its own axes; the residual is measured.
 *   3. stitch  — for each seam, both edges are evaluated at the same arc fraction; the
 *                stitched position is their average (or one side's); the boundary deltas
 *                propagate inward along grid lines with a smoothstep falloff. Quadrature,
 *                not relaxation — no solver, no iteration.
 *
 * Output is the `sheet:true` ring-stack the mesher already renders two-sided (rows = rings),
 * plus a REPORT: girths, per-piece strain, per-seam ease in the tailor's words.
 *
 * Conventions: piece space is cm, +x toward the wearer's right, +y up (toward the chart
 * top); outlines are counter-clockwise; `u` lines and `v` landmarks are body-chart.js's.
 */

import { buildBodyCharts, chartPointAtArc, chartGirthAt, chartVAtZ, scaleChartRows, standoffScalesByChart, liftChartCap, crestZAt, rowRing, pushOutsideTube, resolveU, resolveV, CHART_IDS, U_LINES } from './body-chart.js';
import { draftSloper, sloperChart, SLOPER_KINDS } from './pattern-slopers.js';

export const PATTERN_DEFAULTS = Object.freeze({
  stature_cm: 170, ease_cm: 1.5, stitch_cm: 2, seam_influence_cm: 6, allowance_cm: 1,
  hang_sag: 0.5,   // cm of hung circumference given back per cm of drop below the widest row
  crest_rest_cm: 1,   // cloth RESTS on the shoulder crest at most this far above it (the cap's stand-off, never more than the ease)
});
export const RUN_NAMES = ['top', 'right', 'bottom', 'left'];
export const SEAM_EASE_KINDS = ['a', 'b', 'split'];
const MAX_GRID = 96, MIN_GRID = 3;
const TAU = Math.PI * 2;

const smoothstep = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

// -- outline geometry ---------------------------------------------------------
function signedArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }

function normalizeOutline(outline) {
  let pts = outline.map((p) => [+p[0], +p[1]]);
  if (pts.length > 1 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-9) pts = pts.slice(0, -1);
  const reversed = signedArea(pts) < 0;
  if (reversed) pts = pts.slice().reverse();
  return { pts, reversed };
}

// The four corners as outline indices. Auto = the diagonal extremes; `corners`
// overrides ([tl, tr, br, bl] as authored, already remapped to the CCW order).
function pickCorners(pts, corners) {
  const n = pts.length;
  if (Array.isArray(corners) && corners.length === 4) {
    const [tl, tr, br, bl] = corners.map((i) => ((i % n) + n) % n);
    return { tl, tr, br, bl };
  }
  const arg = (f) => { let best = 0; for (let i = 1; i < n; i++) if (f(pts[i]) > f(pts[best]) + 1e-9) best = i; return best; };
  return {
    tl: arg(([x, y]) => -x + y), tr: arg(([x, y]) => x + y),
    br: arg(([x, y]) => x - y), bl: arg(([x, y]) => -x - y),
  };
}

// A RUN is the outline walked CCW from index i0 to index i1 (inclusive), with its arc table.
function makeRun(pts, i0, i1) {
  const n = pts.length, idx = [i0];
  let i = i0;
  while (i !== i1) { i = (i + 1) % n; idx.push(i); if (idx.length > n + 1) break; }
  const arc = [0];
  for (let k = 1; k < idx.length; k++) { const a = pts[idx[k - 1]], b = pts[idx[k]]; arc.push(arc[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const length = arc[arc.length - 1];
  // point at fraction f of the run's arc -> [x, y] + the outline segment (start index, t)
  const at = (f) => {
    const s = Math.max(0, Math.min(1, f)) * length;
    let lo = 0, hi = idx.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arc[mid] <= s) lo = mid; else hi = mid; }
    const seg = arc[lo + 1] - arc[lo], t = seg > 1e-12 ? (s - arc[lo]) / seg : 0;
    const a = pts[idx[lo]], b = pts[idx[Math.min(lo + 1, idx.length - 1)]];
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, seg: idx[lo], t, s };
  };
  return { idx, arc, length, at };
}

// Cyclic index range test: is outline vertex k in the run i0 -> i1 (CCW), excluding the end?
function inRun(n, i0, i1, k) { let i = i0; while (i !== i1) { if (i === k) return true; i = (i + 1) % n; } return false; }

// -- piece compilation --------------------------------------------------------
function compilePiece(piece, defaults) {
  const { pts, reversed } = normalizeOutline(piece.outline);
  const n = pts.length;
  const remap = (i) => (reversed ? n - 1 - (((i % n) + n) % n) : ((i % n) + n) % n);
  const cornersIn = Array.isArray(piece.corners) ? piece.corners.map(remap) : null;
  const c = pickCorners(pts, cornersIn);
  const runs = {
    left: makeRun(pts, c.tl, c.bl), bottom: makeRun(pts, c.bl, c.br),
    right: makeRun(pts, c.br, c.tr), top: makeRun(pts, c.tr, c.tl),
  };
  // named edges: declared [i0, i1] runs (outline order as authored) + the four runs
  const edges = {};
  for (const k of RUN_NAMES) edges[k] = { i0: runs[k].idx[0], i1: runs[k].idx[runs[k].idx.length - 1] };
  if (piece.edges && typeof piece.edges === 'object') {
    for (const [name, pair] of Object.entries(piece.edges)) {
      if (!Array.isArray(pair) || pair.length !== 2) continue;
      const a = remap(pair[0]), b = remap(pair[1]);
      edges[name] = reversed ? { i0: b, i1: a } : { i0: a, i1: b };
    }
  }
  const edgeRuns = {};
  for (const [name, e] of Object.entries(edges)) edgeRuns[name] = makeRun(pts, e.i0, e.i1);
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const [x, y] of pts) { if (x < xMin) xMin = x; if (x > xMax) xMax = x; if (y < yMin) yMin = y; if (y > yMax) yMax = y; }
  const stitch = piece.stitch_cm ?? defaults.stitch_cm;
  const rows = Math.max(MIN_GRID, Math.min(MAX_GRID, Math.round((yMax - yMin) / stitch) + 1));
  const cols = Math.max(MIN_GRID, Math.min(MAX_GRID, Math.round((xMax - xMin) / stitch) + 1));
  return {
    id: piece.id, pts, n, corners: c, runs, edges, edgeRuns, rows, cols, stitch,
    bbox: { xMin, xMax, yMin, yMax }, area: Math.abs(signedArea(pts)),
    chart: piece.chart, anchor: piece.anchor ?? {}, ease: piece.ease_cm ?? defaults.ease_cm, rest: Math.min(piece.ease_cm ?? defaults.ease_cm, defaults.crest_rest_cm),
    influence: piece.seam_influence_cm ?? defaults.seam_influence_cm,
    grain: piece.grain ?? [0, 1], cloth: piece.cloth ?? null, notches: piece.notches ?? [], sloper: piece.sloper ?? null, mirrorOf: piece.mirrorOf ?? null,
    allowance: piece.allowance_cm ?? defaults.allowance_cm,
    join: piece.join && typeof piece.join === 'object' ? piece.join : null,
  };
}

// The Coons patch: flat (x, y) for grid (i, j), plus the boundary run each border vertex sits on.
function coonsGrid(cp) {
  const { runs, corners: c, pts, rows, cols } = cp;
  const TL = pts[c.tl], TR = pts[c.tr], BR = pts[c.br], BL = pts[c.bl];
  const top = (s) => runs.top.at(1 - s), bottom = (s) => runs.bottom.at(s);
  const left = (f) => runs.left.at(f), right = (f) => runs.right.at(1 - f);
  const flat = [], border = [];
  for (let i = 0; i < rows; i++) {
    const f = rows > 1 ? i / (rows - 1) : 0, rowF = [], rowB = [];
    const L = left(f), Rr = right(f);
    for (let j = 0; j < cols; j++) {
      const s = cols > 1 ? j / (cols - 1) : 0;
      const T = top(s), B = bottom(s);
      const x = (1 - f) * T.x + f * B.x + (1 - s) * L.x + s * Rr.x - ((1 - s) * (1 - f) * TL[0] + s * (1 - f) * TR[0] + (1 - s) * f * BL[0] + s * f * BR[0]);
      const y = (1 - f) * T.y + f * B.y + (1 - s) * L.y + s * Rr.y - ((1 - s) * (1 - f) * TL[1] + s * (1 - f) * TR[1] + (1 - s) * f * BL[1] + s * f * BR[1]);
      rowF.push([x, y]);
      const b = [];
      if (i === 0) b.push({ run: 'top', ...T });
      if (i === rows - 1) b.push({ run: 'bottom', ...B });
      if (j === 0) b.push({ run: 'left', ...L });
      if (j === cols - 1) b.push({ run: 'right', ...Rr });
      rowB.push(b);
    }
    flat.push(rowF); border.push(rowB);
  }
  return { flat, border };
}

// Which named edge (if any) a boundary sample on outline segment `seg` at `t` belongs to,
// and the arc fraction along that edge.
function edgeParam(cp, name, seg, t) {
  const e = cp.edges[name]; if (!e) return null;
  if (!(inRun(cp.n, e.i0, e.i1, seg) || (seg === e.i1 && t <= 1e-9))) return null;
  const run = cp.edgeRuns[name], k = run.idx.indexOf(seg);
  if (k < 0) return null;
  const s = run.arc[k] + (run.arc[Math.min(k + 1, run.arc.length - 1)] - run.arc[k]) * t;
  return run.length > 1e-12 ? s / run.length : 0;
}

// -- placement ----------------------------------------------------------------
function placer(cp, chart, worldPerCm, anchor = cp.anchor, vOverride = null) {
  const a = anchor ?? {}, ap = Array.isArray(a.piece) ? a.piece : [0, 0];
  const uFrac = resolveU(a.chart?.u ?? 'cf');
  const vFrac = vOverride ?? resolveV(chart, a.chart?.v ?? 'top');
  const sAlong0 = (vFrac ?? 0) * chart.vTotal;
  const easeW = cp.ease * worldPerCm, restW = cp.rest * worldPerCm;
  // the piece's grain rotates the flat frame (default [0,1] = along the chart)
  const gx = cp.grain[0], gy = cp.grain[1], gl = Math.hypot(gx, gy) || 1;
  const cosA = gy / gl, sinA = gx / gl;   // rotate so the grain points +y
  // flat (x, y) -> the chart's (around, along) arcs in world units
  const arcs = (x, y) => {
    const dx0 = x - ap[0], dy0 = y - ap[1];
    const dx = dx0 * cosA - dy0 * sinA, dy = dx0 * sinA + dy0 * cosA;
    return { around: dx * worldPerCm, along: sAlong0 - dy * worldPerCm };
  };
  const place = (x, y) => {
    const { around, along } = arcs(x, y);
    const r = chartPointAtArc(place.chart, around, along, uFrac ?? 0, { ease: easeW, rest: restW });
    const k = easeW * (r.easeScale ?? 1);   // on the cap the stand-off turns up and shortens to the rest
    let q = { x: r.p.x + r.out.x * k, y: r.p.y + r.out.y * k, z: r.p.z + r.out.z * k, clipped: r.clipped };
    // the neck rises through the shoulder's cap and stands proud of the yoke's hull behind: cloth
    // anywhere in the neck's span keeps an ease off it (a no-op below the collar, where the trunk encloses it)
    if (place.neck) q = { ...pushOutsideTube(place.neck, q, easeW), clipped: q.clipped };
    return q;
  };
  place.chart = chart;   // swapped for the hang-scaled chart once every piece on it is known
  place.arcs = arcs;
  place.sAlong0 = sAlong0;
  place.anchorY = ap[1];
  return place;
}

// Flat width of a compiled piece at flat height y (the outline's horizontal extent there).
function flatWidthAt(cp, y) {
  const pts = cp.pts, n = pts.length;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
    if ((ay <= y && by > y) || (by <= y && ay > y)) { const x = ax + (bx - ax) * (y - ay) / (by - ay); if (x < lo) lo = x; if (x > hi) hi = x; }
  }
  return hi > lo ? hi - lo : 0;
}

// THE HANG RULE. Cloth cannot compress around the body: where the pieces on a chart sum
// wider than the body's girth (plus the ease ring), the cloth stands off by that ratio —
// and, being hung, it keeps standing off BELOW its widest row, tapering by `hang_sag`
// (cm of circumference per cm along; the suspension hullStacks uses). So a straight shift
// bags out at the waist instead of being crushed into it, and its hem hangs from the bust
// line. The deficit case (pieces narrower than the girth) is left alone and shows up as
// strain and as a seam gap — the pattern is too small, and the readout says so.
function hangScales(chart, parts, worldPerCm, sag) {
  const rows = chart.rows;
  const scales = new Array(rows.length).fill(1), hanging = new Array(rows.length).fill(false), ring = new Array(rows.length).fill(0), covered = new Array(rows.length).fill(false);
  const ease = Math.max(0, ...parts.map((pt) => pt.cp.ease)) * worldPerCm;   // the chart's ease ring — the same on every row, covered or not
  let prev = 0, started = false;   // the hung circumference of the row above (world units); cloth begins at the first covered row
  for (let i = 0; i < rows.length; i++) {
    const s = chart.vArc[i];
    let need = 0;
    for (const pt of parts) {
      const y = pt.place.anchorY + (pt.place.sAlong0 - s) / worldPerCm;
      if (y < pt.yLo || y >= pt.yHi) continue;   // this span of the piece lives on another chart
      const w = flatWidthAt(pt.cp, y);
      if (w > 0) need += w * worldPerCm;
    }
    const avail = rowRing(rows[i], ease);   // a cap row's ring shrinks with its upward stand-off
    if (need > 0) { started = true; covered[i] = true; }
    const dz = i > 0 ? chart.vArc[i] - chart.vArc[i - 1] : 0;
    const hung = started ? prev - sag * dz : 0;   // nothing hangs from rows the garment never reached (trousers start at the waist, not the shoulders)
    const C = Math.max(avail, need, hung);
    // scale the SKIN row so the ease ring (skin + 2π·ease) reaches C — scaling the ring's ratio
    // onto the skin would leave a small row (the groin) short of C by most of the ring
    scales[i] = (C - (avail - rows[i].girth)) / rows[i].girth;
    hanging[i] = i > 0 && C > avail + 1e-9;   // the body is not what holds this row out (the cloth above, or the piece's own width): cloth-shaped, not body-shaped
    ring[i] = C;
    prev = C;
  }
  return { scales, hanging, ring, ease, covered };
}

// The hung chart: a row the BODY holds out is the skin row scaled about its own centre; a row the
// CLOTH ABOVE holds out (`hanging`) is the row above's hung polygon carried straight down to this
// row's height and scaled to its circumference — cloth hangs from its widest row, it does not
// follow the body's rows inward (a skirt's front does not dive between the thighs where the trunk's
// rows shrink and shift back toward the seat).
function hangChart(chart, { scales, hanging, ring, ease }) {
  const rows = [];
  for (let i = 0; i < chart.rows.length; i++) {
    const row = chart.rows[i];
    if (!hanging[i] || !rows[i - 1]) { rows.push(scaleRow(row, scales[i])); continue; }
    const above = rows[i - 1], f = (ring[i] - TAU * ease) / (above.girth || 1e-9);
    const c = above.center;
    // a hull chart (the trunk) hangs with gravity: straight down; a tube chart (a limb) is held
    // by the limb itself and its cloth follows the limb's axis — a trouser leg swings with the leg
    const tube = chart.mode !== 'hull';
    const dz = row.center.z - above.center.z, ddx = tube ? row.center.x - above.center.x : 0, ddy = tube ? row.center.y - above.center.y : 0;
    // carried straight down and scaled to the hung circumference — then pushed out by the body
    // where the skin row beneath is wider in that direction (a bodice hanging from the shoulders
    // still drapes OVER the belly and the seat; it does not pass through them)
    const pts = above.pts.map((p) => {
      const q = { x: c.x + (p.x - c.x) * f + ddx, y: c.y + (p.y - c.y) * f + ddy, z: p.z + dz };
      const bc = row.center, dx = q.x - bc.x, dy = q.y - bc.y, rq = Math.hypot(dx, dy);
      if (rq < 1e-9) return q;
      const u = ((Math.atan2(dx, dy) / TAU) % 1 + 1) % 1;   // clockwise from +y, the hull's own u
      const b = rowPointAtArcLike(row, u * row.girth), rb = Math.hypot(b.x - bc.x, b.y - bc.y);
      return rb > rq ? { x: bc.x + dx * (rb / rq), y: bc.y + dy * (rb / rq), z: q.z } : q;
    });
    rows.push(makeRowLike({ x: c.x + ddx, y: c.y + ddy, z: row.center.z }, pts));
  }
  return { ...chart, rows };
}
// the point on a row at arc length s from its first point (wraps) — body-chart.js's reader, local
function rowPointAtArcLike(row, s) {
  const g = row.girth, n = row.pts.length;
  const t = ((s % g) + g) % g;
  let lo = 0, hi = n;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (row.arc[mid] <= t) lo = mid; else hi = mid; }
  const a = row.pts[lo], b = row.pts[(lo + 1) % n], seg = row.arc[lo + 1] - row.arc[lo];
  const f = seg > 1e-12 ? (t - row.arc[lo]) / seg : 0;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
}
function scaleRow(row, f) {
  if (Math.abs(f - 1) < 1e-12) return row;
  const c = row.center;
  return makeRowLike(c, row.pts.map((p) => ({ x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f, z: c.z + (p.z - c.z) * f })), row);
}
// `like` carries a cap row's parameter over: a scaled cap row is still the cap (up, not out)
function makeRowLike(center, pts, like = null) {
  const arc = [0];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; arc.push(arc[i] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)); }
  const row = { center, pts, arc, girth: arc[pts.length] };
  if (like && like.cap) row.cap = like.cap;
  return row;
}

const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// A chart's measures in cm for the slopers: girth at each landmark, the drop from the
// chart top to each landmark, and the chart's length.
export function chartMeasures(chart, worldPerCm, anchor = 'shoulder') {
  const girth = {}, drop = {};
  const v0 = chart.landmarks[anchor] ?? 0;   // drops are measured from the row a block anchors to
  for (const [k, v] of Object.entries(chart.landmarks)) { girth[k] = r2(chartGirthAt(chart, v) / worldPerCm); drop[k] = r2((v - v0) * chart.vTotal / worldPerCm); }
  const out = { girth, drop, above: r2(v0 * chart.vTotal / worldPerCm), length: r2((1 - v0) * chart.vTotal / worldPerCm) };
  // the shoulder line (the cap): `half_cm` is the crest ring's quarter arc — the cloth centimetres
  // from centre-front around the neck's base and out along the crest to the acromion, where the
  // ring's u = 0.25 is; `drop_cm` its drop from the neck's edge to the acromion (the tailor's
  // shoulder slope, measured, 0 on a flat yoke); `neck_cm` the neck's girth at its base
  if (chart.cap) {
    const { cx, W, rn, neckGirth } = chart.cap, zi = crestZAt(chart, cx + Math.max(rn, W / 3)), zo = crestZAt(chart, cx + W);
    out.crest = { half_cm: r2(chart.rows[0].girth / 4 / worldPerCm), drop_cm: zi != null && zo != null ? r2(Math.max(0, (zi - zo) / worldPerCm)) : 0, ...(neckGirth ? { neck_cm: r2(neckGirth / worldPerCm) } : {}) };
  }
  return out;
}

// Draft a `sloper` piece from the chart it will sit on; the author's explicit fields win.
function resolveSloperPiece(piece, charts, worldPerCm, warnings, defaults = PATTERN_DEFAULTS) {
  if (typeof piece.sloper !== 'string') return piece;
  const chartId = piece.chart ?? sloperChart(piece.sloper);
  const chart = charts[chartId];
  if (!chart) { warnings.push(`piece '${piece.id}': the body has no '${chartId}' chart to draft '${piece.sloper}' on — skipped`); return null; }
  const trouser = /^trouser-/.test(piece.sloper);
  const m = chartMeasures(chart, worldPerCm, chart.mode === 'tube' ? 'shoulder' : trouser ? 'waist' : 'top');   // a trunk block drafts from the top row, a trouser block from the waist, a limb block from the armscye
  if (trouser) {
    // the leg below the crotch: the trunk's crotch height matched onto the leg chart, girths and
    // drops below it — the block's `join` continues the piece there
    const legId = piece.join?.chart ?? 'legL';
    const leg = charts[legId];
    if (!leg) { warnings.push(`piece '${piece.id}': the body has no '${legId}' chart for '${piece.sloper}' — skipped`); return null; }
    const vC = chart.landmarks.crotch ?? 1;
    let lo = 0; while (lo < chart.rows.length - 2 && chart.vArc[lo + 1] / chart.vTotal <= vC) lo++;
    const vJoin = chartVAtZ(leg, chart.rows[lo].center.z);
    const lg = (v) => r2(chartGirthAt(leg, v) / worldPerCm), ld = (v) => r2(Math.max(0, v - vJoin) * leg.vTotal / worldPerCm);
    m.leg = { chart: legId, vJoin: r3(vJoin), girth: { thigh: lg(Math.max(vJoin, leg.landmarks.thigh ?? vJoin)), knee: lg(leg.landmarks.knee ?? 0.5), ankle: lg(1) }, drop: { knee: ld(leg.landmarks.knee ?? 0.5), ankle: ld(1) } };
  }
  // every block sees the whole tape: the neck's girth for a neckline, the arm's for a sleeve
  if (charts.neck) m.girth.neck = r2(chartGirthAt(charts.neck, 0.5) / worldPerCm);
  if (charts.armL || charts.armR) { const a = chartMeasures(charts.armL ?? charts.armR, worldPerCm, 'shoulder'); m.girth.upperArm = a.girth.shoulder; m.girth.wrist = a.girth.wrist ?? a.girth.bottom; if (chart.mode === 'tube') m.length = a.length; }   // a sleeve's length is the arm's below the armscye
  if (charts.trunk && chartId !== 'trunk') { const t = chartMeasures(charts.trunk, worldPerCm, 'shoulder'); for (const k of ['bust', 'waist', 'hip']) if (m.girth[k] == null) m.girth[k] = t.girth[k]; }
  // the cloth sits on the EASE RING, `ease_cm` off the skin: its circumference there is the girth
  // plus 2π·ease, and a block drafts to that — otherwise two halves overlap by the ring at every seam
  m.standoff = r2(TAU * (piece.ease_cm ?? defaults.ease_cm));
  const drafted = draftSloper(piece.sloper, m, piece.dials ?? {});
  if (drafted.outline.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) { warnings.push(`piece '${piece.id}': the '${piece.sloper}' block drafted a non-finite point from this body's tape — skipped`); return null; }
  const out = { ...drafted, ...piece, chart: chartId, edges: { ...drafted.edges, ...(piece.edges ?? {}) } };
  if (!Array.isArray(piece.outline)) out.outline = drafted.outline;
  if (!piece.anchor) out.anchor = drafted.anchor;
  if (!piece.corners) out.corners = drafted.corners;
  if (!piece.join && drafted.join) out.join = drafted.join;
  return out;
}

// -- seams --------------------------------------------------------------------
// An edge is walked from its HIGHER end (piece y) to its lower end so two sides of a
// seam correspond top -> bottom by default; `reverse` flips one side.
function edgeOrientation(cp, name) {
  const run = cp.edgeRuns[name];
  const a = run.at(0), b = run.at(1);
  if (Math.abs(a.y - b.y) > 1e-9) return a.y >= b.y ? 1 : -1;
  // a LEVEL edge walks from its end nearer the centre line outward, so a flat shoulder runs
  // neck → tip on the front and on the back alike (by x alone the two ran opposite ways)
  if (Math.abs(Math.abs(a.x) - Math.abs(b.x)) > 1e-9) return Math.abs(a.x) <= Math.abs(b.x) ? 1 : -1;
  return a.x <= b.x ? 1 : -1;
}
function edgeFlatAt(cp, name, t, orient) { return cp.edgeRuns[name].at(orient > 0 ? t : 1 - t); }

function seamLabel(easeCm) {
  const e = Math.abs(easeCm);
  return e <= 0.5 ? 'flat' : e <= 3 ? 'eased' : 'gathered';
}

/**
 * Build a pattern garment: every `fit:'pattern'` piece of `spec` meshed, placed, and
 * stitched on `body`.
 * @returns {{ stacks, report, underRanges }} — stacks are `sheet:true` ring-stacks;
 *   underRanges lists { stackIds, zLo, zHi } per chart for the caller's under-shell pass.
 */
export function buildPatternGarment(body, spec, { cloth = '#3f6f93', standBody = null, under = null } = {}) {
  const defaults = {
    ...PATTERN_DEFAULTS,
    ...(Number.isFinite(spec.stature_cm) ? { stature_cm: spec.stature_cm } : {}),
    ...(Number.isFinite(spec.ease_cm) ? { ease_cm: spec.ease_cm } : {}),
    ...(Number.isFinite(spec.stitch_cm) ? { stitch_cm: spec.stitch_cm } : {}),
  };
  const { charts, worldPerCm } = buildBodyCharts(body, { stature_cm: defaults.stature_cm });
  // THE DESIGNER'S RULE: a pattern is drafted on the STAND (the dress form) and worn on the
  // pose. Slopers read the stand body's charts, so the flat pieces — and the printable sheet —
  // are pose-invariant; placement and seams below run on the posed charts, and the residual
  // per pose is reported, not fought. Absent a stand body (or at rest) the two are one.
  const stand = standBody && standBody !== body ? buildBodyCharts(standBody, { stature_cm: defaults.stature_cm }) : { charts, worldPerCm };
  const warnings = [];
  // expand mirrors, then compile
  const raw = [];
  for (const p0 of spec.pieces) {
    if ((p0.fit ?? 'hug') !== 'pattern') continue;
    const piece = resolveSloperPiece(p0, stand.charts, stand.worldPerCm, warnings, defaults);
    if (!piece) continue;
    raw.push(piece);
    if (typeof piece.mirror === 'string') raw.push(mirrorPiece(piece, piece.mirror));
  }
  // A piece is one or two PARTS: its span on its chart, and — with a `join` — the span below
  // `join.y` on `join.chart` (a trouser leg: the trunk above the crotch, the leg below), anchored
  // there at the height the primary chart puts the join, unless the join names its own `v`.
  const pieces = [], parts = [];
  for (const piece of raw) {
    const chart = charts[piece.chart];
    if (!chart) { warnings.push(`piece '${piece.id}': the body has no '${piece.chart}' chart — skipped`); continue; }
    const cp = compilePiece(piece, defaults);
    cp.chartObj = chart;
    cp.place = placer(cp, chart, worldPerCm);
    cp.place.neck = chart.mode === 'hull' && charts.neck ? charts.neck : null;   // the neck the trunk's cloth must clear
    const { flat, border } = coonsGrid(cp);
    cp.flat = flat; cp.border = border;
    cp.parts = [{ cp, chartId: piece.chart, place: cp.place, yLo: -Infinity, yHi: Infinity }];
    if (cp.join) {
      const jc = charts[cp.join.chart];
      if (!jc) { warnings.push(`piece '${piece.id}': the body has no '${cp.join.chart}' chart for its join — the piece stays on '${piece.chart}'`); cp.join = null; }
      else {
        const ja = cp.join.anchor ?? { piece: [0, cp.join.y], chart: { u: 'cf' } };
        let v = ja.chart?.v != null ? resolveV(jc, ja.chart.v) : null;
        if (v == null) { const at = cp.place(ja.piece?.[0] ?? 0, cp.join.y); v = chartVAtZ(jc, at.z); }   // matched height
        const jp = placer(cp, jc, worldPerCm, ja, v);
        cp.parts[0].yLo = cp.join.y;
        cp.parts.push({ cp, chartId: cp.join.chart, place: jp, yLo: -Infinity, yHi: cp.join.y });
        cp.placeJoin = jp;
      }
    }
    parts.push(...cp.parts);
    pieces.push(cp);
  }
  // THE LAYERING RULE: the layers already worn (`under`, shells and pattern pieces alike) lift
  // each chart's rows by their stand-off, so this garment is placed on the inner layer's hang,
  // not on the skin. Then the hang rule per chart over THAT, then the world grid of every piece.
  const layered = under && under.length ? standoffScalesByChart(charts, under) : null;
  const hung = {};
  for (const chartId of new Set(parts.map((pt) => pt.chartId))) {
    const cps = parts.filter((pt) => pt.chartId === chartId);
    const base = layered ? liftChartCap(scaleChartRows(charts[chartId], layered[chartId]), under) : charts[chartId];   // the cap is lifted by the layers' height, not their ratio
    const hs = hangScales(base, cps, worldPerCm, Number.isFinite(spec.hang_sag) ? spec.hang_sag : PATTERN_DEFAULTS.hang_sag);   // sag is a ratio (circumference per drop), unit-free
    const liftMax = layered ? layered[chartId].map((sc) => Math.max(...sc)) : null;   // per row, the strongest direction
    const total = hs.scales.map((f, i) => f * (liftMax ? liftMax[i] : 1));
    // the readout reads COVERED rows only — rows the garment never reaches carry no cloth
    const onCloth = (arr) => Math.max(1, ...arr.filter((_v, i) => hs.covered[i]));
    hung[chartId] = { chart: hangChart(base, hs), standoff: r3(onCloth(total)), rows: total.map(r3), under: liftMax ? r3(onCloth(liftMax)) : 1 };
    for (const pt of cps) pt.place.chart = hung[chartId].chart;
  }
  for (const cp of pieces) {
    let clipped = 0;
    // across a join the two charts' placements are blended over `join.blend_cm` (default 4) either
    // side of the join height, so the piece crosses from one chart to the other without a step
    const blend = cp.join ? (Number.isFinite(cp.join.blend_cm) ? cp.join.blend_cm : 4) : 0;
    const at = (x, y) => {
      if (!cp.placeJoin) return cp.place(x, y);
      const d = y - cp.join.y;
      if (d <= -blend) return cp.placeJoin(x, y);
      if (d >= blend) return cp.place(x, y);
      const a = cp.placeJoin(x, y), b = cp.place(x, y), w = smoothstep((d + blend) / (2 * blend));
      const m = { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w, z: a.z + (b.z - a.z) * w, clipped: a.clipped || b.clipped };
      // a chord between two surfaces passes inside the limb between them: keep the blended
      // point at least an ease off the join chart's skin row at its height
      const jc = charts[cp.join.chart], rows = jc.rows;
      let best = rows[0]; for (const r of rows) if (Math.abs(r.center.z - m.z) < Math.abs(best.center.z - m.z)) best = r;
      const dx = m.x - best.center.x, dy = m.y - best.center.y, rq = Math.hypot(dx, dy);
      if (rq > 1e-9) {
        let near = null, nd = Infinity;
        for (const q of best.pts) { const ang = Math.abs(Math.atan2(q.y - best.center.y, q.x - best.center.x) - Math.atan2(dy, dx)); const a2 = Math.min(ang, TAU - ang); if (a2 < nd) { nd = a2; near = q; } }
        const rb = Math.hypot(near.x - best.center.x, near.y - best.center.y) + cp.ease * worldPerCm;
        if (rq < rb) { m.x = best.center.x + dx * (rb / rq); m.y = best.center.y + dy * (rb / rq); }
      }
      return m;
    };
    cp.at = at;
    cp.world = cp.flat.map((row) => row.map(([x, y]) => { const p = at(x, y); if (p.clipped) clipped++; return { x: p.x, y: p.y, z: p.z }; }));
    cp.clipped = clipped;
    if (clipped) warnings.push(`piece '${cp.id}': ${clipped} vertices rise above the '${cp.chart}' chart's top row and were clamped`);
  }
  const byId = (id) => pieces.find((p) => p.id === id);

  // stitch
  const seams = [];
  const delta = new Map();   // cp -> rows x cols accumulators
  const D = (cp) => { if (!delta.has(cp)) delta.set(cp, cp.flat.map((row) => row.map(() => ({ x: 0, y: 0, z: 0, n: 0 })))); return delta.get(cp); };
  for (const seam of (spec.seams ?? [])) {
    const A = byId(seam.a?.piece), B = byId(seam.b?.piece);
    if (!A || !B || !A.edgeRuns[seam.a.edge] || !B.edgeRuns[seam.b.edge]) { warnings.push(`seam ${JSON.stringify(seam.a)} to ${JSON.stringify(seam.b)}: unknown piece or edge — skipped`); continue; }
    const oa = edgeOrientation(A, seam.a.edge) * (seam.a.reverse ? -1 : 1);
    const ob = edgeOrientation(B, seam.b.edge) * (seam.b.reverse ? -1 : 1);
    const lenA = A.edgeRuns[seam.a.edge].length, lenB = B.edgeRuns[seam.b.edge].length;
    const easeTo = SEAM_EASE_KINDS.includes(seam.ease_to) ? seam.ease_to : 'split';
    const both = (t) => {
      const fa = edgeFlatAt(A, seam.a.edge, t, oa), fb = edgeFlatAt(B, seam.b.edge, t, ob);
      return [A.at(fa.x, fa.y), B.at(fb.x, fb.y)];
    };
    const stitched = (t) => {
      const [pa, pb] = both(t);
      const p = easeTo === 'a' ? { x: pa.x, y: pa.y, z: pa.z } : easeTo === 'b' ? { x: pb.x, y: pb.y, z: pb.z } : { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, z: (pa.z + pb.z) / 2 };
      // an `over` seam lies OVER the body between its edges (a shoulder). The average of a
      // front-face point and a back-face point is the yoke's AXIS, so on a chart with a cap the
      // stitched point is raised to the crest plus the rest: a shoulder seam never passes
      // through the flesh, whatever outline it was given.
      if (seam.over) { const cz = crestZAt(A.place.chart, p.x); if (cz != null) p.z = Math.max(p.z, cz + A.rest * worldPerCm); }
      return p;
    };
    // the GAP: how far apart the two placed edges sat before the stitch (mean over the
    // seam, in cm). Zero means the pieces met on the body; a big gap means the pattern is
    // too narrow (or too wide) for this body and the stitch had to pull cloth to close it.
    let gap = 0;
    const GAP_SAMPLES = 9;
    for (let k = 0; k < GAP_SAMPLES; k++) { const [pa, pb] = both(k / (GAP_SAMPLES - 1)); gap += dist3(pa, pb); }
    gap /= GAP_SAMPLES * worldPerCm;
    // boundary deltas on both sides
    const line = [];
    for (const [cp, edge, orient] of [[A, seam.a.edge, oa], [B, seam.b.edge, ob]]) {
      const dd = D(cp);
      for (let i = 0; i < cp.rows; i++) for (let j = 0; j < cp.cols; j++) {
        for (const b of cp.border[i][j]) {
          const te = edgeParam(cp, edge, b.seg, b.t);
          if (te == null) continue;
          const t = orient > 0 ? te : 1 - te;
          const target = stitched(t), here = cp.world[i][j];
          const cell = dd[i][j];
          cell.x += target.x - here.x; cell.y += target.y - here.y; cell.z += target.z - here.z; cell.n++;
          if (cp === A) line.push({ t, p: target });
        }
      }
    }
    line.sort((p, q) => p.t - q.t);
    seams.push({
      a: { piece: A.id, edge: seam.a.edge }, b: { piece: B.id, edge: seam.b.edge }, ease_to: easeTo,
      len_a_cm: r2(lenA), len_b_cm: r2(lenB), ease_cm: r2(lenA - lenB), label: seamLabel(lenA - lenB), gap_cm: r2(gap),
      ...(seam.over ? { over: true } : {}),   // the seam lies OVER the body between its two edges (a shoulder) and is stitched on the crest
      line: line.map((q) => q.p),
    });
  }
  // propagate boundary deltas inward along grid lines (smoothstep over the influence radius)
  for (const cp of pieces) {
    const dd = delta.get(cp); if (!dd) continue;
    const rows = cp.rows, cols = cp.cols, inf = cp.influence;
    const bd = dd.map((row) => row.map((c) => (c.n ? { x: c.x / c.n, y: c.y / c.n, z: c.z / c.n } : null)));
    const out = cp.world.map((row) => row.map((p) => ({ ...p })));
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      if (bd[i][j]) { out[i][j].x += bd[i][j].x; out[i][j].y += bd[i][j].y; out[i][j].z += bd[i][j].z; continue; }   // a stitched vertex lands ON the seam
      const [x, y] = cp.flat[i][j];
      let sx = 0, sy = 0, sz = 0, sw = 0;
      const add = (src, ii, jj) => {
        if (!src) return;
        const [bx, by] = cp.flat[ii][jj];
        const w = 1 - smoothstep(Math.hypot(x - bx, y - by) / inf);
        if (w <= 0) return;
        sx += src.x * w; sy += src.y * w; sz += src.z * w; sw += w;
      };
      add(bd[0][j], 0, j); add(bd[rows - 1][j], rows - 1, j); add(bd[i][0], i, 0); add(bd[i][cols - 1], i, cols - 1);
      if (sw > 0) { const k = 1 / Math.max(1, sw); out[i][j].x += sx * k; out[i][j].y += sy * k; out[i][j].z += sz * k; }
    }
    cp.world = out;
  }

  // strain readout (placed grid-edge length vs flat cm) + emission
  const stacks = [], pieceReports = [];
  for (const cp of pieces) {
    let maxS = 0, sumS = 0, cnt = 0;
    for (let i = 0; i < cp.rows; i++) for (let j = 0; j < cp.cols; j++) {
      for (const [ii, jj] of [[i, j + 1], [i + 1, j]]) {
        if (ii >= cp.rows || jj >= cp.cols) continue;
        const [ax, ay] = cp.flat[i][j], [bx, by] = cp.flat[ii][jj];
        const lf = Math.hypot(bx - ax, by - ay); if (lf < 1e-6) continue;
        const lw = dist3(cp.world[i][j], cp.world[ii][jj]) / worldPerCm;
        const s = Math.abs(lw - lf) / lf; if (s > maxS) maxS = s; sumS += s; cnt++;
      }
    }
    const rings = cp.world.map((row, i) => {
      const c = row.reduce((a, p) => ({ x: a.x + p.x / row.length, y: a.y + p.y / row.length, z: a.z + p.z / row.length }), { x: 0, y: 0, z: 0 });
      // the chart this grid row was placed on — the layering rule lifts that chart with it, not a
      // neighbour it happens to pass beside (a trouser leg's top rows beside the trunk's groin rows)
      const yMean = cp.flat[i].reduce((a, q) => a + q[1], 0) / cp.flat[i].length;
      // rows inside the blend band belong to the join chart too: they are pulled toward the limb
      // and must not read as the trunk's stand-off (a trouser's fork beside the hip)
      const blendY = cp.join ? cp.join.y + (Number.isFinite(cp.join.blend_cm) ? cp.join.blend_cm : 4) : -Infinity;
      return { center: c, polyline: row, chart: cp.join && yMean < blendY ? cp.join.chart : cp.chart };
    });
    stacks.push({
      id: `${spec.id}:${cp.id}`, rings, hex: cp.cloth ?? cloth, sheet: true, panel: cp.id,
      sheetUv: cp.flat, pattern: { piece: cp.id, chart: cp.chart },
    });
    pieceReports.push({ id: cp.id, chart: cp.chart, ...(cp.join ? { join: cp.join.chart } : {}), ...(cp.sloper ? { sloper: cp.sloper } : {}), ...(cp.mirrorOf ? { mirrorOf: cp.mirrorOf } : {}), allowance_cm: cp.allowance, rows: cp.rows, cols: cp.cols, area_cm2: r2(cp.area), clipped: cp.clipped, strain: { max: r3(maxS), mean: r3(cnt ? sumS / cnt : 0) }, outline: cp.pts, edges: Object.fromEntries(Object.entries(cp.edges).map(([k, e]) => [k, [e.i0, e.i1]])) });
  }
  // under-shell ranges: per chart, the z span the placed pieces cover
  const underRanges = [];
  for (const chartId of new Set(parts.map((pt) => pt.chartId))) {
    let zLo = Infinity, zHi = -Infinity;
    for (const pt of parts) if (pt.chartId === chartId) for (let i = 0; i < pt.cp.rows; i++) for (let j = 0; j < pt.cp.cols; j++) {
      const y = pt.cp.flat[i][j][1]; if (y < pt.yLo || y >= pt.yHi) continue;
      const p = pt.cp.world[i][j]; if (p.z < zLo) zLo = p.z; if (p.z > zHi) zHi = p.z;
    }
    if (zLo < zHi) underRanges.push({ chart: chartId, stackIds: charts[chartId].stacks, zLo, zHi });
  }
  const girths = {};
  for (const [id, ch] of Object.entries(charts)) girths[id] = Object.fromEntries(Object.entries(ch.landmarks).map(([k, v]) => [k, r2(chartGirthAt(ch, v) / worldPerCm)]));
  const report = {
    stature_cm: defaults.stature_cm, worldPerCm: r3(worldPerCm), ease_cm: defaults.ease_cm,
    charts: Object.keys(charts), girths, pieces: pieceReports, seams,
    hang: Object.fromEntries(Object.entries(hung).map(([k, v]) => [k, v.standoff])),   // max radial stand-off ratio per chart (1 = the cloth lies on the ease ring)
    hang_rows: Object.fromEntries(Object.entries(hung).map(([k, v]) => [k, v.rows])),  // the ratio per chart row, top → bottom
    under: Object.fromEntries(Object.entries(hung).map(([k, v]) => [k, v.under])),     // the inner layers' max stand-off per chart (1 = worn on the skin)
    warnings,
  };
  return { stacks, report, underRanges };
}

// Mirror a piece across the body's midline: x negated (outline reversed to stay CCW), the
// chart and u line swapped L <-> R, edges and corners re-indexed.
export function mirrorPiece(piece, id) {
  const n = piece.outline.length;
  const outline = piece.outline.map(([x, y]) => [-x, y]).reverse();
  const remap = (i) => n - 1 - (((i % n) + n) % n);
  const edges = piece.edges ? Object.fromEntries(Object.entries(piece.edges).map(([k, [a, b]]) => [k, [remap(b), remap(a)]])) : undefined;
  const corners = piece.corners ? [remap(piece.corners[1]), remap(piece.corners[0]), remap(piece.corners[3]), remap(piece.corners[2])] : undefined;
  const swapLR = (s) => (typeof s === 'string' ? (s.endsWith('L') ? s.slice(0, -1) + 'R' : s.endsWith('R') ? s.slice(0, -1) + 'L' : s) : s);
  const mirrorU = (u) => (typeof u === 'number' ? ((1 - u) % 1 + 1) % 1 : (u === 'sideL' ? 'sideR' : u === 'sideR' ? 'sideL' : u));
  const u = piece.anchor?.chart?.u;
  const mu = mirrorU(u);
  const ap = piece.anchor?.piece;
  const out = {
    ...piece, id, outline, mirrorOf: piece.id,
    ...(edges ? { edges } : {}), ...(corners ? { corners } : {}),
    chart: swapLR(piece.chart),
    anchor: { ...(piece.anchor ?? {}), ...(ap ? { piece: [-ap[0], ap[1]] } : {}), chart: { ...(piece.anchor?.chart ?? {}), ...(u !== undefined ? { u: mu } : {}) } },
    ...(piece.grain ? { grain: [-piece.grain[0], piece.grain[1]] } : {}),
    ...(piece.join && typeof piece.join === 'object' ? { join: { ...piece.join, chart: swapLR(piece.join.chart), ...(piece.join.anchor ? { anchor: { ...piece.join.anchor, ...(Array.isArray(piece.join.anchor.piece) ? { piece: [-piece.join.anchor.piece[0], piece.join.anchor.piece[1]] } : {}), chart: { ...(piece.join.anchor.chart ?? {}), ...(piece.join.anchor.chart?.u !== undefined ? { u: mirrorU(piece.join.anchor.chart.u) } : {}) } } } : {}) } } : {}),
  };
  delete out.mirror;
  return out;
}

// -- validation (the create_figure door) --------------------------------------
const isNum = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;

export function validatePatternPiece(piece, label) {
  const errors = [];
  if (!piece.id || typeof piece.id !== 'string') errors.push(`${label}.id: required (string) — a pattern piece is named (front / back / sleeveL)`);
  const o = piece.outline, hasSloper = piece.sloper !== undefined;
  if (hasSloper && !SLOPER_KINDS.includes(piece.sloper)) errors.push(`${label}.sloper: '${piece.sloper}' is not one of ${SLOPER_KINDS.join(' | ')}`);
  if (hasSloper && piece.dials !== undefined && (!piece.dials || typeof piece.dials !== 'object' || Array.isArray(piece.dials))) errors.push(`${label}.dials: must be an object of block dials`);
  if (o === undefined && hasSloper) { /* the block drafts the outline */ }
  else if (!Array.isArray(o) || o.length < 3 || o.some((p) => !Array.isArray(p) || p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
    errors.push(`${label}.outline: required — at least 3 [x, y] points in cm, counter-clockwise (or name a \`sloper\` to draft it)`);
  } else if (Math.abs(signedArea(o)) < 1e-6) errors.push(`${label}.outline: has no area`);
  if (!(piece.chart === undefined && hasSloper) && !CHART_IDS.includes(piece.chart)) errors.push(`${label}.chart: '${piece.chart}' is not one of ${CHART_IDS.join(' | ')}`);
  const a = piece.anchor;
  if (a !== undefined) {
    if (!a || typeof a !== 'object') errors.push(`${label}.anchor: must be { piece?: [x, y], chart?: { u, v } }`);
    else {
      if (a.piece !== undefined && (!Array.isArray(a.piece) || a.piece.length !== 2 || !a.piece.every(Number.isFinite))) errors.push(`${label}.anchor.piece: must be [x, y] cm`);
      if (a.chart !== undefined) {
        if (!a.chart || typeof a.chart !== 'object') errors.push(`${label}.anchor.chart: must be { u, v }`);
        else {
          if (a.chart.u !== undefined && resolveU(a.chart.u) == null) errors.push(`${label}.anchor.chart.u: a fraction or one of ${Object.keys(U_LINES).join(' | ')}`);
          if (a.chart.v !== undefined && !(typeof a.chart.v === 'string' || isNum(a.chart.v, 0, 1))) errors.push(`${label}.anchor.chart.v: a fraction in [0, 1] or a landmark name (collar / bust / waist / hip / crotch / top / bottom / elbow / ...)`);
        }
      }
    }
  }
  if (piece.edges !== undefined) {
    if (!piece.edges || typeof piece.edges !== 'object' || Array.isArray(piece.edges)) errors.push(`${label}.edges: must be { name: [i0, i1] } outline index pairs`);
    else for (const [k, v] of Object.entries(piece.edges)) {
      if (!Array.isArray(v) || v.length !== 2 || !v.every((i) => Number.isInteger(i))) errors.push(`${label}.edges.${k}: must be [i0, i1] outline vertex indices`);
      if (RUN_NAMES.includes(k)) errors.push(`${label}.edges.${k}: '${k}' is a reserved run name (top / right / bottom / left)`);
    }
  }
  if (piece.corners !== undefined && (!Array.isArray(piece.corners) || piece.corners.length !== 4 || !piece.corners.every(Number.isInteger))) errors.push(`${label}.corners: must be 4 outline vertex indices [tl, tr, br, bl]`);
  if (piece.join !== undefined) {
    const j = piece.join;
    if (!j || typeof j !== 'object' || Array.isArray(j)) errors.push(`${label}.join: must be { chart, y, anchor? } — the piece continues on \`chart\` below piece height \`y\``);
    else {
      if (!CHART_IDS.includes(j.chart)) errors.push(`${label}.join.chart: '${j.chart}' is not one of ${CHART_IDS.join(' | ')}`);
      if (!Number.isFinite(j.y)) errors.push(`${label}.join.y: the piece height (cm) where the join lies`);
      if (j.anchor !== undefined && (!j.anchor || typeof j.anchor !== 'object')) errors.push(`${label}.join.anchor: must be { piece?: [x, y], chart?: { u, v? } }`);
    }
  }
  if (piece.ease_cm !== undefined && !isNum(piece.ease_cm, 0, 30)) errors.push(`${label}.ease_cm: a number in [0, 30]`);
  if (piece.stitch_cm !== undefined && !isNum(piece.stitch_cm, 0.5, 10)) errors.push(`${label}.stitch_cm: a number in [0.5, 10]`);
  if (piece.mirror !== undefined && (typeof piece.mirror !== 'string' || !piece.mirror)) errors.push(`${label}.mirror: the mirrored piece's id (string)`);
  if (piece.grain !== undefined && (!Array.isArray(piece.grain) || piece.grain.length !== 2 || !piece.grain.every(Number.isFinite) || Math.hypot(piece.grain[0], piece.grain[1]) < 1e-9)) errors.push(`${label}.grain: a [dx, dy] direction`);
  return errors;
}

export function validatePatternSpec(spec, label = 'garment') {
  const errors = [];
  const patternPieces = (spec.pieces || []).filter((p) => p && p.fit === 'pattern');
  if (!patternPieces.length) return errors;
  if (spec.stature_cm !== undefined && !isNum(spec.stature_cm, 50, 250)) errors.push(`${label}.stature_cm: a number in [50, 250]`);
  if (spec.ease_cm !== undefined && !isNum(spec.ease_cm, 0, 30)) errors.push(`${label}.ease_cm: a number in [0, 30]`);
  if (spec.stitch_cm !== undefined && !isNum(spec.stitch_cm, 0.5, 10)) errors.push(`${label}.stitch_cm: a number in [0.5, 10]`);
  const ids = new Map();
  for (const p of patternPieces) {
    if (typeof p.id === 'string') { ids.set(p.id, p); if (typeof p.mirror === 'string') ids.set(p.mirror, p); }
  }
  if (spec.seams !== undefined) {
    if (!Array.isArray(spec.seams)) errors.push(`${label}.seams: must be an array of { a:{piece, edge}, b:{piece, edge}, ease_to? }`);
    else spec.seams.forEach((s, i) => {
      for (const side of ['a', 'b']) {
        const e = s?.[side];
        if (!e || typeof e !== 'object' || typeof e.piece !== 'string' || typeof e.edge !== 'string') { errors.push(`${label}.seams[${i}].${side}: must be { piece, edge }`); continue; }
        const p = ids.get(e.piece);
        if (!p) { errors.push(`${label}.seams[${i}].${side}.piece: '${e.piece}' is not a pattern piece of this garment`); continue; }
        if (!RUN_NAMES.includes(e.edge) && p.sloper === undefined && !(p.edges && Object.prototype.hasOwnProperty.call(p.edges, e.edge))) errors.push(`${label}.seams[${i}].${side}.edge: '${e.edge}' is not an edge of '${e.piece}' (top / right / bottom / left or a declared edge)`);
      }
      if (s?.ease_to !== undefined && !SEAM_EASE_KINDS.includes(s.ease_to)) errors.push(`${label}.seams[${i}].ease_to: one of ${SEAM_EASE_KINDS.join(' | ')}`);
      if (s?.over !== undefined && typeof s.over !== 'boolean') errors.push(`${label}.seams[${i}].over: boolean`);
    });
  }
  return errors;
}
