/**
 * THE AIRPORT'S PLAN, in true metres: the transport hub's grammar (architecture/transportation-hub.js: a terminal, its
 * concourses hooking at their tips, stands both flanks filled by a weighted fleet where each one fits) laid at an
 * airport's real figures, so one recipe is drawn whole as a miniature (miniature.js) and in part, a wing, at full scale.
 *
 *   the frame   x along the terminal's frontage, +y landside (its forecourt), −y airside (the apron, the taxiway, the
 *               runway), metres, the ground z = 0
 *   terminal    linear: a processor along x and its piers reaching airside; radial: a rotunda and its arms fanning out
 *   concourses  piers 20 m wide and 12 m tall, each hooking at its tip as the old grammar's do (a hook, a cross, a run
 *               on with a side finger), in one rotational sense (`chirality`); each top-level concourse is a wing ('A',
 *               'B', …) and its branches are the wing's
 *   stands      both flanks of every concourse, nose-in: an aircraft's nose its stop line off the pier's face, its
 *               wingtips a clearance from its neighbours'; the fleet's classes (the craft shelf's liners) sampled by
 *               weight, then the largest that fits, each stand tested against every building and every other stand
 *   bridges     each stand's jet bridge: from a rotunda off the pier's face to the aircraft's first door on its left
 *               (craftService's), at that door's sill; none where the sill is under a bridge cab's lowest (a turboprop
 *               or a bizjet boards by its own airstairs)
 *   the field   the apron behind the stands, its taxilane, the parallel taxiway and the runway at their separations,
 *               the connectors between them; the tower landside; the maintenance hangar at the apron's end
 *
 *   AIRPORT_GLYPHS, AIRPORT_FLEET, AIRPORT_FIGURES
 *   planAirport({ seed?, glyph?, chirality?, asymmetry?, stands?, fleet?, runway? }) → the plan (pure data, metres):
 *     { glyph, chirality, terminal, concourses, stands, field: { apron, taxilane, taxiway, runway, connectors },
 *       tower, hangar, forecourt, wings, bounds, stats }
 *
 * Pure and deterministic (mulberry32 from the seed).
 */
import { mulberry32 } from '../vegetation/grow.js';
import { craftFootprint, CRAFT_ARCHETYPES } from '../craft-shelf/index.js';
import { craftService } from '../vehicle-registry/turnaround.js';

export const AIRPORT_GLYPHS = Object.freeze(['linear', 'radial']);
/** The fleet a stand is sampled from: the craft shelf's liners, by how often each is seen at a stand. */
export const AIRPORT_FLEET = Object.freeze([
  { craft: 'narrowbody', weight: 5 }, { craft: 'regional', weight: 3 }, { craft: 'widebody', weight: 2 }, { craft: 'jumbo', weight: 1 }, { craft: 'bizjet', weight: 1 },
]);
/** The figures an airport is laid at (metres). */
export const AIRPORT_FIGURES = Object.freeze({
  pierW: 20, pierH: 12, noseGap: 7.5, wingGap: 7.5, tailGap: 6, laneW: 30,
  taxiwayW: 23, runwayW: 45, laneToTaxiway: 75, taxiwayToRunway: 182, runwayL: 2800,
  processor: { w: 70, h: 22 }, rotunda: { R: 70, h: 20 }, tower: { h: 72 }, hangar: { w: 95, d: 85, h: 30 },
});
const W = AIRPORT_FIGURES;
// (the lowest sill a jet bridge's cab meets)
const BRIDGE_SILL = 2.6;
const r2 = (v) => Math.round(v * 100) / 100 + 0;
const P2 = (p) => p.map(r2);

// an oriented box { c, ux, nx, halfU, halfN } and the separating-axis test between two
function obb(c, u, halfU, halfN) { return { c, ux: u, nx: [-u[1], u[0]], halfU, halfN }; }
const proj = (o, ax) => Math.abs(o.ux[0] * ax[0] + o.ux[1] * ax[1]) * o.halfU + Math.abs(o.nx[0] * ax[0] + o.nx[1] * ax[1]) * o.halfN;
function overlap(a, b) {
  const d = [b.c[0] - a.c[0], b.c[1] - a.c[1]];
  for (const ax of [a.ux, a.nx, b.ux, b.nx]) if (Math.abs(d[0] * ax[0] + d[1] * ax[1]) >= proj(a, ax) + proj(b, ax)) return false;
  return true;
}
const corners = (o) => [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [o.c[0] + o.ux[0] * a * o.halfU + o.nx[0] * b * o.halfN, o.c[1] + o.ux[1] * a * o.halfU + o.nx[1] * b * o.halfN]);

// each liner's figures: its footprint's span and length, its first door on the left (craft frame: +x its right, +y its nose)
const FLEET_FIGS = new Map();
function figsOf(craft) {
  if (!FLEET_FIGS.has(craft)) {
    const F = craftFootprint(craft), S = craftService(craft), d = S.doors[0];
    FLEET_FIGS.set(craft, { craft, span: F.max[0] - F.min[0], length: F.max[1] - F.min[1], height: F.max[2], door: d ? { x: -d.x.L, y: d.y, sill: d.sill, h: d.h } : null });
  }
  return FLEET_FIGS.get(craft);
}

/** The airport laid out. */
export function planAirport({ seed = 1, glyph, chirality, asymmetry = 0.5, stands = 30, fleet = AIRPORT_FLEET, runway = {} } = {}) {
  if (glyph !== undefined && !AIRPORT_GLYPHS.includes(glyph)) throw new Error(`airport: glyph is ${AIRPORT_GLYPHS.join(' | ')}`);
  if (!Number.isInteger(stands) || stands < 1 || stands > 40) throw new Error('airport: stands is 1 to 40 (how many aircraft stand at its gates)');
  for (const f of fleet) if (!CRAFT_ARCHETYPES[f.craft] || CRAFT_ARCHETYPES[f.craft].role !== 'liner' && CRAFT_ARCHETYPES[f.craft].role !== 'courier') throw new Error(`airport: '${f.craft}' is no liner on the craft shelf`);
  const rng = mulberry32((seed * 2654435761 + 7) >>> 0);
  const g = glyph ?? (rng() < 0.5 ? 'linear' : 'radial');
  const chi = chirality === 1 || chirality === -1 ? chirality : rng() < 0.5 ? 1 : -1;
  const figs = fleet.map((f) => ({ ...figsOf(f.craft), weight: f.weight }));
  const step = figsOf('narrowbody').span + W.wingGap;
  // the apron's floor: no pier or stand past it (its taxilane, the taxiway and the runway beyond); the stands' depth
  const reach = Math.max(...figs.map((f) => f.length)) + W.noseGap + W.tailGap;
  const yFloor = 0;
  const ctx = { rng, chi, asym: Math.max(0, Math.min(1, asymmetry)), concourses: [], slots: [], walls: [], placed: [], wing: 0 };

  // ── the terminal ──
  let terminal;
  if (g === 'linear') {
    const nP = 3 + Math.floor(rng() * 2), pierL = 240 + rng() * 80, ys = yFloor + pierL + reach * 0.15 + W.processor.w / 2, len = nP * (2 * reach + 60) + 120;
    terminal = { kind: 'processor', a: P2([-len / 2, ys]), b: P2([len / 2, ys]), w: W.processor.w, h: W.processor.h };
    ctx.walls.push(obb([0, ys], [1, 0], len / 2, W.processor.w / 2));
    const primary = Math.floor(rng() * nP);
    for (let i = 0; i < nP; i++) {
      const x = -len / 2 + 60 + (i + 0.5) * ((len - 120) / nP) + (rng() - 0.5) * ctx.asym * 30;
      const L = (ys - W.processor.w / 2 - yFloor) * (i === primary ? 1 : 0.75 + rng() * 0.2);
      concourse(ctx, [x, ys - W.processor.w / 2], -Math.PI / 2, L, 1, String.fromCharCode(65 + ctx.wing++), { floor: yFloor + 4 });
    }
  } else {
    const R = W.rotunda.R, c = [0, yFloor + 330], N = 3 + Math.floor(rng() * 2), primary = Math.floor(rng() * N);
    terminal = { kind: 'rotunda', c: P2(c), R, N, h: W.rotunda.h };
    ctx.walls.push(obb(c, [1, 0], R, R));
    for (let i = 0; i < N; i++) {
      // (arms fanned across the airside half, perturbed, one primary running long)
      const ang = -Math.PI / 2 + ((i + 0.5) / N - 0.5) * Math.PI * 1.25 + (rng() - 0.5) * ctx.asym * 0.3;
      const A = [c[0] + Math.cos(ang) * R, c[1] + Math.sin(ang) * R];
      const L = (i === primary ? 300 : 200 + rng() * 60) * (1 + (rng() - 0.5) * ctx.asym * 0.3);
      concourse(ctx, A, ang, L, 1, String.fromCharCode(65 + ctx.wing++), { floor: yFloor + 4 });
    }
  }
  // (no stand past the apron's floor: one wall over the taxilane, the taxiway and the runway)
  ctx.walls.push(obb([0, yFloor - 2000], [1, 0], 4000, 2000));

  // ── the stands: the weighted class where it fits, then the largest that fits, outermost first ──
  const placed = [], used = new Set(), mix = {};
  let budget = stands;
  const sample = () => { const tot = figs.reduce((t, f) => t + f.weight, 0); let r = rng() * tot; for (const f of figs) { r -= f.weight; if (r <= 0) return f; } return figs[figs.length - 1]; };
  const order = ctx.slots.map((s, i) => ({ ...s, i, key: -s.e[1] + rng() * 30 })).sort((a, b) => b.key - a.key);
  const tryPlace = (s, f) => {
    const off = W.pierW / 2 + W.noseGap + f.length / 2, C = [s.e[0] + s.nOut[0] * off, s.e[1] + s.nOut[1] * off];
    const box = obb(C, s.u, f.span / 2 + W.wingGap / 2, f.length / 2 + W.tailGap / 2);
    if (ctx.walls.some((w) => overlap(box, w)) || ctx.placed.some((o) => overlap(box, o))) return false;
    ctx.placed.push(box);
    placed.push(stand(s, f, C, box, placed.length));
    budget--; mix[f.craft] = (mix[f.craft] ?? 0) + 1;
    return true;
  };
  for (const s of order) { if (budget <= 0) break; if (tryPlace(s, sample())) used.add(s.i); }
  const bySize = [...figs].sort((a, b) => b.span - a.span);
  for (const s of order) { if (budget <= 0) break; if (used.has(s.i)) continue; for (const f of bySize) if (tryPlace(s, f)) { used.add(s.i); break; } }

  // ── the field: the apron over the stands, its taxilane, the parallel taxiway and the runway, their connectors ──
  const pts = [...placed.flatMap((p) => corners(p.box)), ...ctx.concourses.flatMap((c) => [c.a, c.b])];
  const xs = pts.map((p) => p[0]), ysA = pts.map((p) => p[1]);
  const ax0 = Math.min(...xs) - 40, ax1 = Math.max(...xs) + 40 + W.hangar.w + 60, ay0 = Math.min(yFloor, Math.min(...ysA)) - W.laneW - 10, ay1 = Math.max(...ysA);
  const yLane = ay0 + 10 + W.laneW / 2, yTw = yLane - W.laneToTaxiway, yRw = yTw - W.taxiwayToRunway;
  const RL = runway.length ?? W.runwayL, xc = (ax0 + ax1) / 2;
  const field = {
    apron: { x0: r2(ax0), x1: r2(ax1), y0: r2(ay0), y1: r2(ay1) },
    taxilane: { a: P2([ax0 + 10, yLane]), b: P2([ax1 - 10, yLane]), width: W.laneW },
    taxiway: { a: P2([xc - RL / 2, yTw]), b: P2([xc + RL / 2, yTw]), width: W.taxiwayW },
    runway: { a: P2([xc - RL / 2, yRw]), b: P2([xc + RL / 2, yRw]), width: W.runwayW },
    connectors: [
      ...[-0.5, -0.2, 0.15, 0.5].map((t) => ({ a: P2([xc + t * RL, yTw]), b: P2([xc + t * RL, yRw]), width: W.taxiwayW })),
      ...[0.25, 0.75].map((t) => ({ a: P2([ax0 + (ax1 - ax0) * t, yLane]), b: P2([ax0 + (ax1 - ax0) * t, yTw]), width: W.taxiwayW })),
    ],
  };
  // the tower landside of the terminal's end; the hangar at the apron's far end, its doors to the apron
  const tEnd = terminal.kind === 'processor' ? terminal.b : [terminal.c[0] + terminal.R, terminal.c[1]];
  const tower = { at: P2([tEnd[0] + 70, tEnd[1] + 40]), h: W.tower.h };
  const hangar = { at: P2([ax1 - 30 - W.hangar.w / 2, ay0 + W.laneW + 20 + W.hangar.d / 2]), w: W.hangar.w, d: W.hangar.d, h: W.hangar.h, heading: r2(-Math.PI / 2) };
  // the forecourt: the road along the terminal's landside face
  const fy = terminal.kind === 'processor' ? terminal.a[1] + terminal.w / 2 + 30 : terminal.c[1] + terminal.R + 30;
  const forecourt = { a: P2([ax0, fy]), b: P2([ax1, fy]), width: 24 };
  const wings = {};
  for (const c of ctx.concourses) (wings[c.wing] ??= { concourses: [], stands: [] }).concourses.push(c.id);
  for (const s of placed) wings[s.wing]?.stands.push(s.id);
  const all = [...pts, field.runway.a, field.runway.b, [tower.at[0] + 20, tower.at[1] + 20], [forecourt.b[0], fy + 40]];
  const bounds = { x0: r2(Math.min(...all.map((p) => p[0])) - 120), x1: r2(Math.max(...all.map((p) => p[0])) + 120), y0: r2(yRw - 200), y1: r2(Math.max(...all.map((p) => p[1])) + 120) };
  return {
    glyph: g, chirality: chi, terminal, concourses: ctx.concourses, stands: placed.map(({ box, ...s }) => s), field, tower, hangar, forecourt, wings, bounds,
    stats: { glyph: g, wings: Object.keys(wings).length, concourses: ctx.concourses.length, slots: ctx.slots.length, stands: placed.length, mix },
  };
}

// one concourse from A along `angle` for `length`, its slots both flanks, then its manji hook at the tip
function concourse(ctx, A, angle, length, depth, wing, { floor }) {
  const sy = Math.sin(angle);
  if (sy < -1e-6) { if (A[1] <= floor) return; length = Math.min(length, (A[1] - floor) / -sy); }
  if (length < W.pierW * 2) return;
  const u = [Math.cos(angle), Math.sin(angle)], B = [A[0] + u[0] * length, A[1] + u[1] * length];
  const id = `${wing}${ctx.concourses.filter((c) => c.wing === wing).length + 1}`;
  ctx.concourses.push({ id, wing, a: P2(A), b: P2(B), w: W.pierW, h: W.pierH });
  ctx.walls.push(obb([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], u, length / 2, W.pierW / 2));
  // (its slots, a step apart along both flanks, clear of its root and its tip)
  const step = figsOf('narrowbody').span + W.wingGap, n = Math.floor((length - W.pierW) / step);
  for (let i = 0; i < n; i++) {
    const t = W.pierW / 2 + step * (i + 0.5) + (length - W.pierW - n * step) / 2, e = [A[0] + u[0] * t, A[1] + u[1] * t];
    for (const side of [1, -1]) ctx.slots.push({ e, u, nOut: [-u[1] * side, u[0] * side], concourse: id, wing });
  }
  if (depth <= 0) return;
  const child = length * (0.5 + ctx.rng() * 0.15), turn = ctx.chi * Math.PI / 2, r = ctx.rng();
  const move = r < 0.5 ? 'hook' : r < 0.75 ? 'cross' : 'continue';
  if (move === 'hook') concourse(ctx, B, angle + turn, child, depth - 1, wing, { floor });
  else if (move === 'cross') { concourse(ctx, B, angle + turn, child, depth - 1, wing, { floor }); concourse(ctx, B, angle - turn, child * (0.7 + ctx.rng() * 0.3), depth - 1, wing, { floor }); }
  else { concourse(ctx, B, angle, child, depth - 1, wing, { floor }); concourse(ctx, B, angle + turn, child * 0.7, depth - 1, wing, { floor }); }
}

// a stand: its aircraft nose-in (its nose toward the pier), its jet bridge from a rotunda off the pier's face to the
// aircraft's first door on its left
function stand(s, f, C, box, k) {
  const d = [-s.nOut[0], -s.nOut[1]], heading = Math.atan2(d[1], d[0]), c = Math.cos(heading), sn = Math.sin(heading);
  // (craft frame to the world: +x its right is (sin, −cos), +y its nose (cos, sin))
  const toWorld = ([x, y]) => [C[0] + x * sn + y * c, C[1] - x * c + y * sn];
  const door = f.door ? toWorld([f.door.x, f.door.y - 0]) : null;
  // (the rotunda off the pier's face, on the door's side of the stand's line; the bridge from it to the door)
  const face = [s.e[0] + s.nOut[0] * (W.pierW / 2), s.e[1] + s.nOut[1] * (W.pierW / 2)];
  // (the rotunda off to the door's side along the pier, so the tunnel swings in to the door at an angle, as a bridge's
  // does: 13 m along the pier past the door, 6 m off its face)
  const along = door ? (door[0] - face[0]) * s.u[0] + (door[1] - face[1]) * s.u[1] : 0;
  const leftU = Math.sign(-sn * s.u[0] + c * s.u[1]) || 1;
  const root = [face[0] + s.u[0] * (along + leftU * 13), face[1] + s.u[1] * (along + leftU * 13)];
  const rotunda = [root[0] + s.nOut[0] * 6, root[1] + s.nOut[1] * 6];
  return {
    id: `${s.concourse}-${k + 1}`, wing: s.wing, concourse: s.concourse, craft: f.craft, at: P2(C), heading: r2(heading),
    e: P2(s.e), u: P2(s.u), nOut: P2(s.nOut), stop: P2(face),
    // (a bridge's cab meets a door from 2.6 m up: a turboprop or a bizjet below that boards by its own airstairs)
    ...(door && f.door.sill >= BRIDGE_SILL ? { bridge: { root: P2(root), rotunda: P2(rotunda), door: P2([...door, f.door.sill]) } } : {}),
    box,
  };
}
