// assessStoreConcept — the retail relationship spec, advisory only (it grades and stamps,
// never refuses). Findings take the evaluateBuilding shape { id, register, severity, detail }
// with register 'retail'. Everything is measured on RESOLVED footprints in the sales floor's
// local frame (feet; y = 0 on the glass line, x = lateral from the left jamb).

import { CELL_ARCHETYPES } from './store-cells.js';
import * as dmath from '../../util/dmath.js';

export const RETAIL_SPEC = {
  decompression: 5,        // ft inside the door kept free of fixtures
  aisle: 3.5,              // ft clear, continuous, door → service and door → every cell door
  sightEye: 5,             // a fixture taller than this blocks the cash-wrap sightline (decl.tall)
  browseDensity: [0.12, 0.5],
  seatReach: 9,            // ft: a seat within this of the counter serves a bar concept
  grid: 0.25,              // aisle-search cell
};

const overlapArea = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const area = (r) => (r.x1 - r.x0) * (r.y1 - r.y0);

/** Segment p→q against an AABB (slab test). */
function segHitsRect(p, q, r) {
  let t0 = 0, t1 = 1;
  const d = [q[0] - p[0], q[1] - p[1]];
  for (const [lo, hi, o, dd] of [[r.x0, r.x1, p[0], d[0]], [r.y0, r.y1, p[1], d[1]]]) {
    if (Math.abs(dd) < 1e-12) { if (o < lo || o > hi) return false; continue; }
    let a = (lo - o) / dd, b = (hi - o) / dd;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}

/** Grid BFS for a walker of radius `rad` among `obstacles` in [0,W]×[0,D]. */
function reachable(W, D, obstacles, rad, from, targets, g) {
  const nx = Math.ceil(W / g), ny = Math.ceil(D / g);
  const blocked = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
    const x = (i + 0.5) * g, y = (j + 0.5) * g;
    // side and back walls block; the glass side (y = 0) is the street, also a wall to a walker inside
    let b = x < rad || x > W - rad || y < Math.min(rad, 1.2) || y > D - rad * 0.4;
    for (let k = 0; !b && k < obstacles.length; k += 1) { const o = obstacles[k]; b = x > o.x0 - rad && x < o.x1 + rad && y > o.y0 - rad && y < o.y1 + rad; }
    blocked[j * nx + i] = b ? 1 : 0;
  }
  const idx = ([x, y]) => { const i = Math.min(nx - 1, Math.max(0, Math.floor(x / g))), j = Math.min(ny - 1, Math.max(0, Math.floor(y / g))); return j * nx + i; };
  const seen = new Uint8Array(nx * ny);
  const s = idx(from);
  if (blocked[s]) return targets.map(() => false);
  const queue = [s]; seen[s] = 1;
  for (let h = 0; h < queue.length; h += 1) {
    const c = queue[h], i = c % nx, j = (c - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
      const n = b * nx + a;
      if (!seen[n] && !blocked[n]) { seen[n] = 1; queue.push(n); }
    }
  }
  // a target counts as reached if any free cell within one grid step of it was reached
  return targets.map(([x, y]) => {
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (seen[idx([x + dx * g, y + dy * g])]) return true;
    return false;
  });
}

/**
 * store: a buildStandaloneStore result (or the same shape from a mall bay):
 *   { salesFrame: {W, D, toLocal}, entry: {local:[x,0], width}, fitOut: {placements, cast}, sub: {cells} }
 * @returns {{ findings, ok, byRegister, metrics }}
 */
export function assessStoreConcept(card, store, spec = RETAIL_SPEC) {
  const F = [];
  const inv = (id, detail, refs = []) => F.push({ id, register: 'retail', severity: 'invariant', detail, refs });
  const pref = (id, detail) => F.push({ id, register: 'retail', severity: 'preferential', detail });
  const { W, D } = store.salesFrame;
  const [ex] = store.entry.local;
  const ew = store.entry.width;
  const zoneOf = (role) => { const z = (card.zones || []).find((q) => q.role === role); return z ? { y0: z.depth[0] * D, y1: z.depth[1] * D } : null; };
  const floor = (store.fitOut?.placements || []).filter((p) => !p.row.decl.overhead && !p.row.decl.wallHung);
  const cast = (store.fitOut?.cast || []).map((c) => (c.row ? c : { ...c, row: { decl: { tall: false, cast: true, feature: true } } }));
  const obstacles = [...floor, ...cast];
  const name = (p) => `${p.archetype}@(${((p.x0 + p.x1) / 2).toFixed(1)},${((p.y0 + p.y1) / 2).toFixed(1)})`;

  // INVARIANT — entry decompression
  // decompression scales with the unit: the full 5 ft in a real shop, never under 3 ft in a shallow bay
  const decomp = Math.min(spec.decompression, Math.max(3, 0.25 * D));
  const throat = { x0: ex - ew / 2 - 0.5, x1: ex + ew / 2 + 0.5, y0: -1, y1: decomp };
  const inThroat = obstacles.filter((o) => overlapArea(o, throat) > 0.01);
  if (inThroat.length) inv('entry-decompression', `${inThroat.map(name).join(', ')} within ${decomp.toFixed(1)} ft inside the door`, inThroat.map((o) => obstacles.indexOf(o)));

  // INVARIANT — no overlaps, nothing through the glass or the walls
  for (let i = 0; i < obstacles.length; i += 1) for (let j = i + 1; j < obstacles.length; j += 1) {
    if (overlapArea(obstacles[i], obstacles[j]) > 0.05) inv('fixture-overlap', `${name(obstacles[i])} overlaps ${name(obstacles[j])}`, [i, j]);
  }
  for (const [k, o] of obstacles.entries()) {
    if (o.y0 < -0.05) inv('pierces-glass', `${name(o)} crosses the glass line`, [k]);
    else if (o.x0 < -0.05 || o.x1 > W + 0.05 || o.y1 > D + 0.05) inv('fixture-out-of-bounds', `${name(o)} leaves the sales floor`, [k]);
  }

  // INVARIANT — the cash wrap exists and sees the door
  const counter = floor.find((p) => p.archetype === 'counter');
  if (!counter) inv('cashwrap-missing', 'no service counter to see the entry from');
  else {
    const eye = [(counter.x0 + counter.x1) / 2, counter.y1 + 1.2];
    const door = [ex, 0.3];
    const blockers = obstacles.filter((o) => o !== counter && o.row.decl.tall && (o.row.decl.height ?? 0) > spec.sightEye && segHitsRect(eye, door, o));
    if (blockers.length) inv('cashwrap-sightline', `${blockers.map(name).join(', ')} blocks the counter's view of the door`, blockers.map((o) => obstacles.indexOf(o)));
  }

  // INVARIANT — a continuous aisle from the door to service and to every cell door
  const rad = spec.aisle / 2;
  const targets = [], labels = [];
  // service is reached at ANY point along the counter's customer face (stools may hold the middle)
  const serviceGroup = [];
  if (counter) {
    const cy = (counter.y0 + counter.y1) / 2;
    const pts = [[counter.x0 - rad - 0.2, cy], [counter.x1 + rad + 0.2, cy]];   // either end of the counter
    for (let x = counter.x0 + 0.5; x <= counter.x1 - 0.5; x += 1) pts.push([x, counter.y0 - rad - 0.2]);
    for (const p of pts) { serviceGroup.push(targets.length); targets.push(p); }
  }
  // back-of-house cells a row declares reachVia:'staff' are measured from behind the counter
  const staffTargets = [], staffLabels = [];
  for (const c of store.sub?.cells || []) {
    const [lx, ly] = store.salesFrame.toLocal(c.door.world[0], c.door.world[1]);
    if (ly < 1) { inv('cell-door-on-glass', `${c.archetype} is doored onto the storefront`); continue; }
    const t = [Math.min(W - rad - 0.1, Math.max(rad + 0.1, lx)), D - rad * 0.4 - 0.2];
    if (CELL_ARCHETYPES[c.archetype]?.reachVia === 'staff' && counter) { staffTargets.push(t); staffLabels.push(c.archetype); continue; }
    targets.push(t);
    labels.push(c.archetype);
  }
  const hit = reachable(W, D, obstacles, rad, [ex, Math.max(1.4, rad)], targets, spec.grid);
  // a unit that is also a passage (a mall anchor's street entry) keeps an aisle through to its storefront
  for (const tx of store.through || []) {
    const from = [Math.min(W - rad - 0.1, Math.max(rad + 0.1, tx)), D - rad * 0.4 - 0.2];
    if (!reachable(W, D, obstacles, rad, from, [[ex, Math.max(1.4, rad)]], spec.grid)[0]) inv('aisle-through', `no ${spec.aisle} ft aisle from the back entry at ${tx.toFixed(1)} ft to the storefront`);
  }
  if (serviceGroup.length && !serviceGroup.some((i) => hit[i])) inv('aisle-to-service', `no ${spec.aisle} ft aisle from the door to the counter`);
  if (staffTargets.length) {
    const from = [(counter.x0 + counter.x1) / 2, counter.y1 + rad + 0.1];
    const sh = reachable(W, D, obstacles, rad, from, staffTargets, spec.grid);
    sh.forEach((ok, i) => { if (!ok) inv(`staff-to-${staffLabels[i]}`, `no ${spec.aisle} ft staff path from behind the counter to ${staffLabels[i]}`); });
  }
  labels.forEach((label, k) => { const i = serviceGroup.length + k; if (!hit[i]) inv(`aisle-to-${label}`, `no ${spec.aisle} ft aisle from the door to ${label}`); });

  // INVARIANT — exposure gradient: zones in order, cells deepest
  const order = ['window', 'browse', 'service', 'back'];
  const zs = (card.zones || []).slice().sort((a, b) => a.depth[0] - b.depth[0]).map((z) => z.role);
  for (let i = 1; i < zs.length; i += 1) if (order.indexOf(zs[i]) < order.indexOf(zs[i - 1])) inv('exposure-gradient', `${zs[i - 1]} sits in front of ${zs[i]}`);

  // GRADIENT — power wall on the right, a feature in the window, browse density, seats near the bar
  const merch = floor.filter((p) => p.row.decl.merch);
  const rightA = merch.reduce((a, p) => a + Math.max(0, Math.min(p.x1, W) - Math.max(p.x0, W / 2)) * (p.y1 - p.y0), 0);
  const leftA = merch.reduce((a, p) => a + Math.max(0, Math.min(p.x1, W / 2) - Math.max(p.x0, 0)) * (p.y1 - p.y0), 0);
  const powerWall = merch.some((p) => p.wall === 'right') || rightA > leftA * 1.05;
  if (merch.length && !powerWall) pref('power-wall-right', `merch leans left (${leftA.toFixed(0)} vs ${rightA.toFixed(0)} sq ft): stock the right-hand wall first`);
  const win = zoneOf('window');
  if (win && !obstacles.some((o) => (o.row.decl.feature || o.row.decl.cast) && (o.y0 + o.y1) / 2 < win.y1)) pref('window-feature', 'the window zone has no podium or mannequin');
  const browse = zoneOf('browse');
  let density = null;
  if (browse) {
    const b = { x0: 0, x1: W, y0: browse.y0, y1: browse.y1 };
    density = floor.reduce((a, p) => a + overlapArea(p, b), 0) / area(b);   // all floor fixtures: seating is a cafe's browse
    if (density < spec.browseDensity[0]) pref('browse-density', `browse floor ${Math.round(density * 100)}% merchandised — reads empty`);
    else if (density > spec.browseDensity[1]) pref('browse-density', `browse floor ${Math.round(density * 100)}% merchandised — reads crammed`);
  }
  const seats = floor.filter((p) => p.row.decl.seat);
  if (counter && seats.length) {
    const cx = (counter.x0 + counter.x1) / 2, cy = (counter.y0 + counter.y1) / 2;
    if (!seats.some((s) => dmath.hypot((s.x0 + s.x1) / 2 - cx, (s.y0 + s.y1) / 2 - cy) <= spec.seatReach)) pref('seats-near-counter', `no seat within ${spec.seatReach} ft of the counter`);
  }

  const byRegister = { retail: { invariant: F.filter((f) => f.severity === 'invariant').length, preferential: F.filter((f) => f.severity === 'preferential').length } };
  const result = {};
  const debug = { W, D, obstacles: obstacles.map((o) => ({ a: o.archetype, x0: o.x0, x1: o.x1, y0: o.y0, y1: o.y1 })), rad, door: [ex, Math.max(1.4, rad)], targets, hit, throat };
  Object.defineProperty(result, 'obstacles', { value: obstacles, enumerable: false });
  return Object.assign(result, { findings: F, ok: byRegister.retail.invariant === 0, byRegister, debug, metrics: { W: +W.toFixed(2), D: +D.toFixed(2), browseDensity: density == null ? null : +density.toFixed(3), obstacles: obstacles.length } });
}
