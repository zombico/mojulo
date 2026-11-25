/**
 * THE WORKS' FLOOR (a works card's `floor`, opt-in): the floor under an industrial interior designed from above, as a
 * plant's floor is: a pad poured under every unit, a footing under every column and rack post, steel plate round what
 * burns, lanes for the traffic between them, trenches draining along the racks and the frames, and the yard left over.
 * The plan is read off the works themselves (local-meru/works.js), so a unit moved moves its pad; only the lanes and the
 * yard are designed. The land's shader draws it (scene/channels/works-floor-glsl.js): each zone its own way, never one
 * tile: a pad sawcut at its own spacing from its own corner, a kerb round what is bunded; an apron in plates of three
 * sizes; a lane painted and worn in its tracks; a trench's grating over a pit seen in parallax; the yard gravel or great
 * irregular pours; and kibble scattered over them (manholes, drains, anchor plates, oil).
 *
 *   readFloor(spec)              → the floor's words, checked (null when absent)
 *   floorShapes(W, F, centre)    → the plan: [{ kind, at, half, r, kerb }], highest first (trench, apron, pad, lane);
 *                                  `kerb` 1 a kerb round a pad, FOOTINGS a strip of footings every FOOTING_STEP
 *   worksFloor(W, centre, floorAt) → the page's plan: the shapes packed, a grid of cells naming the shapes over each (at
 *                                  most CELL_MAX, the highest kept), the yard, the paint and the kibble
 *
 * The words: { yard: 'concrete' | 'gravel', lanes: [{ path: [[x, y], …], width? }] (runs along the axes), ring: metres
 * in from the hall's walls a lane runs round it (0, none), paint: '#rrggbb' the lanes' lines, kibble: 0..1 }.
 */
import { b64 } from '../scene/emit-util.js';

const f = Object.freeze;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const bad = (m) => { throw new Error(`local-meru: works.floor${m}`); };
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;

export const FLOOR_KINDS = f({ yard: 0, pad: 1, apron: 2, lane: 3, trench: 4 });
const RANK = f([FLOOR_KINDS.trench, FLOOR_KINDS.apron, FLOOR_KINDS.pad, FLOOR_KINDS.lane]);
export const FLOOR = f({ yard: 'concrete', lanes: f([]), ring: 0, paint: '#e0b020', kibble: 0.5 });
export const CELL = 24, CELL_MAX = 8;
// (the floor is what lies within FLOOR_TOP metres over the floor at the centre: a deck's top, a pipe's crown are not)
export const FLOOR_TOP = 1.5;
const LANE_W = 14, TRENCH_HALF = 0.8;
// (a pad's `kerb`: 0 none, 1 a kerb round its edge, FOOTINGS a strip of footings 3.2 m square every FOOTING_STEP along its
// long axis from its start)
export const FOOTINGS = 2, FOOTING_STEP = 12;

export function readFloor(spec) {
  if (spec === undefined || spec === null || spec === false) return null;
  if (!isObj(spec)) bad(' is { yard?, lanes?, ring?, paint?, kibble? }');
  for (const k of Object.keys(spec)) if (!(k in FLOOR)) bad(`.${k} is not a word (words: ${Object.keys(FLOOR).join(', ')})`);
  const F = { ...FLOOR, ...spec };
  if (!['concrete', 'gravel'].includes(F.yard)) bad(".yard is 'concrete' or 'gravel'");
  if (!Array.isArray(F.lanes)) bad('.lanes is a list');
  F.lanes.forEach((L, i) => {
    if (!isObj(L) || !Array.isArray(L.path) || L.path.length < 2) bad(`.lanes[${i}] is { path: [[x, y], …], width? }`);
    L.path.forEach((p) => { if (!(Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) bad(`.lanes[${i}].path is [[x, y], …]`); });
    for (let k = 0; k + 1 < L.path.length; k++) if (L.path[k][0] !== L.path[k + 1][0] && L.path[k][1] !== L.path[k + 1][1]) bad(`.lanes[${i}] runs along the axes: each step changes x or y, not both`);
    if (L.width !== undefined && !(typeof L.width === 'number' && L.width >= 4 && L.width <= 60)) bad(`.lanes[${i}].width is metres, 4..60`);
  });
  if (!(typeof F.ring === 'number' && F.ring >= 0 && F.ring <= 200)) bad('.ring is metres in from the walls, 0 (none)..200');
  if (!/^#[0-9a-f]{6}$/i.test(F.paint)) bad(".paint is a '#rrggbb' colour");
  if (!(typeof F.kibble === 'number' && F.kibble >= 0 && F.kibble <= 1)) bad('.kibble is 0..1');
  return f(F);
}

/** The plan off the works and the floor's lanes: each zone a rectangle (`half`) or a circle (`r`), highest first. */
export function floorShapes(W, F, centre) {
  const [cx, cy] = centre, A = ([x, y]) => [cx + x, cy + y], S = [];
  const rect = (kind, at, half, kerb = 0) => S.push({ kind, at: at.map(r3), half: half.map(r3), r: 0, kerb });
  const circle = (kind, at, r, kerb = 0) => S.push({ kind, at: at.map(r3), half: [r3(r), r3(r)], r: r3(r), kerb });
  const { pad, apron, lane, trench } = FLOOR_KINDS;
  // (a frame's and a scaffold's pad, a trench along its south side; a deck's pad under its legs)
  for (const [list, bay, margin] of [[W.frames, 12, 4], [W.scaffolds, 8, 2]]) for (const q of list) {
    const B = q.bay ?? bay, c = A(q.at), hx = (q.bays[0] * B) / 2 + margin, hy = (q.bays[1] * B) / 2 + margin;
    rect(pad, c, [hx, hy]);
    if (list === W.frames) rect(trench, [c[0], c[1] - hy - 2], [hx, TRENCH_HALF]);
  }
  for (const d of W.decks) rect(pad, A(d.at), [d.size[0] + 3, d.size[1] + 3]);
  // (what stands round: a column's, a tank's pad bunded by its kerb, a sphere's square bund)
  for (const q of W.vessels) circle(pad, A(q.at), q.radius + 6, 1);
  for (const q of W.tanks) circle(pad, A(q.at), q.radius + 5, 1);
  for (const q of W.spheres) rect(pad, A(q.at), [q.radius + 8, q.radius + 8], 1);
  // (what burns stands on plate)
  for (const q of W.furnaces) rect(apron, A(q.at), [q.radius + 14, q.radius + 14]);
  for (const q of W.ladles) circle(apron, A(q.at), q.radius + 8);
  // (a footing under each column of the hall's lines, as works.js stands them)
  if (W.hall && W.columns.rows.length) {
    const hx = W.hall.half[0], n = Math.floor((2 * hx) / W.trusses.spacing);
    for (let i = 0; i < n - 1; i++) for (const ry of W.columns.rows) rect(pad, [cx - hx + (i + 1) * ((2 * hx) / n), cy + ry], [4, 4]);
  }
  // (a rack's footing under each post, a bent every 12 m as works.js lays them, a trench along its side)
  for (const q of W.racks) {
    const P = q.path.map(A), hw = (q.width ?? 10) / 2;
    for (let i = 0; i + 1 < P.length; i++) {
      const [a, b] = [P[i], P[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, px = -uy, py = ux;
      if (Math.abs(ux) < 1e-6 || Math.abs(uy) < 1e-6) {
        // (along an axis, a side's footings one strip the shader steps every 12 m from its start: `kerb` 2)
        const along = Math.abs(ux) > 0.5, n = Math.floor(L / 12);
        for (const sg of [-1, 1]) { const m = [a[0] + ux * (n * 6) + px * hw * sg, a[1] + uy * (n * 6) + py * hw * sg]; rect(pad, m, along ? [n * 6 + 1.6, 1.6] : [1.6, n * 6 + 1.6], FOOTINGS); }
        const off = hw + 3, m = [(a[0] + b[0]) / 2 + px * off, (a[1] + b[1]) / 2 + py * off];
        rect(trench, m, along ? [L / 2, TRENCH_HALF] : [TRENCH_HALF, L / 2]);
      } else for (let s = 0; s <= L; s += 12) for (const sg of [-1, 1]) rect(pad, [a[0] + ux * s + px * hw * sg, a[1] + uy * s + py * hw * sg], [1.6, 1.6]);
    }
  }
  // (the lanes the floor designs, and one round the hall `ring` metres in from its walls)
  const lanes = F.lanes.map((L) => ({ path: L.path, width: L.width ?? LANE_W }));
  if (F.ring > 0 && W.hall) { const [hx, hy] = W.hall.half.map((v) => v - F.ring); lanes.push({ path: [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy], [-hx, -hy]], width: LANE_W }); }
  for (const L of lanes) for (let k = 0; k + 1 < L.path.length; k++) {
    const [a, b] = [A(L.path[k]), A(L.path[k + 1])], w = L.width / 2;
    rect(lane, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [Math.abs(b[0] - a[0]) / 2 + w, Math.abs(b[1] - a[1]) / 2 + w]);
  }
  return S.map((s, i) => ({ ...s, i })).sort((p, q) => RANK.indexOf(p.kind) - RANK.indexOf(q.kind) || p.i - q.i).map(({ i, ...s }) => s);
}

const lin = (hex) => [1, 3, 5].map((k) => { const c = parseInt(hex.slice(k, k + 2), 16) / 255; return r3(c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); });

/** The page's plan: the shapes packed (two texels each: centre and half, then kind, radius, seed and kerb), the cells. */
export function worksFloor(W, centre, floorAt = () => 0) {
  const F = readFloor(W.floor);
  if (!F) return null;
  const S = floorShapes(W, F, centre);
  if (S.length > 255) bad(`'s plan has ${S.length} zones: at most 255`);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  if (W.hall) { x0 = centre[0] - W.hall.half[0]; x1 = centre[0] + W.hall.half[0]; y0 = centre[1] - W.hall.half[1]; y1 = centre[1] + W.hall.half[1]; }
  else for (const s of S) { x0 = Math.min(x0, s.at[0] - s.half[0]); x1 = Math.max(x1, s.at[0] + s.half[0]); y0 = Math.min(y0, s.at[1] - s.half[1]); y1 = Math.max(y1, s.at[1] + s.half[1]); }
  const nx = Math.max(1, Math.ceil((x1 - x0) / CELL)), ny = Math.max(1, Math.ceil((y1 - y0) / CELL)), lists = Array.from({ length: nx * ny }, () => []);
  S.forEach((s, i) => {
    const i0 = Math.max(0, Math.floor((s.at[0] - s.half[0] - x0) / CELL)), i1 = Math.min(nx - 1, Math.floor((s.at[0] + s.half[0] - x0) / CELL));
    const j0 = Math.max(0, Math.floor((s.at[1] - s.half[1] - y0) / CELL)), j1 = Math.min(ny - 1, Math.floor((s.at[1] + s.half[1] - y0) / CELL));
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) lists[j * nx + k].push(i + 1);
  });
  const cells = new Uint8Array(nx * ny * CELL_MAX);
  let over = 0;
  lists.forEach((L, c) => { if (L.length > CELL_MAX) over++; L.slice(0, CELL_MAX).forEach((v, k) => { cells[c * CELL_MAX + k] = v; }); });
  const shapes = new Float32Array(S.length * 8);
  S.forEach((s, i) => shapes.set([s.at[0], s.at[1], s.half[0], s.half[1], s.kind, s.r, r3(i * 1.37 + 0.5), s.kerb], i * 8));
  return { o: [r3(x0), r3(y0)], top: r3(floorAt(...centre) + FLOOR_TOP), cell: CELL, n: [nx, ny], count: S.length, over, shapes: b64(new Uint8Array(shapes.buffer)), cells: b64(cells), yard: F.yard === 'gravel' ? 1 : 0, paint: lin(F.paint), kibble: F.kibble };
}
