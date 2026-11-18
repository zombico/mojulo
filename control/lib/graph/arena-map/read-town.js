/**
 * A TOWN OR A CITY, CUT AS AN ARENA MAP — a window of a designed geotown (geotown/design.js) or geocity
 * (geocity/design.js) rasterised onto the arena grid (blocks.js), so the arena's laws (laws.js) say what a piece of a
 * main street, a works' yard, a container stack or a pier already holds as a fighting map. A reading, never a
 * redesign: the design is read as it is laid, what the grid cannot hold is said in `read.notes`, and nothing is mended.
 *
 * A neighbourhood block is a hundred metres and a city block more: far past an arena's size, where every line would be
 * dead ground. So the map is a CUT: a window `size` metres square (CUT) of the design, walled at its edge. Named by
 * `at` (its middle, design metres) or `cut` (its rect); else PICKED: the window, of every one on the grid over the
 * segment and the streets round it, with the most edge inside it between open ground and what is not (mass, water),
 * marked down where under half of it is ground, ties to the south-west. The most edge is the most corners to fight
 * round; it is a rule, not a judgement of the map.
 *
 *   readTownMap(spec?, { seed?, block?, at?, size?, cut?, cell?, fill? }) → map
 *     spec    a geotown recipe (geotown/read.js: `{ segment: 'main-street' }`, a neighbourhood, a metro grid)
 *     block   the block the pick is held to (its id; the first built block when absent)
 *   readCityMap(spec?, { seed?, on?, at?, size?, cut?, cell?, fill? }) → map
 *     spec    a geocity recipe (geocity/metro.js)
 *     on      what the pick is held to: an industrial segment (geocity/segments.js INDUSTRY_SEGMENTS: the first block of
 *             that kind) or a waterfront segment's kind (geocity/waterfront.js WATERFRONT_KINDS: the first on the main
 *             shore, its water's edge); CITY_ONS lists them
 *   readGroundMap(G, opts?) → map      the rasteriser both stand on: G = { bounds, masses: [{ rect, h, what }],
 *             rounds: [{ at, r, h, what }], fences: [rect], wet: (x, y) → true over water, notes }
 *   map: { nx, ny, nz: 1, floors, solids, walls, ramps: [], ladders: [], read: { cell, origin, cut, picked, water:
 *          [[i, j, 0]], masses, fences, share: { floor, mass, water }, notes, things?: a city's industrial pieces as its
 *          plan draws them, in the map's metres, `beyond` the ones past its wall (facility.js draws them) } }
 *
 * HOW A DESIGN IS READ (every approximation said):
 *   - THE GRID. One level: the land's hills and a street's grade are not read (a cut is flat). A cell is sampled at a
 *     lattice of points; it is a SOLID where masses taller than an eye cover `fill` (0.5) of it or more, WATER where
 *     water covers half of it or more, else floor.
 *   - WATER is a cell with no floor: nothing stands in it and every line crosses it. The blocks need no new row for it;
 *     its cells are listed in `read.water` for whoever draws the map. At the cut's edge water needs no wall.
 *   - A TOWN'S BUILDINGS are their envelopes (the plots' `house` surfaces: a house, a shop, a walk-up, a garage), closed:
 *     the fight is in the streets, the alley and the yards. Its hedges, gates, parked cars, trees and street furniture
 *     are the scene's, not the design's, and are not read: a yard reads barer than it is drawn.
 *   - A CITY'S INDUSTRY is its block's own plan (industry.js industrialPlan): halls, sheds and offices as masses, closed
 *     (a dock door is not a way in); tanks, spheres, gasholders, silos, a stack and containers as masses by their
 *     footprints; a transformer as a mass. A gantry, a breaker, a pipe rack and a pylon are frames a line passes and are
 *     left out. Its chain-link fence is read as a LOW wall on the nearest grid line: it stops a body and not a line,
 *     which is what a rail does; the plan gives it no gate, so a cut across it keeps the larger side.
 *   - ONE GROUND. The arena is the largest ground a body walks; a yard or a court no way leads to is closed and read as
 *     mass, said in the notes.
 *   - A CITY'S WATERFRONT is its strip's ground out to its shore (waterfront.js shoreAt: a beach's bay, a park's
 *     headland) and its finger piers; past them, water. Its pavilions, parasols, boats and pontoons are the scene's and
 *     are not read. Any other city block in a cut reads as open ground but its towers, said.
 *   - THE EDGE of the cut is walled wherever ground meets it: the arena is the cut.
 *
 * Pure: a function of the design and the cut. Imports the arena's blocks only; nothing here changes how a map is measured.
 */
import { CELL, EYE } from './blocks.js';
import { designGeotown } from '../geotown/design.js';
import { designGeocity } from '../geocity/design.js';
import { industrialPlan, INDUSTRY_FAR } from '../geocity/industry.js';
import { INDUSTRY_SEGMENTS } from '../geocity/segments.js';
import { frameOf, shoreAt, WATERFRONT_KINDS } from '../geocity/waterfront.js';
import { streamOf } from '../city/plan/dice.js';

/** How far past the ground read a place's things are kept, for a skyline over the cut's wall (m). */
const SKYLINE = 60;
/** A cut's side, metres: eighteen cells, a little over the longest of the generator's templates. */
export const CUT = 54;
/** What a city cut may be held to. */
export const CITY_ONS = Object.freeze([...INDUSTRY_SEGMENTS, ...WATERFRONT_KINDS]);
// an industrial piece's footprint about its foot, metres (industry.js's own figures): a round by its radius, a box by
// its half extents along and across the way it lies. What is absent is a frame a line passes (see the header)
const PIECES = Object.freeze({
  tank: { r: 10, h: 12 }, sphere: { r: 7.5, h: 17 }, holder: { r: 22, h: 28 }, stack: { r: 1.9, h: 40 },
  container: { along: 6.1, across: 1.22, h: 2.6 }, silos: { along: 14.4, across: 3.6, h: 24 }, transformer: { along: 2.4, across: 1.6, h: 3.2 },
});
const SUB = 5;
// the pieces seen over a wall from across their district (geocity/industry.js INDUSTRY_FAR)
const FAR_KEYS = INDUSTRY_FAR;
const r2 = (v) => Math.round(v * 100) / 100;
const no = (msg) => { throw new Error(`arena-map: ${msg}`); };

/** The design's ground read onto the arena grid (see the header). */
export function readGroundMap(G, { cell = CELL, fill = 0.5, at = null, size = CUT, cut = null } = {}) {
  const [bx0, by0, bx1, by1] = G.bounds, gx = Math.max(1, Math.floor((bx1 - bx0) / cell)), gy = Math.max(1, Math.floor((by1 - by0) / cell)), notes = [...(G.notes ?? [])];
  if (cell !== CELL) notes.push(`read on a ${cell} m grid: the laws measure a cell as ${CELL} m, so every length they report is ${r2(CELL / cell)} times the design's`);
  const masses = (G.masses ?? []).filter((m) => m.h >= EYE), rounds = (G.rounds ?? []).filter((m) => m.h >= EYE);
  const low = (G.masses ?? []).length + (G.rounds ?? []).length - masses.length - rounds.length;
  if (low) notes.push(`${low} thing${low === 1 ? '' : 's'} lower than an eye left out`);
  // the whole ground classed once: 0 floor, 1 mass, 2 water
  const cls = new Uint8Array(gx * gy);
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    const x0 = bx0 + i * cell, y0 = by0 + j * cell, near = masses.filter((m) => m.rect[0] < x0 + cell && m.rect[2] > x0 && m.rect[1] < y0 + cell && m.rect[3] > y0);
    const nearR = rounds.filter((m) => m.at[0] - m.r < x0 + cell && m.at[0] + m.r > x0 && m.at[1] - m.r < y0 + cell && m.at[1] + m.r > y0);
    let mass = 0, wet = 0;
    for (let b = 0; b < SUB; b++) for (let a = 0; a < SUB; a++) {
      const x = x0 + ((a + 0.5) / SUB) * cell, y = y0 + ((b + 0.5) / SUB) * cell;
      if (near.some((m) => x >= m.rect[0] && x <= m.rect[2] && y >= m.rect[1] && y <= m.rect[3]) || nearR.some((m) => Math.hypot(x - m.at[0], y - m.at[1]) <= m.r)) mass++;
      else if (G.wet && G.wet(x, y)) wet++;
    }
    cls[j * gx + i] = mass >= fill * SUB * SUB ? 1 : wet >= 0.5 * SUB * SUB ? 2 : 0;
  }
  // the cut, in cells: named, or the window with the most edge between ground and what is not
  const n = Math.max(3, Math.round(size / cell)), nx = Math.min(n, gx), ny = Math.min(n, gy);
  let i0, j0, picked = false;
  if (cut) { i0 = Math.round((cut[0] - bx0) / cell); j0 = Math.round((cut[1] - by0) / cell); }
  else if (at) { i0 = Math.round((at[0] - bx0) / cell - nx / 2); j0 = Math.round((at[1] - by0) / cell - ny / 2); }
  const cnx = cut ? Math.max(3, Math.round((cut[2] - cut[0]) / cell)) : nx, cny = cut ? Math.max(3, Math.round((cut[3] - cut[1]) / cell)) : ny;
  if (i0 === undefined) {
    picked = true;
    // (tables summed over a window: the edges inside it between floor and not-floor, east and north apart so an edge
    // out of the window is not counted, and its floor; a window under half floor is marked down by what it lacks)
    const w1 = gx + 1, tab = (f) => { const S = new Int32Array(w1 * (gy + 1)); for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) S[(j + 1) * w1 + i + 1] = f(i, j) + S[j * w1 + i + 1] + S[(j + 1) * w1 + i] - S[j * w1 + i]; return (i, j, ni, nj) => (ni <= 0 || nj <= 0 ? 0 : S[(j + nj) * w1 + i + ni] - S[j * w1 + i + ni] - S[(j + nj) * w1 + i] + S[j * w1 + i]); };
    const isF = (i, j) => cls[j * gx + i] === 0;
    const E = tab((i, j) => (i + 1 < gx && isF(i, j) !== isF(i + 1, j) ? 1 : 0)), N = tab((i, j) => (j + 1 < gy && isF(i, j) !== isF(i, j + 1) ? 1 : 0)), Fl = tab((i, j) => (isF(i, j) ? 1 : 0));
    let best = -Infinity;
    for (let j = 0; j + cny <= gy; j++) for (let i = 0; i + cnx <= gx; i++) {
      const v = E(i, j, cnx - 1, cny) + N(i, j, cnx, cny - 1) - Math.max(0, 0.5 * cnx * cny - Fl(i, j, cnx, cny));
      if (v > best) { best = v; i0 = i; j0 = j; }
    }
  }
  i0 = Math.min(Math.max(0, i0), gx - cnx); j0 = Math.min(Math.max(0, j0), gy - cny);
  if (!(cnx <= gx && cny <= gy)) no(`a cut of ${cnx} by ${cny} cells is wider than the ground read (${gx} by ${gy})`);
  // the cut's own classes, and its fences' lines on the grid
  const ox = bx0 + i0 * cell, oy = by0 + j0 * cell, cc = new Uint8Array(cnx * cny), at0 = (i, j) => cc[j * cnx + i];
  for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) cc[j * cnx + i] = cls[(j0 + j) * gx + i0 + i];
  const open = (i, j) => i >= 0 && j >= 0 && i < cnx && j < cny && at0(i, j) === 0, fenceE = new Set(), fenceN = new Set();
  for (const q of G.fences ?? []) {
    const u0 = Math.round((q[0] - ox) / cell), u1 = Math.round((q[2] - ox) / cell), v0 = Math.round((q[1] - oy) / cell), v1 = Math.round((q[3] - oy) / cell);
    for (let j = Math.max(0, v0); j < Math.min(cny, v1); j++) for (const u of [u0, u1]) if (open(u - 1, j) && open(u, j)) fenceE.add(`${u - 1},${j}`);
    for (let i = Math.max(0, u0); i < Math.min(cnx, u1); i++) for (const v of [v0, v1]) if (open(i, v - 1) && open(i, v)) fenceN.add(`${i},${v - 1}`);
  }
  // ONE GROUND: the arena is the largest ground a body walks (a fence stops it); a yard or a court no way leads to is
  // closed, read as mass, and said
  const comp = new Int32Array(cnx * cny).fill(-1), sizes = [];
  for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) {
    if (!open(i, j) || comp[j * cnx + i] >= 0) continue;
    const id = sizes.length, q = [[i, j]]; comp[j * cnx + i] = id; let n = 0;
    while (q.length) {
      const [a, b] = q.pop(); n++;
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = a + da, e = b + db;
        if (!open(c, e) || comp[e * cnx + c] >= 0) continue;
        if (da ? fenceE.has(`${Math.min(a, c)},${b}`) : fenceN.has(`${a},${Math.min(b, e)}`)) continue;
        comp[e * cnx + c] = id; q.push([c, e]);
      }
    }
    sizes.push(n);
  }
  const main = sizes.indexOf(Math.max(...sizes, 0));
  let closed = 0;
  for (let k = 0; k < cc.length; k++) if (cc[k] === 0 && comp[k] !== main) { cc[k] = 1; closed++; }
  if (closed) notes.push(`${closed} cell${closed === 1 ? '' : 's'} of ground no way leads to (a closed yard, the far side of a fence) read as mass: the arena is one ground`);
  const floors = [], solids = [], water = [], walls = [];
  for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) {
    const c = at0(i, j);
    if (c === 1) { floors.push([i, j, 0]); solids.push([i, j, 0]); continue; }
    if (c === 2) { water.push([i, j, 0]); continue; }
    floors.push([i, j, 0]);
    if (i === 0) walls.push({ at: [-1, j, 0], side: 'e' });
    if (i === cnx - 1) walls.push({ at: [i, j, 0], side: 'e' });
    if (j === 0) walls.push({ at: [i, -1, 0], side: 'n' });
    if (j === cny - 1) walls.push({ at: [i, j, 0], side: 'n' });
  }
  // the fences: a low wall on every edge of one between two cells of ground
  for (const k of fenceE) { const [i, j] = k.split(',').map(Number); if (open(i, j) && open(i + 1, j)) walls.push({ at: [i, j, 0], side: 'e', kind: 'low' }); }
  for (const k of fenceN) { const [i, j] = k.split(',').map(Number); if (open(i, j) && open(i, j + 1)) walls.push({ at: [i, j, 0], side: 'n', kind: 'low' }); }
  const fenced = walls.some((w) => w.kind === 'low') ? (G.fences ?? []).length : 0;
  if (fenced) notes.push(`${fenced} fence${fenced === 1 ? '' : 's'} read as a low wall on the nearest grid line (it stops a body, not a line), with no gate: the plan draws none`);
  // the place's things in the map's own metres: what stands in the cut, and the tall things beyond its wall
  const x1c = ox + cnx * cell, y1c = oy + cny * cell, mv = (q) => [r2(q[0] - ox), r2(q[1] - oy), r2(q[2] - ox), r2(q[3] - oy)];
  const things = (G.things ?? []).map((t) => {
    const q = t.q ?? t.foot ?? [t.at[0] - 1, t.at[1] - 1, t.at[0] + 1, t.at[1] + 1], inside = q[0] < x1c && q[2] > ox && q[1] < y1c && q[3] > oy;
    if (!inside && !(t.kind !== 'stamp' || FAR_KEYS.includes(t.key))) return null;
    return { ...t, ...(t.q ? { q: mv(t.q) } : {}), ...(t.at ? { at: [r2(t.at[0] - ox), r2(t.at[1] - oy)] } : {}), ...(t.foot ? { foot: mv(t.foot) } : {}), ...(inside ? {} : { beyond: true }) };
  }).filter(Boolean);
  const all = cnx * cny;
  return {
    nx: cnx, ny: cny, nz: 1, floors, solids, walls, ramps: [], ladders: [],
    read: { cell, origin: [r2(ox), r2(oy)], cut: [r2(ox), r2(oy), r2(ox + cnx * cell), r2(oy + cny * cell)], picked, water, masses: masses.length + rounds.length, fences: fenced,
      share: { floor: r2((floors.length - solids.length) / all), mass: r2(solids.length / all), water: r2(water.length / all) }, notes, ...(things.length ? { things } : {}) },
  };
}

/** A designed geotown's ground: its buildings' envelopes as masses, inside its frame. */
export function townGround(T, { block = null } = {}) {
  const B = block ? T.blocks.find((b) => b.id === block) ?? no(`the town has no block '${block}' (${T.blocks.map((b) => b.id).join(', ')})`) : T.blocks.find((b) => b.built) ?? T.blocks[0];
  const masses = T.surfaces.filter((s) => s.cls === 'house').map((s) => ({ rect: s.rect, h: 2 * EYE, what: s.kind ?? 'house' }));
  // (the pick is held to the block and half the streets round it)
  const m = T.frame.margin ?? 12, bounds = [Math.max(0, B.rect[0] - m), Math.max(0, B.rect[1] - m), Math.min(T.frame.W, B.rect[2] + m), Math.min(T.frame.D, B.rect[3] + m)];
  return { bounds, masses, notes: [`a cut of block ${B.id} (${B.use}) of a ${T.spec?.evoke ?? 'segment'} geotown: its buildings closed, its hedges, gates, cars and trees not read`] };
}
/** A geotown, cut as an arena map (see the header). */
export function readTownMap(spec = {}, { seed = 1, block = null, ...opts } = {}) {
  const T = designGeotown(spec, { seed });
  return readGroundMap(townGround(T, { block }), opts);
}

/** A designed geocity's ground round what it is held to: its water, its reclaimed shore and piers, its industry's
 *  masses and fences, its towers. */
export function cityGround(d, { on = INDUSTRY_SEGMENTS[0] } = {}) {
  if (!CITY_ONS.includes(on)) no(`a city cut is held to one of ${CITY_ONS.join(', ')}; '${on}' is none`);
  const notes = [], masses = [], rounds = [], fences = [], things = [];
  const blocks = d.regions.flatMap((r) => r.blocks ?? []), strips = d.waterfront ?? [];
  // (water: the bands along its sides, less the ground reclaimed out into them and the piers out from it)
  const frames = strips.map((W) => ({ W, F: frameOf(W) }));
  const landOut = (x, y) => frames.some(({ W, F }) => {
    const a = F.along === 'x' ? x : y, t = (x - (F.along === 'x' ? 0 : W.edge)) * F.out[0] + (y - (F.along === 'x' ? W.edge : 0)) * F.out[1];
    if (t < 0 || a < W.a0 || a > W.a1) return false;
    const g = W.segments.find((s) => a >= s.a0 && a <= s.a1);
    if (!g) return false;
    return t <= shoreAt(g, a) || (g.piers ?? []).some((p) => Math.abs(a - p.a) <= p.w / 2 && t <= g.depth + p.len);
  });
  const wet = (x, y) => (d.water ?? []).some((w) => x >= w.rect[0] && x <= w.rect[2] && y >= w.rect[1] && y <= w.rect[3]) && !landOut(x, y);
  let bounds;
  if (INDUSTRY_SEGMENTS.includes(on)) {
    const b = blocks.filter((x) => x.kind === on).sort((p, q) => (p.id < q.id ? -1 : 1))[0] ?? no(`this city has no ${on} block (its industry's share may be none)`);
    bounds = [b.rect[0] - 12, b.rect[1] - 12, b.rect[2] + 12, b.rect[3] + 12];
    notes.push(`a cut of ${on} block ${b.id} of the metro: its halls closed, its frames (gantries, pipe racks, pylons) not read`);
  } else {
    const W = strips.find((s) => s.main) ?? strips[0] ?? no('this city has no waterfront (no water, or `waterfront: false`)');
    const g = W.segments.find((s) => s.kind === on) ?? no(`its ${W.side} shore has no ${on} (${[...new Set(W.segments.map((s) => s.kind))].join(', ')})`);
    const F = frameOf(W), out = Math.max(0, ...(g.piers ?? []).map((p) => p.len)) + 18, p0 = F.P(g.a0, g.depth - 60), p1 = F.P(g.a1, g.depth + out);
    bounds = [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])];
    notes.push(`a cut of the ${W.side} shore's ${on} at the water's edge: its ground and piers; its pavilions, parasols, boats and pontoons not read`);
  }
  const inB = (q) => q[0] < bounds[2] && q[2] > bounds[0] && q[1] < bounds[3] && q[3] > bounds[1];
  // (the things of the place as its plan draws them, for what draws the map as itself, facility.js: every piece of the
  // industrial blocks in reach, where it stands, how it lies, its size and its paint)
  const reach = [bounds[0] - SKYLINE, bounds[1] - SKYLINE, bounds[2] + SKYLINE, bounds[3] + SKYLINE], inR = (q) => q[0] < reach[2] && q[2] > reach[0] && q[1] < reach[3] && q[3] > reach[1];
  for (const b of blocks) {
    if (!INDUSTRY_SEGMENTS.includes(b.kind) || !inR(b.rect)) continue;
    for (const o of industrialPlan(b, streamOf(d.seed, 'scene', b.id))) {
      if (o.op === 'box') things.push({ kind: 'box', q: o.q, z: o.z ?? 0, h: o.h, wall: o.wall, roof: o.roof });
      else if (o.op === 'gable') things.push({ kind: 'gable', q: o.q, z: o.z ?? 0, ze: o.ze, zr: o.zr, axis: o.axis, wall: o.wall, roof: o.roof });
      else if (o.op === 'stamp') {
        const [key, lies] = o.key.split(':'), Pc = PIECES[key], k = o.scale ?? 1;
        const foot = !Pc ? null : Pc.r ? [o.at[0] - Pc.r * k, o.at[1] - Pc.r * k, o.at[0] + Pc.r * k, o.at[1] + Pc.r * k] : (() => { const ax = lies === 'y' ? [Pc.across, Pc.along] : [Pc.along, Pc.across]; return [o.at[0] - ax[0], o.at[1] - ax[1], o.at[0] + ax[0], o.at[1] + ax[1]]; })();
        things.push({ kind: 'stamp', key, ...(lies ? { lies } : {}), at: o.at.slice(0, 2), ...(o.z ? { z: o.z } : {}), ...(o.scale ? { scale: o.scale } : {}), ...(o.tint ? { tint: o.tint } : {}), ...(foot ? { foot } : {}) });
      }
    }
  }
  let plain = 0;
  for (const b of blocks) {
    if (!inB(b.rect)) continue;
    if (!INDUSTRY_SEGMENTS.includes(b.kind)) { for (const t of b.towers ?? []) masses.push({ rect: t.rect, h: 3 * (t.storeys ?? 4), what: 'tower' }); plain++; continue; }
    for (const o of industrialPlan(b, streamOf(d.seed, 'scene', b.id))) {
      if (o.op === 'box' && (o.z ?? 0) < EYE) masses.push({ rect: o.q, h: (o.z ?? 0) + o.h, what: 'building' });
      else if (o.op === 'gable') masses.push({ rect: o.q, h: o.zr ?? o.ze, what: 'hall' });
      else if (o.op === 'fence') fences.push(o.q);
      else if (o.op === 'stamp' && !(o.z > 0)) {
        const [key, lies] = o.key.split(':'), P = PIECES[key], k = o.scale ?? 1;
        if (!P) continue;
        if (P.r) rounds.push({ at: o.at, r: P.r * k, h: P.h * k, what: key });
        else { const ax = lies === 'y' ? [P.across, P.along] : [P.along, P.across]; masses.push({ rect: [o.at[0] - ax[0], o.at[1] - ax[1], o.at[0] + ax[0], o.at[1] + ax[1]], h: P.h, what: key }); }
      }
    }
  }
  if (plain) notes.push(`${plain} other block${plain === 1 ? '' : 's'} in reach read as open ground but ${plain === 1 ? 'its' : 'their'} towers`);
  return { bounds, masses, rounds, fences, wet, notes, things };
}
/** A geocity, cut as an arena map (see the header). */
export function readCityMap(spec = {}, { seed = 1, on = INDUSTRY_SEGMENTS[0], design = null, ...opts } = {}) {
  const d = design ?? designGeocity(spec, { seed });
  return readGroundMap(cityGround(d, { on }), opts);
}
