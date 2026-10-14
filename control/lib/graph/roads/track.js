/**
 * track — a roadway built for driving games: a CIRCUIT (a lap) or a STAGE (point to point), drawn from a course
 * (course.js) at its class's scale, in metres (1 u = 1 m, z-up). The corridor (roadway.js, a divided freeway) is the
 * roadway's third form and is not drawn here.
 *
 * Its cross-section is one carriageway centred on the line (TRACK_TEMPLATES): the road, kerbs on the corners, run-off,
 * a barrier; left-positive offsets, the same either side. The road and kerbs bank as one plane about the centreline
 * (the inside of a bend lower, at the alignment's superelevation); run-off and barrier hold the kerb's edge height.
 *
 * It owns its ground. The terrain is a grid over the course and a margin: under the footprint (and an apron of a cell
 * and a half) a little below the road there, from the LOWEST pass over a point (so a crossing's lower road keeps its
 * ground); beyond, eased from the nearby edges toward the course's mean height over 50 m. A ramp or a bridge approach
 * stands above it on walls (skirts) down to it; over a crossing the upper pass is a deck (no skirts), its soffit the
 * class's clearance over the lower road. Far ground runs to the horizon around the grid, in 500 m tiles (one huge quad
 * crossing the camera plane breaks the log depth buffer: the corridor's lesson).
 *
 * `trackCensus(plan)` measures what was drawn: road width from its edge vertices, radius, grade off the ramps, bank
 * from the edges' heights, the closure, clearance under the deck over the lower road's lattice, the terrain under every
 * point of every footprint, and each ramp's landing. Deterministic: no dice beyond the course's seed.
 */
import { face, faceOut, texFace, boxFaces } from './road-faces.js';
import { roadwayCourse, selfClearance, DECK } from './course.js';
import { designClass } from './classes.js';
import { trackContract } from './contract.js';
import { driveSurfaceTable } from './surface.js';
import { SURFACES } from './surfaces.js';
import { mulberry32 } from '../vegetation/grow.js';
import { trackKit } from './track-kit.js';
import { racingLine } from './contract.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const TILE = 2.5, GRASS_TILE = 4;
const SINK = 0.12;                   // m the terrain sits under the road it carries
const EASE = 50;                     // m over which the land beyond a footprint eases to the course's mean height
const FAR = 6000;                    // m of far ground each way
// a stage's start line far enough in for a grid of eight behind it (four rows, 4 m + 6 m a row), its finish line
export const STAGE_START = 30, STAGE_FINISH = 11;

export { SURFACES };

/** Per class: the road's surface, an edge line's width, kerbs (on the corners), run-off (and its surface outside a
 *  corner), a barrier. Each side sums with half the road to half the class's footprint. */
export const TRACK_TEMPLATES = Object.freeze({
  kart: Object.freeze({ road: 'asphalt', edgeLine: 0.2, kerb: 1.0, runoff: 4, runoffSurface: 'grass', outside: 'grass', barrier: Object.freeze({ kind: 'tyres', w: 0.9, h: 0.8, hex: '#2c2c2e' }) }),
  circuit: Object.freeze({ road: 'asphalt', edgeLine: 0.25, kerb: 1.2, runoff: 8, runoffSurface: 'grass', outside: 'gravel', barrier: Object.freeze({ kind: 'armco', w: 0.3, h: 0.75, hex: '#b4b8bb' }) }),
  rally: Object.freeze({ road: 'gravel', edgeLine: 0, kerb: 0, runoff: 2.5, runoffSurface: 'grass', outside: 'grass', barrier: null }),
});
export const TRACK_FORMS = Object.freeze(['circuit', 'stage']);
const COLOR = { kerbRed: '#c8302c', kerbWhite: '#eeeeea', line: '#eceae3', check: '#1d1d1f', lip: '#e2b62a', fill: '#b9ab8f', concrete: '#cdc9bf' };
const KERB_K = 1 / 300;              // curvature over which a station is a corner's (and wears kerbs)

/** The cross-section's offsets for a class: half widths out to each band's outer edge. */
export function trackSection(className) {
  const cls = designClass(className), T = TRACK_TEMPLATES[className];
  if (!T) throw new Error(`roadway: a ${className} has no track template (${Object.keys(TRACK_TEMPLATES).join(', ')})`);
  const road = cls.roadW / 2, kerb = road + T.kerb, runoff = kerb + T.runoff, outer = runoff + (T.barrier?.w ?? 0);
  return { cls, T, road, kerb, runoff, outer };
}

// the frame: a point `off` metres left of the line at a station, `dz` over the drawn surface
function frame(X) {
  const bank = (st, off) => { const o = Math.max(-X.kerb, Math.min(X.kerb, off)); return -Math.sign(st.k) * st.e * o; };
  const P = (st, off, dz = 0) => [st.x - Math.sin(st.heading) * off, st.y + Math.cos(st.heading) * off, st.z + bank(st, off) + dz];
  return { P, bank };
}

/** The course (preset name or spec) for a manifest, as its form asks: a circuit is a lap, a stage is open. */
export function trackCourse(m) {
  const form = m.form;
  const given = m.course ?? (form === 'stage' ? 'rally-stage' : 'kart-oval');
  const course = typeof given === 'string' ? roadwayCourse(given) : roadwayCourse(form === 'stage' ? { ...given, closed: false } : { ...given, closed: given.closed ?? true });
  if (form === 'circuit' && !course.closed) throw new Error(`roadway: a circuit is a lap; course '${typeof given === 'string' ? given : 'spec'}' is open (form: 'stage')`);
  if (form === 'stage' && course.closed) throw new Error(`roadway: a stage runs end to end; course '${typeof given === 'string' ? given : 'spec'}' is a lap (form: 'circuit')`);
  return course;
}

/**
 * planTrack(manifest) → { course, alignment, X, stations, faces, sections, terrain, deck, crossings, cameras, … }
 * Manifest: { form: 'circuit' | 'stage', course: <preset name | spec>, dress?: true | { trees?, rocks?, clear? }, seed? }.
 */
export function planTrack(m = {}) {
  if (!TRACK_FORMS.includes(m.form)) throw new Error(`roadway: form '${m.form}' is not one of ${TRACK_FORMS.join(', ')} (or corridor)`);
  const course = trackCourse(m), a = course.alignment, L = a.length;
  const X = trackSection(course.class), { P, bank } = frame(X), T = X.T;
  const fine = course.class === 'circuit' ? 2 : 1, coarse = course.class === 'circuit' ? 8 : 4;
  const st = a.stations({ fine, coarse });
  const n = st.length, segs = a.closed ? n : n - 1;
  const next = (i) => (i + 1) % n;
  const sOf = (i, j) => (j < i ? st[j].s + L : st[j].s);          // a lap's last segment runs on past L
  const baseZ = (s) => (a.profile.base ? a.profile.base(s) : a.profile.z(s));
  // the ground's grade: the base's own (a ramp's slope is the ramp's, not the land's)
  const baseGrade = (s) => { const h = 0.25; return (baseZ(Math.min(L, s + h)) - baseZ(Math.max(0, s - h))) / (Math.min(L, s + h) - Math.max(0, s - h)); };
  const deck = course.crossingDeck ?? null;
  const onDeck = (s) => !!deck && s >= deck.s0 - 1e-6 && s <= deck.s1 + 1e-6;
  const faces = [], sections = [], colliders = [];
  // the kit (`kit`, track-kit.js): every surface in its world's look; absent, the roadway's own tiles and colours
  const K = m.kit ? trackKit(m.kit) : null;
  const KIT_OF = { asphalt: 'asphalt', gravel: 'gravel', grass: 'grass', dirt: 'earth', sand: 'earth' };
  const BARRIER_OF = { tyres: 'tyre', armco: 'steel' };
  const surf = (name, c, uvs) => (K ? K.surface(KIT_OF[name] ?? name, c, uvs) : texFace(c, SURFACES[name].hex, SURFACES[name].texture, uvs));
  const paint = (name, c, hex) => (K ? K.paint(name, c) : face(c, hex));
  const wall = (mat, c, hex, inside) => (K ? K.wall(mat, c, inside) : faceOut(c, hex, inside));

  // the ground: built first, so the skirts know where it is
  const terrain = buildTerrain({ a, X, bank, baseZ, baseGrade });
  const groundAt = (x, y) => terrainAt(terrain, x, y);

  for (const p of st) sections.push({ s: p.s, left: P(p, X.road), right: P(p, -X.road) });
  for (let i = 0; i < segs; i++) {
    const j = next(i), A = st[i], B = st[j], sA = A.s, sB = sOf(i, j);
    const corner = Math.abs(A.k) > KERB_K || Math.abs(B.k) > KERB_K, kMid = (A.k + B.k) / 2;
    for (const side of [1, -1]) {
      const quad = (o0, o1, dz = 0) => [P(A, side * o0, dz), P(A, side * o1, dz), P(B, side * o1, dz), P(B, side * o0, dz)];
      const uv = (o0, o1, t = TILE) => [[sA / t, (side * o0) / t], [sA / t, (side * o1) / t], [sB / t, (side * o1) / t], [sB / t, (side * o0) / t]];
      faces.push(surf(T.road, quad(0, X.road), uv(0, X.road)));
      if (T.edgeLine) faces.push(paint('line', quad(X.road - 0.35 - T.edgeLine, X.road - 0.35, 0.012), COLOR.line));
      if (T.kerb) {
        if (corner) { const white = Math.floor((sA + sB) / 4) % 2; faces.push(paint(white ? 'kerbWhite' : 'kerbRed', quad(X.road, X.kerb, 0.02), white ? COLOR.kerbWhite : COLOR.kerbRed)); }
        else faces.push(surf(T.runoffSurface, quad(X.road, X.kerb), uv(X.road, X.kerb, GRASS_TILE)));
      }
      const outside = corner && Math.sign(kMid) * side < 0;
      faces.push(surf(outside ? T.outside : T.runoffSurface, quad(X.kerb, X.runoff), uv(X.kerb, X.runoff, GRASS_TILE)));
      if (T.barrier) {
        const b = T.barrier, f0a = P(A, side * X.runoff), f0b = P(B, side * X.runoff), f1a = P(A, side * X.outer), f1b = P(B, side * X.outer);
        const up = (p) => [p[0], p[1], p[2] + b.h], mid = [(f0a[0] + f1b[0]) / 2, (f0a[1] + f1b[1]) / 2];
        const bm = BARRIER_OF[b.kind] ?? 'concrete';
        faces.push(wall(bm, [f0a, f0b, up(f0b), up(f0a)], b.hex, mid));
        faces.push(wall(bm, [f1b, f1a, up(f1a), up(f1b)], b.hex, mid));
        faces.push(K ? K.surface(bm, [up(f0a), up(f0b), up(f1b), up(f1a)], [[sA / TILE, 0], [sB / TILE, 0], [sB / TILE, b.w / TILE], [sA / TILE, b.w / TILE]]) : face([up(f0a), up(f0b), up(f1b), up(f1a)], b.hex));
        // its walls for the drive rule: boxes round pieces of 2 m or less (a long diagonal box would reach the road)
        const k = Math.max(1, Math.ceil(Math.hypot(f0b[0] - f0a[0], f0b[1] - f0a[1]) / 2)), lerp = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
        for (let u = 0; u < k; u++) {
          const c = [lerp(f0a, f0b, u / k), lerp(f0a, f0b, (u + 1) / k), lerp(f1a, f1b, u / k), lerp(f1a, f1b, (u + 1) / k)];
          const xs = c.map((q) => q[0]), ys = c.map((q) => q[1]), zs = c.map((q) => q[2]);
          colliders.push({ min: [r3(Math.min(...xs)), r3(Math.min(...ys)), r3(Math.min(...zs))], max: [r3(Math.max(...xs)), r3(Math.max(...ys)), r3(Math.max(...zs) + b.h)], of: 'roadway:barrier' });
        }
      }
      // the outer edge: a deck's fascia over a crossing, else a wall down to the ground wherever the road stands on it
      const ea = P(A, side * X.outer), eb = P(B, side * X.outer);
      if (onDeck(sA) && onDeck(B.s)) {
        faces.push(wall('concrete', [ea, eb, [eb[0], eb[1], eb[2] - DECK], [ea[0], ea[1], ea[2] - DECK]], COLOR.concrete, [A.x, A.y]));
      } else {
        const ga = groundAt(ea[0], ea[1]), gb = groundAt(eb[0], eb[1]);
        // the ground sits SINK under every edge by design: a wall stands only where the road is higher than that
        if (ea[2] - ga > SINK + 0.1 || eb[2] - gb > SINK + 0.1) faces.push(wall('earth', [ea, eb, [eb[0], eb[1], Math.min(gb, eb[2])], [ea[0], ea[1], Math.min(ga, ea[2])]], COLOR.fill, [A.x, A.y]));
      }
    }
    // a crossing's deck: its soffit under the whole footprint
    if (onDeck(sA) && onDeck(B.s)) {
      const d = [P(A, X.outer, -DECK), P(B, X.outer, -DECK), P(B, -X.outer, -DECK), P(A, -X.outer, -DECK)];
      faces.push(face(d, K ? K.flat('concrete', 1) : COLOR.concrete, { keepWinding: true }));
    }
  }
  // markings: a lap's start line (a stage's start and finish), a band before every ramp's lip
  const across = (s, len, hex, cells = 1) => {
    const p0 = a.at(s), p1 = a.at(s + len), w = (2 * X.road) / cells;
    for (let c = 0; c < cells; c++) for (let r = 0; r < (cells > 1 ? 2 : 1); r++) {
      if (cells > 1 && (c + r) % 2) continue;
      const q0 = a.at(s + (len / 2) * r), q1 = a.at(s + (len / 2) * (r + 1)), o0 = -X.road + c * w, o1 = o0 + w;
      const A2 = cells > 1 ? q0 : p0, B2 = cells > 1 ? q1 : p1;
      faces.push(paint(hex === COLOR.check ? 'check' : 'lip', [P(A2, o0, 0.015), P(A2, o1, 0.015), P(B2, o1, 0.015), P(B2, o0, 0.015)], hex));
    }
  };
  const lines = { start: a.closed ? 0 : STAGE_START, finish: a.closed ? 0 : L - STAGE_FINISH };
  for (const s of a.closed ? [0] : [lines.start, lines.finish]) across(s, 1, COLOR.check, Math.round((2 * X.road) / 0.5));
  for (const r of course.ramps) if (r.lip) across(r.lip.s - 0.6, 0.5, COLOR.lip);

  // the kit's wear on the road: the racing line rubbered dark through every corner, and repairs
  if (K) faces.push(...roadWear({ a, X, K, P, seed: Number.isInteger(m.seed) ? m.seed : 1 }));
  faces.push(...terrainFaces(terrain, K));
  faces.push(...farGround(terrain, K));
  const crossings = selfClearance(a, { width: X.outer * 2, margin: 1 }).crossings;
  // the land dressed (`dress`): trees and rocks on the track's own ground, clear of every footprint
  const props = m.dress ? dressProps({ a, X, terrain, dress: m.dress, seed: Number.isInteger(m.seed) ? m.seed : 1 }) : [];
  for (const q of props) faces.push(...propFaces(q));
  const cameras = trackCameras({ a, X, P, course, deck, crossings });
  return { form: m.form, course, alignment: a, X, stations: st, faces, sections, terrain, groundAt, lines, deck, crossings, colliders, props, cameras, advisories: course.advisories, length: L };
}

// ── the ground ───────────────────────────────────────────────────────────────────────────────────
function buildTerrain({ a, X, bank, baseZ, baseGrade }) {
  const L = a.length, step = 2, ns = Math.max(8, Math.round(L / step)), count = a.closed ? ns : ns + 1;
  // an open road's ends carry their footprint on past them by the apron (else the ground beyond rises into the end)
  const S = Array.from({ length: count }, (_, i) => { const p = a.at((i * L) / ns); return { x: p.x, y: p.y, h: p.heading, k: p.k, e: p.e, z: baseZ(p.s), g: baseGrade(p.s), end: a.closed ? 0 : i === 0 ? -1 : i === count - 1 ? 1 : 0 }; });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, zs = 0;
  for (const p of S) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); zs += p.z; }
  const zFar = zs / S.length - SINK, margin = X.outer + EASE + 20;
  const extent = Math.max(x1 - x0, y1 - y0) + 2 * margin, cell = Math.max(2.5, Math.min(8, extent / 160));
  const gx0 = Math.floor((x0 - margin) / cell) * cell, gy0 = Math.floor((y0 - margin) / cell) * cell;
  const nx = Math.ceil((x1 + margin - gx0) / cell), ny = Math.ceil((y1 + margin - gy0) / cell);
  const apron = 1.5 * cell, reach = X.outer + apron + EASE, H = 16, hash = new Map();
  S.forEach((p, i) => { const k = `${Math.floor(p.x / H)},${Math.floor(p.y / H)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i); });
  const z = new Float64Array((nx + 1) * (ny + 1)), foot = new Uint8Array((nx + 1) * (ny + 1));
  const R = Math.ceil(reach / H), along = (step * 0.6) + 1e-6;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const x = gx0 + i * cell, y = gy0 + j * cell, hx = Math.floor(x / H), hy = Math.floor(y / H);
    let zin = Infinity, inner = false, wsum = 0, zsum = 0, dmin = Infinity;
    for (let u = hx - R; u <= hx + R; u++) for (let v = hy - R; v <= hy + R; v++) for (const q of hash.get(`${u},${v}`) ?? []) {
      const p = S[q], dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
      if (d > reach) continue;
      dmin = Math.min(dmin, d);
      const t = dx * Math.cos(p.h) + dy * Math.sin(p.h), o = -dx * Math.sin(p.h) + dy * Math.cos(p.h);
      // a station's window along, widened where the stations fan apart (the outside of a bend, far from the line)
      const win = along * (1 + Math.abs(p.k * o)), lo = p.end === -1 ? -apron : -win, hi = p.end === 1 ? apron : win;
      if (t >= lo && t <= hi && Math.abs(o) <= X.outer + apron) {
        // along the grade to this point (not the station's height), and under a banked road by half a cell's worth of
        // its bank more: the surface kinks flat at the kerb's edge, and a cell's straight chord rides over the kink
        zin = Math.min(zin, p.z + p.g * t + bank(p, o) - SINK - (p.e * cell) / 2);
        if (Math.abs(o) <= X.outer) inner = true;
      }
      const w = 1 / ((Math.max(0, d - X.outer) ** 2 + 9) ** 2);
      wsum += w; zsum += w * (p.z + bank(p, Math.sign(o) * X.outer) - SINK);
    }
    const k = j * (nx + 1) + i;
    if (zin < Infinity) { z[k] = zin; foot[k] = inner ? 1 : 0; continue; }
    if (!wsum) { z[k] = zFar; continue; }
    const t = Math.max(0, Math.min(1, (dmin - X.outer - apron) / EASE)), sm = t * t * (3 - 2 * t);
    z[k] = (zsum / wsum) * (1 - sm) + zFar * sm;
  }
  return { x0: gx0, y0: gy0, cell, nx, ny, z, foot, zFar };
}

/** The terrain's height at a point, on the same two triangles a cell's quad renders as (diagonal 0–2). */
export function terrainAt(T, x, y) {
  const fx0 = (x - T.x0) / T.cell, fy0 = (y - T.y0) / T.cell;
  if (fx0 < 0 || fy0 < 0 || fx0 >= T.nx || fy0 >= T.ny) return T.zFar;
  const i = Math.floor(fx0), j = Math.floor(fy0), fx = fx0 - i, fy = fy0 - j, W = T.nx + 1;
  const z00 = T.z[j * W + i], z10 = T.z[j * W + i + 1], z11 = T.z[(j + 1) * W + i + 1], z01 = T.z[(j + 1) * W + i];
  return fx >= fy ? z00 + fx * (z10 - z00) + fy * (z11 - z10) : z00 + fy * (z01 - z00) + fx * (z11 - z01);
}

function terrainFaces(T, K = null) {
  const out = [], W = T.nx + 1;
  for (let j = 0; j < T.ny; j++) for (let i = 0; i < T.nx; i++) {
    const k = [j * W + i, j * W + i + 1, (j + 1) * W + i + 1, (j + 1) * W + i];
    if (k.every((q) => T.foot[q])) continue;            // under the road: never seen
    const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([u, v], q) => [T.x0 + u * T.cell, T.y0 + v * T.cell, T.z[k[q]]]);
    const uvs = c.map((p) => [p[0] / GRASS_TILE, p[1] / GRASS_TILE]);
    out.push(K ? K.surface('grass', c, uvs) : texFace(c, SURFACES.grass.hex, 'grass-dry', uvs));
  }
  return out;
}

// the road's wear in a kit: the racing line laid dark through each corner (its stations under KERB_K's curvature and
// 25 m either side), and a repair every so often (seeded), each just over the asphalt
function roadWear({ a, X, K, P, seed }) {
  const out = [], L = a.length, line = racingLine({ alignment: a, X }), n = line.length, rnd = mulberry32((seed * 3266489917) >>> 0);
  const near = new Uint8Array(n);
  line.forEach((q, i) => { if (Math.abs(a.at(Math.min(L, (i * L) / (a.closed ? n : n - 1))).k) > KERB_K) for (let d = -8; d <= 8; d++) { const j = a.closed ? (i + d + n) % n : i + d; if (j >= 0 && j < n) near[j] = 1; } });
  // the road's own height under a point (banked through a corner), just over it
  const C = Array.from({ length: Math.max(16, Math.round(L)) + 1 }, (_, i) => a.at(Math.min(L, (i * L) / Math.max(16, Math.round(L)))));
  const onRoad = (x, y) => {
    let st = C[0], d = Infinity; for (const c of C) { const e = (c.x - x) ** 2 + (c.y - y) ** 2; if (e < d) { d = e; st = c; } }
    return P(st, -(x - st.x) * Math.sin(st.heading) + (y - st.y) * Math.cos(st.heading), 0.008)[2];
  };
  // each point's own across (its neighbours' chord), so the strip's quads share their edges
  const w = 0.6, across = line.map((p, i) => {
    const b = line[a.closed ? (i - 1 + n) % n : Math.max(0, i - 1)], f = line[a.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const dx = f.x - b.x, dy = f.y - b.y, l = Math.hypot(dx, dy) || 1; return [(-dy / l) * w, (dx / l) * w];
  });
  for (let i = 0; i < (a.closed ? n : n - 1); i++) {
    const j = (i + 1) % n; if (!near[i] || !near[j]) continue;
    const p = line[i], q = line[j], [px, py] = across[i], [qx, qy] = across[j];
    const c = [[p.x - px, p.y - py], [q.x - qx, q.y - qy], [q.x + qx, q.y + qy], [p.x + px, p.y + py]].map(([x, y]) => [x, y, onRoad(x, y)]);
    out.push(K.surface('rubber', c, c.map((v) => [v[0] / TILE, v[1] / TILE])));
  }
  for (let s = 20; s < L - 10; s += 45) {
    if (rnd() > 0.35) continue;
    const len = 2 + rnd() * 5, off = (rnd() - 0.5) * (X.road * 1.2), wd = 0.8 + rnd() * 1.6;
    const A = a.at(s), B = a.at(Math.min(L, s + len));
    const c = [P(A, off - wd / 2, 0.004), P(B, off - wd / 2, 0.004), P(B, off + wd / 2, 0.004), P(A, off + wd / 2, 0.004)];
    out.push(K.surface('patch', c, c.map((v) => [v[0] / TILE, v[1] / TILE])));
  }
  return out;
}

// the far ground: 500 m tiles to FAR each way, cut round the terrain grid (never under it)
function farGround(T, K = null) {
  const out = [], bx0 = T.x0, by0 = T.y0, bx1 = T.x0 + T.nx * T.cell, by1 = T.y0 + T.ny * T.cell, cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, cell = 500;
  const rect = (x0, y0, x1, y1) => { if (x1 - x0 < 1e-6 || y1 - y0 < 1e-6) return; const c = [[x0, y0, T.zFar], [x1, y0, T.zFar], [x1, y1, T.zFar], [x0, y1, T.zFar]], uvs = c.map((p) => [p[0] / GRASS_TILE, p[1] / GRASS_TILE]); out.push(K ? K.surface('grass', c, uvs) : texFace(c, SURFACES.grass.hex, 'grass-dry', uvs)); };   // the terrain's own grass: no seam at the grid's edge
  for (let gx = cx - FAR; gx < cx + FAR; gx += cell) for (let gy = cy - FAR; gy < cy + FAR; gy += cell) {
    const x0 = gx, y0 = gy, x1 = gx + cell, y1 = gy + cell;
    if (x1 <= bx0 || x0 >= bx1 || y1 <= by0 || y0 >= by1) { rect(x0, y0, x1, y1); continue; }
    rect(x0, y0, x1, Math.max(y0, by0)); rect(x0, Math.min(y1, by1), x1, y1);
    const ya = Math.max(y0, by0), yb = Math.min(y1, by1);
    rect(x0, ya, Math.max(x0, bx0), yb); rect(Math.min(x1, bx1), ya, x1, yb);
  }
  return out;
}

// ── the land dressed ─────────────────────────────────────────────────────────────────────────────
/** What `dress` stands on the land: `true`, or { trees?, rocks? } as shares of a full stand (0–1; true is 0.5 and
 *  0.15), `clear` metres off every footprint (8). Seeded points on a jittered grid over the terrain, none nearer the
 *  line than its footprint and `clear`. → [{ kind: 'tree' | 'rock', at, size, seed }] */
export const DRESS = Object.freeze({ trees: 0.5, rocks: 0.15, clear: 8, pitch: 14 });
function dressProps({ a, X, terrain: T, dress, seed }) {
  const D = { ...DRESS, ...(dress === true ? {} : dress) }, rnd = mulberry32((seed * 2246822519) >>> 0), out = [];
  const keep = X.outer + D.clear, near = trackNear(a, keep);
  const x1 = T.x0 + T.nx * T.cell, y1 = T.y0 + T.ny * T.cell;
  for (let x = T.x0 + D.pitch / 2; x < x1; x += D.pitch) for (let y = T.y0 + D.pitch / 2; y < y1; y += D.pitch) {
    const r = rnd(), px = x + (rnd() - 0.5) * D.pitch * 0.8, py = y + (rnd() - 0.5) * D.pitch * 0.8, size = 0.7 + 0.6 * rnd(), s2 = (rnd() * 1e9) >>> 0;
    const kind = r < D.trees ? 'tree' : r < D.trees + D.rocks ? 'rock' : null;
    if (!kind || near(px, py)) continue;
    out.push({ kind, at: [r3(px), r3(py), r3(terrainAt(T, px, py))], size: r3(size), seed: s2 });
  }
  return out;
}
// is a point within `d` of the line (in plan)?
function trackNear(a, d) {
  const L = a.length, n = Math.max(8, Math.round(L / 2)), P = Array.from({ length: n + 1 }, (_, i) => a.at((i * L) / n)), H = Math.max(8, d), hash = new Map();
  P.forEach((p, i) => { const k = `${Math.floor(p.x / H)},${Math.floor(p.y / H)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i); });
  return (x, y) => { const hx = Math.floor(x / H), hy = Math.floor(y / H); for (let u = hx - 1; u <= hx + 1; u++) for (let v = hy - 1; v <= hy + 1; v++) for (const i of hash.get(`${u},${v}`) ?? []) if (Math.hypot(P[i].x - x, P[i].y - y) < d) return true; return false; };
}
// a low tree (a trunk and two tiers of crown) or a rock, yawed by its seed
function propFaces(q) {
  const yaw = (q.seed % 628) / 100, [x, y, z] = q.at, s = q.size;
  if (q.kind === 'rock') return boxFaces([x, y, z - 0.2], [2.2 * s, 1.6 * s, 1.1 * s + 0.2], yaw, '#a9a294');
  return [
    ...boxFaces([x, y, z - 0.1], [0.45 * s, 0.45 * s, 2.4 * s + 0.1], yaw, '#6e5a43'),
    ...boxFaces([x, y, z + 2.0 * s], [3.4 * s, 3.4 * s, 2.6 * s], yaw + 0.4, '#58733c'),
    ...boxFaces([x, y, z + 4.4 * s], [2.2 * s, 2.2 * s, 2.0 * s], yaw + 1.1, '#4f6a36'),
  ];
}

// ── shots ────────────────────────────────────────────────────────────────────────────────────────
function trackCameras({ a, X, P, course, deck, crossings }) {
  const pc = [560, 390], L = a.length, s0 = a.closed ? L - 12 : STAGE_START - 12;
  const at = (s) => a.at(a.closed ? s : Math.max(0, Math.min(L, s)));
  const chase = (s, back = 8, up = 2.4) => ({ cameraPosition: P(at(s - back), 0, up), lookAt: P(at(s + 24), 0, 0.8), horizontalFov: 70, pictureCenter: pc });
  const pts = a.stations({ fine: 10, coarse: 20 }), xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
  const cams = [
    { name: 'chase', worldFraming: chase(s0 + 8) },
    { name: 'aerial', worldFraming: { cameraPosition: [cx - span * 0.55, cy - span * 0.75, cz + span * 0.55], lookAt: [cx, cy, cz], horizontalFov: 60, pictureCenter: pc } },
  ];
  const r = course.ramps.find((x) => x.lip) ?? course.ramps[0];
  if (r) {
    const m = at((r.s0 + r.s1) / 2);
    cams.push({ name: 'ramp', worldFraming: { cameraPosition: P(m, X.outer + 18, 3), lookAt: P(m, 0, 1), horizontalFov: 60, pictureCenter: pc } });
    cams.push({ name: 'ramp-chase', worldFraming: chase(r.s0 - 10, 10, 2.2) });
  }
  if (deck && crossings.length) {
    const c = crossings[0], lower = c.upper === 1 ? c.s2 : c.s1;
    cams.push({ name: 'crossing', worldFraming: { cameraPosition: P(at(lower - 40), 0, 1.2), lookAt: P(at(lower), 0, 3), horizontalFov: 70, pictureCenter: pc } });
  }
  return cams;
}

/** The opening shot for `?view=`: a preset by name, or `s<station>` (a chase camera there). */
export function trackViewCamera(plan, view) {
  if (typeof view !== 'string' || !view) return null;
  const preset = plan.cameras.find((c) => c.name === view);
  if (preset) return preset;
  const m = /^s(\d+(?:\.\d+)?)$/.exec(view.trim());
  if (!m) return null;
  const a = plan.alignment, s = +m[1], { P } = frame(plan.X), at = (u) => a.at(a.closed ? u : Math.max(0, Math.min(a.length, u)));
  return { name: `here:${Math.round(s)}`, worldFraming: { cameraPosition: P(at(s - 8), 0, 2.4), lookAt: P(at(s + 24), 0, 0.8), horizontalFov: 70, pictureCenter: [560, 390] } };
}

// ── the census ───────────────────────────────────────────────────────────────────────────────────
export function trackCensus(plan) {
  const { alignment: a, X, sections, stations, terrain, course } = plan, { P } = frame(X);
  const hd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  let wMin = Infinity, wMax = -Infinity, bank = 0;
  for (const r of sections) { const w = hd(r.left, r.right); wMin = Math.min(wMin, w); wMax = Math.max(wMax, w); bank = Math.max(bank, Math.abs(r.left[2] - r.right[2]) / w); }
  const inRamp = (s) => (a.profile.features || []).some((f) => s >= f.s0 - 0.5 && s <= f.s1 + 0.5);
  let rMin = Infinity, gMax = 0;
  for (const p of stations) { if (Math.abs(p.k) > 1e-9) rMin = Math.min(rMin, 1 / Math.abs(p.k)); if (!inRamp(p.s)) gMax = Math.max(gMax, Math.abs(p.grade)); }
  // the ground under every point of every footprint: never above the drawn surface
  let over = -Infinity, at = null;
  for (const p of stations) for (let o = -X.outer; o <= X.outer + 1e-9; o += X.outer / 6) {
    const q = P(p, o), g = terrainAt(terrain, q[0], q[1]);
    if (g - q[2] > over) { over = g - q[2]; at = { s: r3(p.s), o: r3(o) }; }
  }
  // clearance under a crossing's deck: its soffit over the lower road's lattice, wherever the deck is above
  const clearances = plan.crossings.map((c) => {
    const [su, sl] = c.upper === 1 ? [c.s1, c.s2] : [c.s2, c.s1];
    let min = Infinity;
    for (let s = sl - X.outer * 2; s <= sl + X.outer * 2; s += 0.5) for (let o = -X.road; o <= X.road + 1e-9; o += 0.5) {
      const q = P(a.at(s), o);
      // the upper pass over this point: its nearest station along, its offset across
      let best = null;
      for (let u = su - X.outer * 3; u <= su + X.outer * 3; u += 0.25) { const p = a.at(u), d = hd([p.x, p.y], q); if (!best || d < best.d) best = { p, d }; }
      const off = -(q[0] - best.p.x) * Math.sin(best.p.heading) + (q[1] - best.p.y) * Math.cos(best.p.heading);
      if (Math.abs(off) > X.outer) continue;
      const soffit = P(best.p, off)[2] - DECK;
      min = Math.min(min, soffit - q[2]);
    }
    return { s: [c.s1, c.s2], clearance: r3(min) };
  });
  return {
    form: plan.form, class: course.class, length: r3(a.length), closed: a.closed,
    closure: a.closure ?? null,
    roadWidth: [r3(wMin), r3(wMax)], bankMax: r3(bank), radiusMin: r3(rMin), gradeMax: r3(gMax),
    terrainOverRoad: { max: r3(over), at },
    crossings: clearances,
    ramps: course.ramps.map((r) => ({ kind: r.kind, s0: r.s0, band: r.band })),
    // what stands nearest the line (a prop's footprint): never within the track's own footprint
    propsClear: plan.props.length ? r3(Math.min(...plan.props.map((q) => { let d = Infinity; for (const p of stations) d = Math.min(d, Math.hypot(p.x - q.at[0], p.y - q.at[1])); return d - 1.7 * q.size; })) - X.outer) : null,
    colliders: plan.colliders.length,
    faces: plan.faces.length,
  };
}

/** The census as laws, in the gameworld's shape (lay-concerns.js concernLaws: { concern, law, holds, says }), for a
 *  level's readout. Advisory, as every law: they stamp, none refuse. */
export function trackLaws(c) {
  const C = designClass(c.class), pc = (v) => `${(v * 100).toFixed(1)}%`, L = (law, holds, says) => ({ concern: 'roadway', law, holds, says });
  return [
    L('road-width', Math.abs(c.roadWidth[0] - C.roadW) < 0.01 && Math.abs(c.roadWidth[1] - C.roadW) < 0.01, `the road is ${c.roadWidth[0]}–${c.roadWidth[1]} m wide (${C.roadW} m)`),
    L('corners', c.radiusMin >= C.rmin - 1e-3, `the tightest corner is R ${c.radiusMin} m (R ${C.rmin} m at least)`),
    L('grade', c.gradeMax <= C.gradeMax + 1e-3, `the steepest grade off the ramps is ${pc(c.gradeMax)} (${pc(C.gradeMax)} at most)`),
    L('bank', c.bankMax <= C.emax + 1e-3, `the road banks ${pc(c.bankMax)} at most (${pc(C.emax)})`),
    ...(c.closed ? [L('closes', c.closure.residual < 0.01, `the lap closes to ${(c.closure.residual * 1000).toFixed(1)} mm`)] : []),
    L('on-its-ground', c.terrainOverRoad.max < -0.02, c.terrainOverRoad.max < -0.02 ? 'the ground stands under every point of the track' : `the ground stands ${c.terrainOverRoad.max} m over the track at ${JSON.stringify(c.terrainOverRoad.at)}`),
    ...c.crossings.map((x) => L('clearance', x.clearance >= C.clearance - 0.01, `the deck clears the lower road by ${x.clearance} m (${C.clearance} m)`)),
    ...(c.propsClear != null ? [L('nothing-on-the-track', c.propsClear > 0, `what the land is dressed in stands ${c.propsClear} m clear of the track at nearest`)] : []),
    ...c.ramps.filter((r) => r.kind === 'gap' || r.kind === 'tabletop').map((r) => L('ramp-lands', !!r.band, r.band ? `the ${r.kind} at ${r.s0} m lands at ${(r.band.lo * 3.6).toFixed(0)}–${(r.band.hi * 3.6).toFixed(0)} km/h` : `the ${r.kind} at ${r.s0} m lands at no speed`)),
  ];
}

// ── the world payload ────────────────────────────────────────────────────────────────────────────
export function assembleTrackScene(m = {}, opts = {}) {
  const plan = planTrack(m);
  const first = trackViewCamera(plan, opts.view);
  const cameras = first ? [first, ...plan.cameras.filter((c) => c !== first)] : plan.cameras;
  const V = 3000;
  return {
    faces: plan.faces,
    cameras,
    viewBox: { width: 1120, height: 780 },
    title: opts.title || m.title || 'mojulo roadway',
    bg: '#c6cfda',
    sky: { preset: 'day', zenith: [96, 138, 190], horizon: [198, 207, 218], day: 1, stars: 0, seed: 7 },
    haze: { color: '#c6cfda', density: 1.98 / V },
    metersPerUnit: 1,
    // the barriers' walls (the drive rule's colliders); a level's own entities ride on them
    ...(plan.colliders.length ? { colliders: plan.colliders } : {}),
    // what the tyres are on (surface.js): the page's `surface` hook for a car on the vehicle classes' rule
    driveSurface: driveSurfaceTable(plan),
    // what the track tells a game (contract.js): its stations, lines, checkpoints, grid, racing line, bands, ramps
    roadway: { ...trackContract(plan), ...(plan.course.preset ? { course: plan.course.preset } : {}), advisories: plan.advisories },
  };
}
