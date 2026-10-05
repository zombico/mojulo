/**
 * historic/assets/solids — the angled masses the box emitter does not make. A historic city is not
 * all right angles: mud brick is laid BATTERED (walls lean in as they rise), stairs climb on a
 * SLOPE between sloped cheek walls, reed halls are round VAULTS. An asset marks such a mass with
 * `solid` and these turn it into lit, outward-wound faces (parallelograms and triangles — what the
 * CSS 3D emitter draws), passed to the scene as extra faces.
 *
 *   solid: 'frustum'  — the rect at z0, `top` (a rect) at z1: a battered block, any side leaning
 *   solid: 'panel'    — one planar face: `pts` (its corners, metres) facing `out`
 *   solid: 'wedge'    — a slope across the rect from z0 up to z1, rising toward `rise` ('x+','x-','y+','y-')
 *   solid: 'palm'     — a date palm standing at the rect's centre, z0 → z1 the trunk: a tapering,
 *                       leaning trunk (`lean`, fraction of height) under a crown of drooping fronds
 *                       (`fronds`: [{ a radians, len fraction of height, droop }]); ~27 faces where
 *                       the grown palm is ~900 (it was four fifths of a whole town's faces)
 *   solid: 'drum'     — a round (N-sided) column filling the rect, z0 → z1; `taper` the top radius as a
 *                       fraction of the bottom (a vase's neck, a cone), `sides` (default 10); `open` leaves the
 *                       top open with an inner wall and a lip `lip` thick (a well head, a jar)
 *   solid: 'dome'     — a beehive dome over the rect's circle from z0 to the crown at z1
 *   Any solid may carry `surface` (a ground.js tile, e.g. 'cone-mosaic'): its upright faces wear it.
 *   solid: 'ring'     — an upright hoop in the rect's x–z plane (diameter = w, centred at the rect's
 *                       middle at height (z0+z1)/2), its band `band` thick, d deep (Inanna's loop)
 *   solid: 'vault'    — a barrel over the rect, axis along `axis` ('x' | 'y'): walls to z0, the
 *                       round crown to z1; `open` ('lo' | 'hi' | null) leaves one end dark and open;
 *                       `caps: false` draws no ends at all (a thin ring standing proud of a vault)
 *
 * Geometry is in whatever unit the mass is in; `solidFaces` works in scene units.
 */
import { litFactor, scaleHex } from '../../polygonizer/vexar.js';
import { groundKey, GROUND_SURFACES } from '../ground.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const centroid = (ps) => ps.reduce((s, p) => [s[0] + p[0] / ps.length, s[1] + p[1] / ps.length, s[2] + p[2] / ps.length], [0, 0, 0]);

// how a local direction turns with the slot's facing (see kit.js orientBox)
const RISE = { n: { 'x+': 'x+', 'x-': 'x-', 'y+': 'y+', 'y-': 'y-' }, s: { 'x+': 'x-', 'x-': 'x+', 'y+': 'y-', 'y-': 'y+' }, e: { 'x+': 'y+', 'x-': 'y-', 'y+': 'x-', 'y-': 'x+' }, w: { 'x+': 'y-', 'x-': 'y+', 'y+': 'x+', 'y-': 'x-' } };
const OPEN_END = { n: (a) => a, s: (a) => (a === 'lo' ? 'hi' : a === 'hi' ? 'lo' : a), e: (a) => (a === 'lo' ? 'hi' : a === 'hi' ? 'lo' : a), w: (a) => a };
/** Turn a solid's own directions with the facing (kit.js calls this beside orientBox). */
export function orientSolid(b, facing = 'n', orientRect) {
  if (!b.solid) return {};
  const o = {};
  if (b.top) o.top = orientRect(b.top);
  if (b.rise) o.rise = RISE[facing][b.rise];
  if (b.axis) o.axis = facing === 'e' || facing === 'w' ? (b.axis === 'x' ? 'y' : 'x') : b.axis;
  if (b.solid === 'ring') o.plane = (facing === 'e' || facing === 'w') === (b.plane === 'y') ? 'x' : 'y';
  if (b.open) o.open = b.axis === 'y' ? OPEN_END[facing](b.open) : b.open;   // only the y-axis vault's ends swap
  return o;
}

/** A planar polygon → emitter faces (a quad when it is a parallelogram, else a triangle fan), wound outward. */
function polyFaces(pts, out, fill) {
  // drop repeated corners (an arch with no wall below it repeats its springing points), then take the
  // normal by Newell's method, which a near-degenerate first corner cannot fool
  pts = pts.filter((p, i) => Math.hypot(...sub(p, pts[(i + pts.length - 1) % pts.length])) > 1e-9);
  if (pts.length < 3) return [];
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
  const n = norm([nx, ny, nz]);
  const P = dot(n, out) < 0 ? [pts[0], ...pts.slice(1).reverse()] : pts;
  const nn = dot(n, out) < 0 ? [-n[0], -n[1], -n[2]] : n;
  if (P.length === 4) {
    const par = sub(sub(P[2], P[1]), sub(P[3], P[0]));
    if (Math.hypot(...par) < 1e-6) return [{ corners: P, fill: fill(nn) }];
    // a trapezoid (a battered side): a parallelogram plus one thin triangle at the leaning edge —
    // no masked layers (a clip-path per side stalls the compositor across a whole city wall)
    for (const k of [0, 1, 2, 3]) {
      const Q = [P[k], P[(k + 1) % 4], P[(k + 2) % 4], P[(k + 3) % 4]];
      const u = sub(Q[1], Q[0]), top = sub(Q[2], Q[3]), uu = dot(u, u);
      if (Math.hypot(...cross(u, top)) > 1e-6 * uu || dot(top, u) <= 0 || dot(top, top) > uu + 1e-9) continue;
      const Qt = [Q[0][0] + top[0], Q[0][1] + top[1], Q[0][2] + top[2]];
      const out = [{ corners: [Q[0], Qt, Q[2], Q[3]], fill: fill(nn) }];
      if (Math.hypot(...sub(Q[1], Qt)) > 1e-6) out.push({ corners: [Qt, Q[1], Q[2]], fill: fill(nn) });
      return out;
    }
  }
  if (P.length === 3) return [{ corners: P, fill: fill(nn) }];
  const f = [];
  for (let i = 1; i < P.length - 1; i++) f.push({ corners: [P[0], P[i], P[i + 1]], fill: fill(nn) });
  return f;
}

/** A solid mass → lit faces. `L` is the scene light; `tile` ({ us, mpu }) sizes a `surface` skin. */
export function solidFaces(b, L, tile) {
  const faces = b.solid === 'ring' ? solidFacesBare(b, L) : solidFacesBare(b, L).map(seal);   // a ring keeps its hole
  if (!b.surface || !tile) return faces;
  // upright faces wear the surface tile (a mosaic, a brick skin), sized in metres like the ground
  const key = groundKey(b.surface, b.tint || '#a08a6a'), px = (GROUND_SURFACES[b.surface] / tile.mpu) * tile.us;
  for (const f of faces) {
    if (f.corners.length !== 4) continue;
    const up = Math.abs(f.corners[3][2] - f.corners[0][2]) > Math.abs(f.corners[1][2] - f.corners[0][2]);
    if (up) Object.assign(f, { bg: `var(--${key}) 0 0 / ${px.toFixed(2)}px ${px.toFixed(2)}px repeat`, texture: key });
  }
  return faces;
}
/**
 * Small faces (a reed post's facets, a vase's) are only a pixel or two wide on the page, and Chrome
 * leaves hairline gaps between layers that thin: grow each small face a touch about its centre so
 * neighbours overlap. Big faces are left exactly as built.
 */
function seal(f) {
  const c = f.corners, edges = c.map((p, i) => Math.hypot(...sub(c[(i + 1) % c.length], p))), short = Math.min(...edges);
  if (short > 0.6 || c.length !== 4) return f;   // fan triangles would spike past the outline
  // each corner moves a fixed hair outward from the centre (a proportional grow sent a long thin face —
  // a cornice strip, a wall top — metres past its ends as spikes), but never more than a sliver of the
  // face's short side: on a statue's small facets a fixed hair is a jagged fringe
  const m = centroid(c), grow = Math.min(0.025, short * 0.1);
  return { ...f, corners: c.map((p) => { const v = sub(p, m), l = Math.hypot(...v) || 1; return [p[0] + (v[0] / l) * grow, p[1] + (v[1] / l) * grow, p[2] + (v[2] / l) * grow]; }) };
}
function solidFacesBare(b, L) {
  const tint = b.tint || '#a08a6a', shade = (n) => scaleHex(tint, litFactor(n, L));
  const faces = [];
  const add = (pts, c) => faces.push(...polyFaces(pts, sub(centroid(pts), c), shade));
  const { x, y, w, d, z0, z1 } = b, x1 = x + w, y1 = y + d;
  if (b.solid === 'panel') {
    // a single planar face, given by its corners and the side it faces (a canal's sloping revetment)
    faces.push(...polyFaces(b.pts, b.out, shade));
  } else if (b.solid === 'frustum') {
    const t = b.top || { x, y, w, d }, tx1 = t.x + t.w, ty1 = t.y + t.d;
    const B = [[x, y, z0], [x1, y, z0], [x1, y1, z0], [x, y1, z0]], T = [[t.x, t.y, z1], [tx1, t.y, z1], [tx1, ty1, z1], [t.x, ty1, z1]];
    const c = centroid([...B, ...T]);
    add(T, c);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; add([B[i], B[j], T[j], T[i]], c); }
  } else if (b.solid === 'wedge') {
    // the high edge is at the `rise` side; the low edge sits at z0
    const hi = { 'x+': (p) => p[0] === x1, 'x-': (p) => p[0] === x, 'y+': (p) => p[1] === y1, 'y-': (p) => p[1] === y }[b.rise || 'y+'];
    const base = [[x, y], [x1, y], [x1, y1], [x, y1]];
    const B = base.map(([px, py]) => [px, py, z0]), T = base.map(([px, py]) => [px, py, hi([px, py]) ? z1 : z0]);
    const c = [x + w / 2, y + d / 2, z0 + (z1 - z0) / 3];
    add(T, c);   // the slope
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, side = [B[i], B[j], T[j], T[i]].filter((p, k, a) => k < 2 || p[2] !== a[3 - k][2]);
      if (side.length >= 3) add(side, c);
    }
  } else if (b.solid === 'palm') {
    const H = z1 - z0, cx = x + w / 2, cy = y + d / 2, [lx, ly] = (b.lean || [0, 0]).map((v) => v * H);
    const r0 = Math.min(w, d) * 0.3, r1 = r0 * 0.6, top = { x: cx + lx - r1, y: cy + ly - r1, w: 2 * r1, d: 2 * r1 };
    faces.push(...solidFacesBare({ solid: 'frustum', x: cx - r0, y: cy - r0, w: 2 * r0, d: 2 * r0, z0, z1, top, tint: b.trunkTint || '#7a6a55' }, L));
    const C = [cx + lx, cy + ly, z1], leaf = b.tint || '#6f7f45';
    const lit = (pts) => { let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))); if (n[2] < 0) n = [-n[0], -n[1], -n[2]]; return scaleHex(leaf, litFactor(n, L)); };
    for (let i = 0; i < (b.dates || 0); i++) {   // date clusters hanging under the crown
      const a = (i / b.dates) * 6.283 + 0.6, r = r1 * 2.2, s = H * 0.05;
      faces.push(...solidFacesBare({ solid: 'frustum', x: C[0] + Math.cos(a) * r - s / 2, y: C[1] + Math.sin(a) * r - s / 2, w: s, d: s, z0: z1 - H * 0.1, z1: z1 - H * 0.02, top: { x: C[0] + Math.cos(a) * r - s * 0.7, y: C[1] + Math.sin(a) * r - s * 0.7, w: s * 1.4, d: s * 1.4 }, tint: '#c27a32' }, L));
    }
    for (const f of b.fronds || []) {
      const len = f.len * H, dir = [Math.cos(f.a), Math.sin(f.a)], side = [-dir[1] * len * 0.13, dir[0] * len * 0.13, 0];
      const P1 = [C[0] + dir[0] * len * 0.55, C[1] + dir[1] * len * 0.55, C[2] + len * (0.18 - f.droop * 0.2)];
      const P2 = [P1[0] + dir[0] * len * 0.45, P1[1] + dir[1] * len * 0.45, P1[2] - len * f.droop];
      const a = [C[0] - side[0], C[1] - side[1], C[2]], bb = [C[0] + side[0], C[1] + side[1], C[2]];
      const q = [a, bb, [P1[0] + side[0], P1[1] + side[1], P1[2]], [P1[0] - side[0], P1[1] - side[1], P1[2]]];
      faces.push({ corners: q, fill: lit(q), doubleSided: true });
      const t = [q[3], q[2], P2];
      faces.push({ corners: t, fill: lit(t), doubleSided: true });
    }
  } else if (b.solid === 'drum' || b.solid === 'dome') {
    const N = b.sides || 10, cx = x + w / 2, cy = y + d / 2, rx0 = w / 2, ry0 = d / 2;
    const ring = (f, z) => Array.from({ length: N }, (_, i) => { const a = (i / N) * 6.2832; return [cx + Math.cos(a) * rx0 * f, cy + Math.sin(a) * ry0 * f, z]; });
    const bands = b.solid === 'dome' ? Array.from({ length: 5 }, (_, k) => [Math.cos((k / 5) * 1.5708), z0 + (z1 - z0) * Math.sin((k / 5) * 1.5708)]).concat([[0.18, z1]]) : [[1, z0], [b.taper ?? 1, z1]];
    const c = [cx, cy, z0 + (z1 - z0) * 0.4];
    for (let k = 0; k < bands.length - 1; k++) {
      const lo = ring(bands[k][0], bands[k][1]), hi = ring(bands[k + 1][0], bands[k + 1][1]);
      for (let i = 0; i < N; i++) { const j = (i + 1) % N; add([lo[i], lo[j], hi[j], hi[i]], c); }
    }
    const capR = bands[bands.length - 1][0];
    if (capR > 0.01 && !b.open) add(ring(capR, z1), [cx, cy, z1 - 1]);
    if (b.solid === 'drum' && b.open) {   // an open top (a well head, a jar): the inner wall shows, facing in
      const lip = b.lip || Math.min(w, d) * 0.12, inR = 1 - (2 * lip) / Math.min(w, d), loI = ring(inR * (b.taper ?? 1), z0 + (z1 - z0) * 0.3), hiI = ring(inR * (b.taper ?? 1), z1);
      for (let i = 0; i < N; i++) { const j = (i + 1) % N, q = [loI[i], loI[j], hiI[j], hiI[i]]; faces.push(...polyFaces(q, sub([cx, cy, centroid(q)[2]], centroid(q)), shade)); }
      const top = ring(b.taper ?? 1, z1), inner = ring(inR * (b.taper ?? 1), z1 + 0.001);
      for (let i = 0; i < N; i++) { const j = (i + 1) % N; add([top[i], top[j], inner[j], inner[i]], [cx, cy, z1 - 1]); }   // the lip
    }
  } else if (b.solid === 'ring') {
    // the hoop stands across the rect's long side: in the x–z plane, or the y–z plane once turned east/west
    const inY = b.plane === 'y', span = inY ? d : w, R = span / 2, r = R - (b.band || R * 0.22), N = 14, cz = (z0 + z1) / 2;
    const cA = inY ? y + d / 2 : x + w / 2, swap = (p) => (inY ? [p[1], p[0], p[2]] : p);
    const lo = inY ? x : y, hi = inY ? x1 : y1;
    const pt = (rad, i, depth) => { const a = (i / N) * 6.2832; return swap([cA + Math.cos(a) * rad, depth, cz + Math.sin(a) * rad]); };
    const c = swap([cA, (lo + hi) / 2, cz]);
    for (let i = 0; i < N; i++) {
      const j = i + 1;
      add([pt(R, i, lo), pt(R, j, lo), pt(R, j, hi), pt(R, i, hi)], c);                 // outer
      const inner = [pt(r, i, lo), pt(r, i, hi), pt(r, j, hi), pt(r, j, lo)];
      faces.push(...polyFaces(inner, sub(c, centroid(inner)), shade));                  // inner faces the hole
      add([pt(R, i, lo), pt(r, i, lo), pt(r, j, lo), pt(R, j, lo)], swap([cA, hi + 1, cz]));      // front
      add([pt(R, i, hi), pt(r, i, hi), pt(r, j, hi), pt(R, j, hi)], swap([cA, lo - 1, cz]));   // back
    }
  } else if (b.solid === 'vault') {
    const alongY = (b.axis || 'y') === 'y', span = alongY ? w : d, R = span / 2, N = 8;
    const spring = z1 - Math.min(R, z1 - z0);   // the walls rise to the spring line, the crown is R above
    const prof = Array.from({ length: N + 1 }, (_, i) => { const a = Math.PI * (1 - i / N); return [R + R * Math.cos(a), spring + (z1 - spring) * Math.sin(a)]; });   // across the span
    const P = (s, len, z) => (alongY ? [x + s, y + len, z] : [x + len, y + s, z]);
    const L0 = 0, L1 = alongY ? d : w, c = P(R, L1 / 2, spring);
    add([P(0, L0, z0), P(0, L1, z0), P(0, L1, spring), P(0, L0, spring)], c);
    add([P(span, L0, z0), P(span, L1, z0), P(span, L1, spring), P(span, L0, spring)], c);
    for (let i = 0; i < N; i++) add([P(prof[i][0], L0, prof[i][1]), P(prof[i + 1][0], L0, prof[i + 1][1]), P(prof[i + 1][0], L1, prof[i + 1][1]), P(prof[i][0], L1, prof[i][1])], c);
    // the ends: a wall below the spring and the arch above it; an open end is dark
    for (const [end, Lz] of b.caps === false ? [] : [['lo', L0], ['hi', L1]]) {
      const cap = [P(0, Lz, z0), P(span, Lz, z0), ...prof.slice().reverse().map(([s, z]) => P(s, Lz, z))];
      if (b.open === end) {
        const dark = (n) => scaleHex(tint, 0.32 * litFactor(n, L) + 0.08);
        faces.push(...polyFaces(cap, sub(centroid(cap), c), dark));
      } else add(cap, c);
    }
  }
  return faces;
}

/** Scale a solid mass (its rect, heights and top rect) by s. */
export function scaleSolid(b, s) {
  const o = { ...b, x: b.x * s, y: b.y * s, w: b.w * s, d: b.d * s, z0: b.z0 * s, z1: b.z1 * s };
  if (b.top) o.top = { x: b.top.x * s, y: b.top.y * s, w: b.top.w * s, d: b.top.d * s };
  for (const k of ['band', 'lip']) if (b[k]) o[k] = b[k] * s;
  if (b.pts) o.pts = b.pts.map((p) => p.map((v) => v * s));   // every length scales, or a ring's band outgrows the ring
  return o;
}
