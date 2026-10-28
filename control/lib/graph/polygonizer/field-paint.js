/**
 * field-paint — FIELD PAINT: colour regions drawn as shapes on a layered figure's surface and CUT into its faces, so a
 * line crosses a face at any angle and as thin as it needs (paint by bands is the ring's height: a trim on a coarse
 * ring is the ring's band, an emblem smaller than a band is nothing). The swimsuit's seat panels (seat-panels.js) were
 * the first of these; this is the same cut as data.
 *
 * `fieldPaint` on a layered manifest (beside `bake`): a list of entries, painted in order (a later one over an earlier):
 *   { part, chart?, shape? | pattern?, at?, size?, rotate?, group, color?, only? }
 *   part     a part name, a list, a prefix ending '*' ('adorn.torso-tabard*': the tabard and its signatures), or a suffix
 *            starting '*' ('*_torso': every layer worn over the torso, the top, a jacket, a suit; with 'torso' itself,
 *            ['torso', '*_torso'] is the chest whatever is worn on it, the outermost showing)
 *   chart    where the shape is drawn:
 *            'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' (default 'front') — a PROJECTION from that side over
 *              the named parts' box, x to the viewer's right, y up (top: y toward the front); only faces facing that
 *              side are painted. Linear in position, so a cut is exact in every triangle, on any part (a worn shell too).
 *            'ring' — a body part's own rings (layer 1): x round the ring (0.5 the front's middle, rising round the
 *              figure's right to 1 at the back, falling round its left to 0), y along it (0 the first station, 1 the
 *              last: a torso's hem → collar, a limb's root → end), for paint that wraps
 *   at, size the shape's centre and its width and height, as shares of the chart (default [0.5, 0.5] and [0.5, 0.5]; a
 *            number for size is both)
 *   rotate   degrees, counter-clockwise
 *   shape    'rect' | 'circle' | 'diamond' | 'shield' | 'cross' | 'star' | { motif: MOTIFS name, w? } (a motif's strokes
 *            filled, `w` their width in the shape's own box, default 0.22) | { poly: [[x, y], …] } (convex, in the
 *            shape's box −1…1) | { polys: [[[x, y], …], …] } (a union of convex ones) | { path: '<an SVG path's d>' } (a
 *            MARK: a logo, an emblem, an insignia pasted as drawn, any outline with its holes, its curves and arcs;
 *            fitted into the shape's box with its aspect kept, its y turned up, simplified to the cut's tolerance and
 *            cut as convex pieces, so `size` sets its larger side; markPolys)
 *   pattern  a repeat over the window at ± size / 2: { cells: 'hex' | 'scale' | 'square' | 'brick', grid: [nx, ny], gap? }
 *            (cells, each shrunk by `gap`, a share of its own size, default 0.15: scale rows, a hide's plates) or
 *            { bands: n, gap?, axis?: 'x' | 'y' } (strips along y by default: a belly's scutes)
 *   group    the palette group it paints; `color` names its colour (else the palette's); `only` repaints only those groups
 *
 *   validateFieldPaint(list)          error strings
 *   fieldPaintOf(mesh, list)          { cut(fi, start) } or null: `start` the face's cells [{ ring: [{ w }], group }]
 *                                     (weights over its three corners), → the cells after every entry, or null when no
 *                                     entry touches the face
 *   fieldColours(list)                { group: colour } the entries name
 *   fieldPaintReadout(mesh, list)     per entry: the parts it names, the faces it cut and the cells it painted
 *   markPolys(d)                      an SVG path's d → its convex pieces in the box −1…1, or throws saying why
 *
 * Pure, deterministic: shapes are fixed tables, patterns are grids, no dice.
 */
import { MOTIFS } from './station-loft-adorn.js';
import { parseSvgPath, normalizeContours } from './carve-solid.js';
import { triangulateRings } from './triangulate.js';

export const FIELD_CHARTS = Object.freeze(['front', 'back', 'left', 'right', 'top', 'bottom', 'ring']);
const KEYS = ['part', 'chart', 'shape', 'pattern', 'at', 'size', 'rotate', 'group', 'color', 'only', 'id'];
const CELLS = ['hex', 'scale', 'square', 'brick'];
const MAX_POLYS = 600;

// ─── shapes: convex polygons in the unit box −1…1, y up ───
const ngon = (n, r = 1, ph = Math.PI / 2) => Array.from({ length: n }, (_, i) => { const a = ph + (2 * Math.PI * i) / n; return [r * Math.cos(a), r * Math.sin(a)]; });
const star = () => {
  const out = [], inner = ngon(5, 0.4, Math.PI / 2 + Math.PI / 5), outer = ngon(5, 1);
  out.push(inner);
  for (let i = 0; i < 5; i++) out.push([inner[(i + 4) % 5], outer[i], inner[i]]);
  return out;
};
export const FIELD_SHAPES = Object.freeze({
  rect: () => [[[-1, -1], [1, -1], [1, 1], [-1, 1]]],
  circle: () => [ngon(24)],
  diamond: () => [[[0, -1], [1, 0], [0, 1], [-1, 0]]],
  shield: () => [[[-1, 1], [-1, 0.15], [-0.75, -0.45], [0, -1], [0.75, -0.45], [1, 0.15], [1, 1]]],
  cross: () => [[[-0.28, -1], [0.28, -1], [0.28, 1], [-0.28, 1]], [[-1, -0.28], [1, -0.28], [1, 0.28], [-1, 0.28]]],
  star,
});
export const FIELD_SHAPE_NAMES = Object.freeze(Object.keys(FIELD_SHAPES));

/** a polyline stroked `w` wide: a quad per segment and a square at each joint (all convex) */
function stroke(line, w) {
  const out = [], h = w / 2;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i], line[i + 1]], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (!(l > 1e-9)) continue;
    const nx = (-dy / l) * h, ny = (dx / l) * h;
    out.push([[a[0] + nx, a[1] + ny], [a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny]]);
  }
  for (const p of line.slice(1, -1)) out.push([[p[0] - h, p[1] - h], [p[0] + h, p[1] - h], [p[0] + h, p[1] + h], [p[0] - h, p[1] + h]]);
  return out;
}
const area2 = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s; };
const ccw = (P) => (area2(P) < 0 ? [...P].reverse() : P);
const convex = (P) => { if (!Array.isArray(P) || P.length < 3) return false; const Q = ccw(P); for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length], c = Q[(i + 2) % Q.length]; if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-12) return false; } return Math.abs(area2(Q)) > 1e-12; };
const isPt = (p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === 'number' && Number.isFinite(x));
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isPair = (v, lo, hi) => Array.isArray(v) && v.length === 2 && v.every((x) => isNum(x) && x >= lo && x <= hi);

// ─── marks: an SVG path drawn as it was drawn ───
/** a mark's reading: the points a quarter turn of a curve or an arc takes, how far a simplified outline may stand off the
 * drawn one (a share of the box's half-width: a millimetre on a chest emblem a quarter metre wide), the longest `d` read */
export const MARK = Object.freeze({ curveSteps: 8, tolerance: 0.008, maxLength: 20000 });
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
// Douglas–Peucker on an open run of points (its ends kept)
function simplify(P, tol) {
  if (P.length < 3) return P;
  let far = 0, at = 0;
  for (let i = 1; i < P.length - 1; i++) { const d = segDist(P[i], P[0], P[P.length - 1]); if (d > far) { far = d; at = i; } }
  return far <= tol ? [P[0], P[P.length - 1]] : [...simplify(P.slice(0, at + 1), tol).slice(0, -1), ...simplify(P.slice(at), tol)];
}
// a closed ring simplified: split at its farthest pair from its first point, each half simplified, the duplicates gone
function simplifyRing(R, tol) {
  const Q = R.filter((p, i) => i === 0 || Math.hypot(p[0] - R[i - 1][0], p[1] - R[i - 1][1]) > 1e-9);
  if (Q.length > 1 && Math.hypot(Q[0][0] - Q.at(-1)[0], Q[0][1] - Q.at(-1)[1]) <= 1e-9) Q.pop();
  if (Q.length < 4) return Q;
  let at = 0, far = 0; for (let i = 1; i < Q.length; i++) { const d = Math.hypot(Q[i][0] - Q[0][0], Q[i][1] - Q[0][1]); if (d > far) { far = d; at = i; } }
  return [...simplify(Q.slice(0, at + 1), tol).slice(0, -1), ...simplify([...Q.slice(at), Q[0]], tol).slice(0, -1)];
}
/** An SVG path's `d` → its convex pieces in the box −1…1 (y up, the aspect kept, centred): every outline and the holes in
 * it (even-odd), curves and arcs drawn, simplified to MARK.tolerance, triangulated. Throws saying why it cannot be read. */
export function markPolys(d) {
  if (typeof d !== 'string' || !d.trim()) throw new Error('a mark\'s path is an SVG path\'s d: \'M 0 0 L 10 0 …\'');
  if (d.length > MARK.maxLength) throw new Error(`a mark's path is at most ${MARK.maxLength} characters (this one is ${d.length}): simplify it`);
  if (!/^\s*[mM]/.test(d) || /[^mMlLhHvVcCsSqQtTaAzZ0-9eE+\-.,\s]/.test(d)) throw new Error('a mark\'s path is an SVG path\'s d: it starts with M and holds only path commands and numbers');
  const raw = parseSvgPath(d, { curveSteps: MARK.curveSteps, arcs: true });
  if (!raw.length || raw.some((R) => R.some((p) => !p.every(Number.isFinite)))) throw new Error('a mark\'s path drew no closed outline (each outline is a run of three points or more)');
  const rings = normalizeContours(raw, { box: 2, flipY: true }).map((R) => simplifyRing(R, MARK.tolerance)).filter((R) => R.length >= 3 && Math.abs(area2(R)) > 1e-6);
  if (!rings.length) throw new Error('a mark\'s path drew no outline with an area');
  const tris = triangulateRings(rings).filter((T) => Math.abs(area2(T)) > 1e-9);
  if (!tris.length) throw new Error('a mark\'s path could not be cut into pieces');
  return tris;
}

/** the unit-box polygons a shape names */
function shapePolys(shape) {
  if (typeof shape === 'string') return FIELD_SHAPES[shape]();
  if (shape.motif) return MOTIFS[shape.motif].flatMap((line) => stroke(line, shape.w ?? 0.22));
  if (shape.path) return markPolys(shape.path);
  if (shape.poly) return [shape.poly];
  return shape.polys;
}
/** the cells of a pattern, in chart shares, over the window [x0, x1] × [y0, y1] */
function patternPolys(P, [x0, x1], [y0, y1]) {
  const out = [], W = x1 - x0, H = y1 - y0;
  if (P.bands) {
    const n = P.bands, g = P.gap ?? 0.15, along = (P.axis ?? 'y') === 'y';
    for (let i = 0; i < n; i++) { const a = (i + g / 2) / n, b = (i + 1 - g / 2) / n;
      out.push(along ? [[x0, y0 + a * H], [x1, y0 + a * H], [x1, y0 + b * H], [x0, y0 + b * H]] : [[x0 + a * W, y0], [x0 + b * W, y0], [x0 + b * W, y1], [x0 + a * W, y1]]); }
    return out;
  }
  const [nx, ny] = P.grid, cw = W / nx, ch = H / ny, k = 1 - (P.gap ?? 0.15), kind = P.cells;
  const shrink = (cx, cy, pts) => pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
  for (let j = 0; j < ny; j++) {
    const off = kind === 'square' ? 0 : j % 2 ? 0.5 : 0, cy = y0 + (j + 0.5) * ch;
    for (let i = off ? -1 : 0; i < nx; i++) {
      const cx = x0 + (i + 0.5 + off) * cw; if (cx < x0 - cw / 2 || cx > x1 + cw / 2) continue;
      let pts;
      if (kind === 'hex') pts = ngon(6, 1, Math.PI / 2).map(([x, y]) => [cx + x * cw / Math.sqrt(3), cy + y * ch * 2 / 3]);
      else if (kind === 'scale') pts = [[-1, 1], ...ngon(12, 1, Math.PI).slice(0, 7).map(([x, y]) => [x, Math.min(0, y) * 1.25]), [1, 1]].map(([x, y]) => [cx + x * cw / 2, cy + (y * 0.5 + 0.1) * ch]);
      else pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [cx + x * cw / 2, cy + y * ch / 2]);
      // a cell's own clip to the window (a brick row's half cells at the ends)
      out.push(shrink(cx, cy, pts).map(([x, y]) => [Math.min(x1, Math.max(x0, x)), Math.min(y1, Math.max(y0, y))]));
    }
  }
  return out.filter((p) => Math.abs(area2(p)) > 1e-12);
}

function shapeErrors(S, at) {
  if (typeof S === 'string') return FIELD_SHAPES[S] ? [] : [`${at}: '${S}' is not a shape (${FIELD_SHAPE_NAMES.join(', ')}), or { motif }, { poly }, { polys }, { path }`];
  if (!S || typeof S !== 'object' || Array.isArray(S)) return [`${at}: a shape word (${FIELD_SHAPE_NAMES.join(', ')}), { motif, w? }, { poly }, { polys } or { path: an SVG path's d }`];
  if (S.path !== undefined) {
    if (Object.keys(S).some((k) => k !== 'path')) return [`${at}: a mark is { path } alone (its size, place and turn are the entry's: at, size, rotate)`];
    try { const n = markPolys(S.path).length; return n > MAX_POLYS ? [`${at}.path: too detailed to cut (${n} pieces, at most ${MAX_POLYS}): simplify the path or split it into entries`] : []; } catch (e) { return [`${at}.path: ${e.message}`]; }
  }
  if (S.motif !== undefined) { const e = []; if (!Object.hasOwn(MOTIFS, S.motif)) e.push(`${at}.motif: '${S.motif}' is not a motif (${Object.keys(MOTIFS).join(', ')})`); if (S.w !== undefined && !(isNum(S.w) && S.w > 0 && S.w <= 1)) e.push(`${at}.w: a number over 0, up to 1`); return e; }
  const polys = S.poly !== undefined ? [S.poly] : S.polys;
  if (!Array.isArray(polys) || !polys.length || polys.length > 64) return [`${at}: { poly: [[x, y], …] } or { polys: [ … ] } (1–64 convex polygons in −1…1)`];
  return polys.flatMap((P, i) => (Array.isArray(P) && P.length <= 64 && P.every((p) => isPt(p) && Math.abs(p[0]) <= 1 && Math.abs(p[1]) <= 1) && convex(P) ? [] : [`${at}${S.poly ? '.poly' : `.polys[${i}]`}: a convex polygon of 3–64 points in −1…1`]));
}

/** Error strings for a manifest's `fieldPaint`. */
export function validateFieldPaint(list) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) return ['fieldPaint: a list of { part, chart?, shape | pattern, at?, size?, rotate?, group, color?, only? }'];
  if (list.length > 64) return ['fieldPaint: at most 64 entries'];
  const errs = [];
  list.forEach((E, i) => {
    const at = `fieldPaint[${i}]`;
    if (!E || typeof E !== 'object' || Array.isArray(E)) { errs.push(`${at}: { part, chart?, shape | pattern, at?, size?, rotate?, group, color?, only? }`); return; }
    for (const k of Object.keys(E)) if (!KEYS.includes(k)) errs.push(`${at}.${k}: not a field paint word (${KEYS.join(', ')})`);
    const parts = Array.isArray(E.part) ? E.part : [E.part];
    if (!parts.length || !parts.every((p) => typeof p === 'string' && p && p !== '*')) errs.push(`${at}.part: a part name, a list, a prefix ending '*' or a suffix starting '*'`);
    if (typeof E.group !== 'string' || !E.group) errs.push(`${at}.group: the palette group it paints`);
    if (E.chart !== undefined && !FIELD_CHARTS.includes(E.chart)) errs.push(`${at}.chart: one of ${FIELD_CHARTS.join(', ')}`);
    if (E.at !== undefined && !isPair(E.at, -1, 2)) errs.push(`${at}.at: [x, y] shares of the chart`);
    if (E.size !== undefined && !(isNum(E.size) ? E.size > 0 && E.size <= 4 : isPair(E.size, 1e-6, 4))) errs.push(`${at}.size: a share of the chart, or [w, h]`);
    if (E.rotate !== undefined && !isNum(E.rotate)) errs.push(`${at}.rotate: degrees`);
    if (E.color !== undefined && !(typeof E.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(E.color))) errs.push(`${at}.color: '#rrggbb'`);
    if (E.only !== undefined && !(Array.isArray(E.only) && E.only.length && E.only.every((g) => typeof g === 'string' && g))) errs.push(`${at}.only: a list of the groups it repaints`);
    if ((E.shape === undefined) === (E.pattern === undefined)) errs.push(`${at}: a shape or a pattern (one of them)`);
    if (E.shape !== undefined) errs.push(...shapeErrors(E.shape, `${at}.shape`));
    if (E.pattern !== undefined) {
      const P = E.pattern;
      if (!P || typeof P !== 'object' || Array.isArray(P)) errs.push(`${at}.pattern: { cells, grid, gap? } or { bands, gap?, axis? }`);
      else if (P.bands !== undefined) { if (!(Number.isInteger(P.bands) && P.bands >= 1 && P.bands <= 64)) errs.push(`${at}.pattern.bands: an integer 1–64`); if (P.axis !== undefined && !['x', 'y'].includes(P.axis)) errs.push(`${at}.pattern.axis: 'x' or 'y'`); }
      else {
        if (!CELLS.includes(P.cells)) errs.push(`${at}.pattern.cells: one of ${CELLS.join(', ')} (or { bands })`);
        if (!(Array.isArray(P.grid) && P.grid.length === 2 && P.grid.every((n) => Number.isInteger(n) && n >= 1 && n <= 48) && P.grid[0] * P.grid[1] <= MAX_POLYS / 1.2)) errs.push(`${at}.pattern.grid: [nx, ny], integers 1–48, at most ${MAX_POLYS / 1.2} cells`);
      }
      if (P && P.gap !== undefined && !(isNum(P.gap) && P.gap >= 0 && P.gap < 1)) errs.push(`${at}.pattern.gap: a share 0 – under 1`);
    }
  });
  return errs;
}

/** the colours the entries name, group → '#hex' (a later entry's wins) */
export function fieldColours(list) { const out = {}; for (const E of list || []) if (E.color) out[E.group] = E.color; return out; }

/** an entry's polygons in chart shares, each { P (CCW), box } */
function entryPolys(E) {
  const at = E.at ?? [0.5, 0.5], size = isNum(E.size) ? [E.size, E.size] : E.size ?? [0.5, 0.5];
  const raw = E.pattern ? patternPolys(E.pattern, [at[0] - size[0] / 2, at[0] + size[0] / 2], [at[1] - size[1] / 2, at[1] + size[1] / 2])
    : shapePolys(E.shape).map((P) => { const r = ((E.rotate ?? 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      return P.map(([x, y]) => [at[0] + ((x * c - y * s) * size[0]) / 2, at[1] + ((x * s + y * c) * size[1]) / 2]); });
  return raw.slice(0, MAX_POLYS).map((P) => { const Q = ccw(P); const xs = Q.map((p) => p[0]), ys = Q.map((p) => p[1]); return { P: Q, box: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] }; });
}

// ─── charts ───
const DIRS = { front: [0, 1, 0], back: [0, -1, 0], right: [-1, 0, 0], left: [1, 0, 0], top: [0, 0, 1], bottom: [0, 0, -1] };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** the screen axes of a projection: x to the viewer's right, y up (top: toward the front, bottom: toward the back) */
function axes(chart) { const d = DIRS[chart], f = d.map((x) => -x), up = chart === 'top' ? [0, 1, 0] : chart === 'bottom' ? [0, -1, 0] : [0, 0, 1]; return { d, x: cross3(f, up), y: up }; }

/** the parts an entry names in `mesh` */
function partsOf(mesh, E) {
  const names = Object.keys(mesh.parts), want = Array.isArray(E.part) ? E.part : [E.part];
  return [...new Set(want.flatMap((w) => (w.endsWith('*') ? names.filter((n) => n.startsWith(w.slice(0, -1))) : w.startsWith('*') ? names.filter((n) => n.endsWith(w.slice(1))) : names.includes(w) ? [w] : [])))];
}

/** each vertex's ring-chart coordinates on its L1 part ([x, y], see the header) or null */
function ringCoords(mesh) {
  const out = new Array(mesh.vertices.length).fill(null), cache = new Map();
  mesh.provenance.forEach((pv, vi) => {
    if (!pv.station || !pv.slot) return;
    const part = mesh.parts[pv.part]; if (!part?.slots || !part?.stations) return;
    let C = cache.get(pv.part);
    if (!C) {
      const n = part.slots.length, half = n / 2, T = (k) => part.slotT?.[part.slots[k]] ?? (k <= half ? k : n - k), H = T(half) || 1;
      const U = part.stations.map((st, i) => st.u ?? i), u0 = U[0], span = U[U.length - 1] - u0 || 1;
      const sx = new Map(part.slots.map((sl, k) => [sl, k <= half ? 0.5 + T(k) / (2 * H) : 0.5 - T(n - k) / (2 * H)]));
      const sy = new Map(part.stations.map((st, i) => [st.id ?? `st${i}`, (U[i] - u0) / span]));
      cache.set(pv.part, C = { sx, sy });
    }
    const x = C.sx.get(pv.slot), y = C.sy.get(pv.station);
    if (x !== undefined && y !== undefined) out[vi] = [x, y];
  });
  return out;
}

/**
 * The field paint on `mesh` (its REST positions): { cut(fi, start) } or null. Each entry is resolved once (its parts, its
 * chart coordinates per vertex, its polygons); a face takes the entries whose parts hold it, whose chart sees it, and
 * whose polygons' boxes meet its own.
 */
export function fieldPaintOf(mesh, list) {
  if (!Array.isArray(list) || !list.length) return null;
  const errs = validateFieldPaint(list); if (errs.length) throw new Error(`fieldPaint refused:\n - ${errs.join('\n - ')}`);
  const V = mesh.vertices, F = mesh.faces, partOfFace = (fi) => mesh.provenance[F[fi][0]].part;
  let ring = null;
  const entries = list.map((E) => {
    const parts = new Set(partsOf(mesh, E)), chart = E.chart ?? 'front', polys = entryPolys(E);
    let coord;
    if (chart === 'ring') { ring ??= ringCoords(mesh); coord = (vi) => ring[vi]; }
    else {
      const A = axes(chart); let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      mesh.provenance.forEach((pv, vi) => { if (!parts.has(pv.part)) return; const x = dot3(V[vi], A.x), y = dot3(V[vi], A.y); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
      const w = x1 - x0 || 1, h = y1 - y0 || 1;
      coord = (vi) => [(dot3(V[vi], A.x) - x0) / w, (dot3(V[vi], A.y) - y0) / h];
      coord.d = A.d;
    }
    return { E, parts, chart, polys, coord, only: E.only ? new Set(E.only) : null };
  });
  /** a face's chart corners under an entry, or null (not its part, not facing a projection, off the ring) */
  const cornersOf = (e, fi) => {
    if (!e.parts.has(partOfFace(fi))) return null;
    const t = F[fi];
    if (e.coord.d) { const a = V[t[0]], b = V[t[1]], c = V[t[2]], n = cross3([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]), l = Math.hypot(n[0], n[1], n[2]); if (!(l > 0) || dot3(n, e.coord.d) / l <= 0.05) return null; }
    const C = t.map((vi) => e.coord(vi)); if (C.some((c) => !c)) return null;
    // the ring's back seam: a corner at the back (x 0 or 1) takes the side its face's other corners lie on
    if (e.chart === 'ring' && Math.max(...C.map((c) => c[0])) - Math.min(...C.map((c) => c[0])) > 0.5) {
      const low = C.filter((c) => c[0] < 0.5).length >= 2; return C.map(([x, y]) => [low && x > 0.5 ? x - 1 : !low && x < 0.5 ? x + 1 : x, y]);
    }
    return C;
  };
  return {
    entries: entries.length,
    /** the cells of face `fi` after every entry over `start` (default: the whole face in its own group), or null */
    cut(fi, start = null) {
      let cells = start ?? [{ ring: [{ w: [1, 0, 0] }, { w: [0, 1, 0] }, { w: [0, 0, 1] }], group: mesh.groups[fi] }], touched = false;
      for (const e of entries) {
        const C = cornersOf(e, fi); if (!C) continue;
        const bx = [Math.min(C[0][0], C[1][0], C[2][0]), Math.max(C[0][0], C[1][0], C[2][0]), Math.min(C[0][1], C[1][1], C[2][1]), Math.max(C[0][1], C[1][1], C[2][1])];
        for (const { P, box } of e.polys) {
          if (box[1] < bx[0] || box[0] > bx[1] || box[3] < bx[2] || box[2] > bx[3]) continue;
          // the polygon's edges as planes: a value per face corner, inside at or under 0 (linear across the face)
          const planes = P.map((a, i) => { const b = P[(i + 1) % P.length], ex = b[0] - a[0], ey = b[1] - a[1]; return C.map(([x, y]) => -(ex * (y - a[1]) - ey * (x - a[0]))); });
          const next = [];
          for (const cell of cells) {
            if (e.only && !e.only.has(cell.group)) { next.push(cell); continue; }
            const { inside, outside } = clipConvex(cell.ring, planes);
            if (!inside) { next.push(cell); continue; }
            touched = true;
            for (const R of outside) next.push({ ring: R, group: cell.group });
            next.push({ ring: inside, group: e.E.group });
          }
          cells = next;
        }
      }
      return touched ? cells : null;
    },
  };
}

const valAt = (w, P) => w[0] * P[0] + w[1] * P[1] + w[2] * P[2];
/** a point on edge a → b where a plane crosses: weights interpolated (a weight both ends share is kept exactly) */
const mid = (a, b, t) => ({ w: a.w.map((wa, k) => (wa === b.w[k] ? wa : wa + (b.w[k] - wa) * t)) });
/** split a convex ring by one plane → [under, over] (either may be null) */
function split(R, P) {
  const v = R.map((pt) => valAt(pt.w, P));
  if (v.every((x) => x <= 1e-12)) return [R, null];
  if (v.every((x) => x >= -1e-12)) return [null, R];
  const neg = [], pos = [];
  for (let i = 0; i < R.length; i++) {
    const j = (i + 1) % R.length, a = R[i], b = R[j], va = v[i], vb = v[j];
    if (va <= 0) neg.push(a); if (va >= 0) pos.push(a);
    if ((va < 0 && vb > 0) || (va > 0 && vb < 0)) { const x = mid(a, b, va / (va - vb)); neg.push(x); pos.push(x); }
  }
  return [neg.length >= 3 ? neg : null, pos.length >= 3 ? pos : null];
}
/** a convex ring clipped to the convex set `planes`: the piece inside, and the pieces outside (one per plane it crossed) */
function clipConvex(R, planes) {
  let inside = R; const outside = [];
  for (const P of planes) { const [under, over] = split(inside, P); if (over) outside.push(over); inside = under; if (!inside) return { inside: null, outside: [R] }; }
  // a sliver (a polygon grazing the face) paints nothing
  const area = Math.abs(inside.reduce((s, p, i) => { const q = inside[(i + 1) % inside.length]; return s + p.w[1] * q.w[2] - q.w[1] * p.w[2]; }, 0));
  return area < 1e-9 ? { inside: null, outside: [R] } : { inside, outside };
}

/** A cell's fan of triangles: each [{ w }, { w }, { w }] */
export const cellTriangles = (ring) => Array.from({ length: Math.max(0, ring.length - 2) }, (_, k) => [ring[0], ring[k + 1], ring[k + 2]]);

/** The readout: per entry, the parts it names, the faces it cut and the cells it painted (an entry that touches nothing
 * says so: a part name that matches none, a chart that sees none of its faces, a shape off the chart). */
export function fieldPaintReadout(mesh, list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list.map((E, i) => {
    const fp = fieldPaintOf(mesh, [E]), parts = partsOf(mesh, E); let faces = 0, cells = 0;
    if (parts.length) mesh.faces.forEach((_, fi) => { const c = fp.cut(fi); if (c) { faces++; cells += c.filter((x) => x.group === E.group).length; } });
    return { entry: i, group: E.group, parts: parts.length, faces, cells, ...(!parts.length ? { warning: `part ${JSON.stringify(E.part)} names no part` } : !faces ? { warning: 'touches no face (its chart sees none of the parts\' faces, or the shape lies off the chart)' } : {}) };
  });
}
