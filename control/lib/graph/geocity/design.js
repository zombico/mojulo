/**
 * THE GEOCITY, DESIGNED — a metro's map at its widest grain, laid before anything inside it, layer by layer, pure. Its
 * major streets come first and carve it; each layer reads only the layers before it and rolls only its own dice
 * (city/plan/dice.js `streamOf`, a stream per layer and key).
 *
 *   1 land        the water along the sides its card names, the land inside it; the natural ground N (the fall toward
 *                 its side, the hills over it) and the streets' ground S (N smoothed, so a street keeps the land's
 *                 grade and not its every hummock)
 *   2 arterials   the SPINE through the core's seat each way, then arterials stepped outward from it to the land's
 *                 edge, each step rolled inside the rail at its distance (tight at the core, looser past `reach`); each
 *                 in its grammar's major section, its profile along S (its ends' heights, its steepest grade)
 *   3 regions     the NEIGHBOURHOODS the arterials enclose, each its rect inside their rights-of-way, its RING by its
 *                 middle's distance from the seat (the four round the seat always the core), its sides (an arterial,
 *                 the water, or the BEYOND past the map's land edge, where a geotown joins later) and its PORTS
 *   4 green       the city park(s) reserved whole (a frame neighbourhood clear of the map's edge, by dice); the rest of
 *                 the city's green share given out to the other neighbourhoods as quotas, by area times their ring's
 *                 weight
 *   5 graph       the REGION GRAPH: each neighbourhood a node, each pair across an arterial an edge with its PORTAL
 *                 (the middle of their shared run) and its height: what a Quest Open World streams as it is passed
 *   6 heights     the HEIGHT FIELD (heights.js): each ring's median by distance inside its rail, the secondary NODES on
 *                 the spines past the core (the neighbourhoods round one built a ring inward), the arterials' FRONTAGE
 *                 rising to its corridor's storeys; each neighbourhood the ring it `builds` as, its interior's storeys and
 *                 each arterial frontage's
 *   7 parks       each neighbourhood's own PARK out of its quota (parks.js): along its shore on the water, else inside its
 *                 interior clear of its frontages, laid before its streets so they go round it
 *   8 ledger      water, the arterials' rights-of-way (each crossing once), parks and neighbourhoods: the frame's every
 *                 square metre once; the green budget, reserved, given out as quotas and placed as parks
 *
 *   designGeocity(spec, { seed, field? }) → { spec, seed, metro, grammar, frame, land, seat, section, lines, crossings,
 *     regions, graph, heights: { reach, nodes, storeysAt }, ledger, laws }
 *     (`field`: (x, y) → metres, the natural ground in place of fall and hills)
 *   geocityLand(read, land, seed, field?) → { N, S, range }
 *
 * Metres, x east, y north, z up, the map's south-west corner the origin. Every rect is [x0, y0, x1, y1].
 */
import { readGeocity } from './metro.js';
import { geocityLaws } from './laws.js';
import { heightsOf } from './heights.js';
import { parksOf } from './parks.js';
import { streamOf } from '../city/plan/dice.js';
import { terrainField } from '../terrain/terrain-field.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const lerp = (a, b, t) => a + (b - a) * t;
const area = (r) => (r[2] - r[0]) * (r[3] - r[1]);
/** A neighbourhood's column name on the board: A… west to east, then AA… */
export const columnName = (i) => (i < 26 ? String.fromCharCode(65 + i) : columnName(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

// ── 1 the land ──────────────────────────────────────────────────────────────────────────────────────────────
// the streets' ground: N on a grid this fine (m), blurred this far, so an arterial keeps the land's grade
const S_CELL = 20, S_BLUR = 120;
// a profile is read along its arterial every this many metres
const PROFILE_STEP = 20;
// the least a neighbourhood at the land's edge runs past its last arterial, a share of the rail's least there
const FRINGE = 0.8;
const MEMO = new Map();
function hillsField(H, seed) {
  const key = JSON.stringify([H.from, H.span, seed]);
  let f = MEMO.get(key);
  if (!f) { f = terrainField({ from: H.from, span: H.span, detail: false, seed: H.from.seed ?? seed }); MEMO.set(key, f); if (MEMO.size > 6) MEMO.delete(MEMO.keys().next().value); }
  return f;
}

/** The natural ground N (its FALL toward its side plus its hills, the shore side at 0) and the streets' ground S over
 *  the land, (x, y) → metres. */
export function geocityLand(T, land, seed = 1, field = null) {
  const [x0, y0, x1, y1] = land, W = x1 - x0, D = y1 - y0, { drop, toward } = T.metro.fall;
  let N;
  if (field) N = field;
  else {
    // the fall: 0 at the side it falls toward, `drop` at the side across from it
    const fall = { s: (x, y) => drop * (y - y0) / D, n: (x, y) => drop * (y1 - y) / D, w: (x, y) => drop * (x - x0) / W, e: (x, y) => drop * (x1 - x) / W }[toward];
    let hills = () => 0;
    if (T.hills) {
      const f = hillsField(T.hills, seed), b = f.bounds, cx = (b.x[0] + b.x[1]) / 2, cy = (b.y[0] + b.y[1]) / 2;
      const raw = (x, y) => f.heightAt(cx + x - (x0 + x1) / 2, cy + y - (y0 + y1) / 2);
      let lo = Infinity, hi = -Infinity;
      for (let y = y0; y <= y1; y += S_CELL * 4) for (let x = x0; x <= x1; x += S_CELL * 4) { const z = raw(x, y); if (z < lo) lo = z; if (z > hi) hi = z; }
      const k = hi > lo ? T.hills.height / (hi - lo) : 0;
      hills = (x, y) => (raw(x, y) - lo) * k;
    }
    N = (x, y) => fall(x, y) + hills(x, y);
  }
  // S: N on the grid, box-blurred twice each way (near a gaussian of S_BLUR), clamped at the edges, read bilinearly
  const nx = Math.ceil(W / S_CELL) + 1, ny = Math.ceil(D / S_CELL) + 1;
  let g = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g[j * nx + i] = N(Math.min(x1, x0 + i * S_CELL), Math.min(y1, y0 + j * S_CELL));
  const rad = Math.max(1, Math.round(S_BLUR / S_CELL / 2));
  const blur = (src, along) => {
    const out = new Float64Array(src.length), n = along ? nx : ny, m = along ? ny : nx;
    for (let b = 0; b < m; b++) for (let a = 0; a < n; a++) {
      let s = 0;
      for (let t = -rad; t <= rad; t++) { const c = Math.max(0, Math.min(n - 1, a + t)); s += src[along ? b * nx + c : c * nx + b]; }
      out[along ? b * nx + a : a * nx + b] = s / (2 * rad + 1);
    }
    return out;
  };
  for (let p = 0; p < 2; p++) g = blur(blur(g, true), false);
  const S = (x, y) => {
    const fx = Math.max(0, Math.min(nx - 1 - 1e-9, (x - x0) / S_CELL)), fy = Math.max(0, Math.min(ny - 1 - 1e-9, (y - y0) / S_CELL));
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, at = (a, b) => g[b * nx + a];
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
  };
  let lo = Infinity, hi = -Infinity;
  for (const z of g) { if (z < lo) lo = z; if (z > hi) hi = z; }
  return { N, S, range: [r3(lo), r3(hi)] };
}

// ── 2 the arterials ─────────────────────────────────────────────────────────────────────────────────────────
/** The arterials along one axis: the spine at the seat, then stepped outward each way to the land's edge, each step
 *  rolled inside the rail at its distance from the seat on its own dice (`${axis}:${dir}:${i}`); a step that would leave
 *  a fringe under FRINGE of its rail's least is not taken (the last neighbourhood runs on to the land's edge). → [{ at, spine? }] sorted. */
function linesOf(a, b, s, A, seed, axis) {
  const out = [{ at: r3(s), spine: true }];
  for (const dir of [-1, 1]) {
    let p = s;
    for (let i = 0; ; i++) {
      const t = A.reach > 0 ? Math.min(1, Math.abs(p - s) / A.reach) : 1, lo = lerp(A.core[0], A.outer[0], t), hi = lerp(A.core[1], A.outer[1], t);
      const q = p + dir * (lo + (hi - lo) * streamOf(seed, 'arterials', `${axis}:${dir}:${i}`)());
      if ((dir < 0 ? q - a : b - q) < FRINGE * lo) break;
      out.push({ at: r3(q) }); p = q;
    }
  }
  return out.sort((p, q) => p.at - q.at);
}

/** An arterial's profile along the streets' ground, over the land: its ends' heights and its steepest grade. */
function profileOf(S, axis, at, lo, hi) {
  const zs = [];
  for (let t = lo; t < hi; t += PROFILE_STEP) zs.push(axis === 'ns' ? S(at, t) : S(t, at));
  zs.push(axis === 'ns' ? S(at, hi) : S(hi, at));
  let grade = 0;
  for (let k = 1; k < zs.length; k++) grade = Math.max(grade, Math.abs(zs[k] - zs[k - 1]) / PROFILE_STEP);
  return { ends: [r3(zs[0]), r3(zs[zs.length - 1])], grade: r3(grade) };
}

// ── the design ──────────────────────────────────────────────────────────────────────────────────────────────
export function designGeocity(spec = {}, { seed = 1, field = null } = {}) {
  const T = readGeocity(spec), M = T.metro, G = T.grammar, [W, D] = M.extent;

  // 1 the land inside its water; the water's bands (south and north the whole width, west and east between them)
  const wd = (s) => (M.water.sides.includes(s) ? M.water.depth : 0);
  const land = [wd('w'), wd('s'), W - wd('e'), D - wd('n')];
  const water = [
    ...(wd('s') ? [{ side: 's', rect: [0, 0, W, land[1]] }] : []),
    ...(wd('n') ? [{ side: 'n', rect: [0, land[3], W, D] }] : []),
    ...(wd('w') ? [{ side: 'w', rect: [0, land[1], land[0], land[3]] }] : []),
    ...(wd('e') ? [{ side: 'e', rect: [land[2], land[1], W, land[3]] }] : []),
  ];
  const L = geocityLand(T, land, seed, field);

  // 2 the arterials, in the grammar's major section (its carriageway, a walk each side)
  const sec = G.street.major, half = r3(sec.road / 2 + sec.walk), section = { road: sec.road, walk: sec.walk, half, row: r3(2 * half) };
  const clampSeat = (lo, hi, u) => Math.max(lo + half + M.arterials.core[0] * 0.5, Math.min(hi - half - M.arterials.core[0] * 0.5, lo + u * (hi - lo)));
  const seat = [r3(clampSeat(land[0], land[2], M.core[0])), r3(clampSeat(land[1], land[3], M.core[1]))];
  const xs = linesOf(land[0], land[2], seat[0], M.arterials, seed, 'ns'), ys = linesOf(land[1], land[3], seat[1], M.arterials, seed, 'ew');
  const lines = [
    ...xs.map((l, k) => ({ id: `ns-${k}`, axis: 'ns', at: l.at, rank: l.spine ? 'spine' : 'arterial', rect: [r3(l.at - half), land[1], r3(l.at + half), land[3]], ...profileOf(L.S, 'ns', l.at, land[1], land[3]) })),
    ...ys.map((l, j) => ({ id: `ew-${j}`, axis: 'ew', at: l.at, rank: l.spine ? 'spine' : 'arterial', rect: [land[0], r3(l.at - half), land[2], r3(l.at + half)], ...profileOf(L.S, 'ew', l.at, land[0], land[2]) })),
  ];
  const NS = lines.filter((l) => l.axis === 'ns'), EW = lines.filter((l) => l.axis === 'ew');
  const crossings = NS.flatMap((a) => EW.map((b) => ({ id: `${a.id}×${b.id}`, at: [a.at, b.at], z: r3(L.S(a.at, b.at)), ranks: [a.rank, b.rank], seat: a.rank === 'spine' && b.rank === 'spine' })));

  // 3 the regions: the cells between the arterials (or the land's edge), inside their rights-of-way
  const bx = [land[0], ...NS.map((l) => l.at), land[2]], by = [land[1], ...EW.map((l) => l.at), land[3]];
  const sideOf = (lineAt, edge) => (lineAt ? { kind: 'arterial', street: lineAt.id, rank: lineAt.rank } : { kind: M.water.sides.includes(edge) ? 'water' : 'beyond' });
  const regions = [];
  for (let j = 0; j + 1 < by.length; j++) for (let i = 0; i + 1 < bx.length; i++) {
    const w = NS[i - 1], e = NS[i], s = EW[j - 1], n = EW[j];
    const rect = [r3(bx[i] + (w ? half : 0)), r3(by[j] + (s ? half : 0)), r3(bx[i + 1] - (e ? half : 0)), r3(by[j + 1] - (n ? half : 0))];
    const mid = [(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2], dist = r3(Math.hypot(mid[0] - seat[0], mid[1] - seat[1]));
    const sides = { n: sideOf(n, 'n'), e: sideOf(e, 'e'), s: sideOf(s, 's'), w: sideOf(w, 'w') };
    // the four round the seat are the core whatever their size; the rest by their middles' distance
    const atSeat = [w, e].some((l) => l?.rank === 'spine') && [s, n].some((l) => l?.rank === 'spine');
    const ring = atSeat || dist <= M.rings.core ? 'core' : dist <= M.rings.frame ? 'frame' : 'outskirts';
    // a port: an arterial side, its run along the region, the streets' ground at the run's two ends
    const ports = Object.entries(sides).filter(([, v]) => v.kind === 'arterial').map(([side, v]) => {
      const run = side === 'n' || side === 's' ? [[rect[0], side === 's' ? by[j] : by[j + 1]], [rect[2], side === 's' ? by[j] : by[j + 1]]] : [[side === 'w' ? bx[i] : bx[i + 1], rect[1]], [side === 'w' ? bx[i] : bx[i + 1], rect[3]]];
      return { side, street: v.street, rank: v.rank, run: run.map((p) => p.map(r3)), ends: run.map(([x, y]) => r3(L.S(x, y))) };
    });
    regions.push({ id: `${columnName(i)}${j + 1}`, i, j, rect, area: r3(area(rect)), mid: mid.map(r3), dist, ring, sides, ports,
      beyond: Object.entries(sides).filter(([, v]) => v.kind === 'beyond').map(([k]) => k), waterfront: Object.values(sides).some((v) => v.kind === 'water'),
      height: r3(L.S(mid[0], mid[1])), park: false, green: 0 });
  }

  // 4 the green: the city park(s) reserved whole, a frame neighbourhood clear of the map's edge first (else an
  // outskirts one), by dice; the rest of the share given out as quotas by area times the ring's weight
  const landArea = area(land), budget = r3(M.green.share * landArea);
  const interior = (r) => !r.waterfront && !r.beyond.length;
  for (const ring of ['frame', 'outskirts']) {
    const pool = regions.filter((r) => r.ring === ring && interior(r) && !r.park);
    const R = streamOf(seed, 'green', `parks:${ring}`);
    while (pool.length && regions.filter((r) => r.park).length < M.green.parks) pool.splice(Math.floor(R() * pool.length), 1)[0].park = true;
  }
  const reserved = regions.filter((r) => r.park).reduce((s, r) => s + r.area, 0);
  const rest = regions.filter((r) => !r.park), weigh = (r) => r.area * M.green.weights[r.ring], total = rest.reduce((s, r) => s + weigh(r), 0);
  for (const r of regions) r.green = r.park ? r.area : total > 0 ? r3(Math.max(0, budget - reserved) * weigh(r) / total) : 0;

  // 5 the region graph: an edge across every arterial run two neighbourhoods share, its portal the run's middle
  const at = new Map(regions.map((r) => [`${r.i}:${r.j}`, r]));
  const edges = [];
  for (const r of regions) {
    const e = at.get(`${r.i + 1}:${r.j}`), n = at.get(`${r.i}:${r.j + 1}`);
    if (e) { const x = NS[r.i].at, y = r3((r.rect[1] + r.rect[3]) / 2); edges.push({ id: `${r.id}~${e.id}`, a: r.id, b: e.id, street: NS[r.i].id, rank: NS[r.i].rank, portal: [x, y], z: r3(L.S(x, y)) }); }
    if (n) { const y = EW[r.j].at, x = r3((r.rect[0] + r.rect[2]) / 2); edges.push({ id: `${r.id}~${n.id}`, a: r.id, b: n.id, street: EW[r.j].id, rank: EW[r.j].rank, portal: [x, y], z: r3(L.S(x, y)) }); }
  }
  const graph = { nodes: regions.map((r) => r.id), edges, beyond: regions.filter((r) => r.beyond.length).map((r) => r.id) };

  // 6 the heights, 7 the parks: each neighbourhood the ring it builds as, its storeys, its frontages' and its own park
  const dd = { seed, metro: M, seat, section, lines, regions };
  const Hs = heightsOf(dd);
  for (const r of regions) Object.assign(r, Hs.regions[r.id]);
  const parks = parksOf(dd);
  for (const r of regions) if (parks[r.id]) r.parkRect = parks[r.id];

  // 8 the ledger: every square metre of the frame once (a crossing counted on one arterial)
  const waterArea = water.reduce((s, w) => s + area(w.rect), 0);
  const rowArea = NS.length * section.row * (land[3] - land[1]) + EW.length * section.row * (land[2] - land[0]) - NS.length * EW.length * section.row ** 2;
  const byRing = Object.fromEntries(['core', 'frame', 'outskirts'].map((k) => [k, r3(regions.filter((r) => r.ring === k && !r.park).reduce((s, r) => s + r.area, 0))]));
  const ledger = { total: W * D, land: r3(landArea), water: r3(waterArea), arterials: r3(rowArea), parks: r3(reserved), neighbourhoods: r3(regions.filter((r) => !r.park).reduce((s, r) => s + r.area, 0)), rings: byRing,
    green: { budget, reserved: r3(reserved), quotas: r3(rest.reduce((s, r) => s + r.green, 0)), placed: r3(Object.values(parks).reduce((s, p) => s + p.area, 0)) } };

  const d = { spec: T, seed, metro: M, grammar: G, frame: { W, D }, land: { rect: land, ...L }, water, seat, section, lines, crossings, regions, graph,
    heights: { reach: Hs.reach, nodes: Hs.nodes, storeysAt: Hs.storeysAt }, ledger };
  d.laws = geocityLaws(d);
  return d;
}
