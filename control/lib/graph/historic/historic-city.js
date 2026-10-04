/**
 * historic-city — a historic city as a composition of shared visual patterns (./patterns.js) in a
 * culture's palette (./cultures/). Independent of the fractal city; it borrows its principles only:
 * a claim grid (each cell claimed once), split seeded streams (layout vs dressing, so a dressing dial
 * never moves a street), plain masses emitted through the existing scene builders.
 *
 * The plan, in order: water (a canal through the town) → the towered ring wall and its gates → the
 * sacred precinct on its terrace → lanes meandering from each gate to the precinct, with dead-end
 * alleys branching off → house lots packing what is left inside the wall → fields and palm groves.
 *
 * The layout does not build the buildings. It emits SLOTS ({ asset, rect, facing }) — the ziggurat
 * site, each house lot facing its lane, each wall run, tower and gate facing out — and the culture's
 * asset kit (./assets/) builds each one, on its own dressing stream. `assetCall` lists what a layout
 * asks for: the brief for designing the next asset.
 * Plans in metres; the emitter converts to scene units. Pure and deterministic.
 */
import { SUMER } from './cultures/sumer.js';
import { palm } from './patterns.js';
import { assembleBoxCityScene, emitPreserve3dScene } from '../scene/scene-css3d.js';
import { scaleHex } from '../polygonizer/vexar.js';
import { placeAsset, localSize, skinFor } from './assets/kit.js';
import { solidFaces, scaleSolid } from './assets/solids.js';
import { assetBlueprintSvg } from './assets/blueprint.js';
import { makeLight, litFactor } from '../polygonizer/vexar.js';
import { groundTileFace, groundTileCss, skinFace } from './ground.js';

export const HISTORIC_CULTURES = { sumer: SUMER };
const CELL = 3;                                   // claim-grid cell, metres
const C = { EMPTY: 0, WATER: 1, WALL: 2, LANE: 3, PRECINCT: 4, HOUSE: 5, OUTSIDE: 6, OPEN: 7, REED: 8 };
export const METRES_PER_UNIT = 3.66;              // the city scenes' unit (a storey ≈ 0.85 u)

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const stream = (seed, tag) => mulberry32(hash(`${seed}|historic|${tag}`));
const pick = (xs, rng) => xs[Math.floor(rng() * xs.length)];

export function planHistoricCity({ seed = 1, culture = 'sumer', frame = { w: 380, d: 290 }, assets } = {}) {
  const K = HISTORIC_CULTURES[culture] || SUMER, P = K.palette;
  const cols = Math.floor(frame.w / CELL), rows = Math.floor(frame.d / CELL);
  const grid = new Uint8Array(cols * rows);
  const at = (c, r) => (c >= 0 && r >= 0 && c < cols && r < rows ? grid[r * cols + c] : -1);
  const set = (c, r, v) => { if (c >= 0 && r >= 0 && c < cols && r < rows) grid[r * cols + c] = v; };
  const boxes = [], grounds = [];

  // ── 1. the ring: an irregular closed outline (low-frequency radius wobble), everything outside is OUTSIDE ──
  const L = stream(seed, 'layout');
  const cx = cols / 2, cy = rows / 2, rx = cols * 0.4, ry = rows * 0.4;
  const wob = [0, 1, 2].map(() => ({ a: 0.04 + L() * 0.05, f: 2 + Math.floor(L() * 3), p: L() * 6.283 }));
  const radius = (th) => 1 + wob.reduce((s, q) => s + q.a * Math.sin(q.f * th + q.p), 0);
  const inside = (c, r) => { const dx = (c - cx) / rx, dy = (r - cy) / ry, th = Math.atan2(dy, dx); return Math.hypot(dx, dy) < radius(th); };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!inside(c + 0.5, r + 0.5)) set(c, r, C.OUTSIDE);

  // ── 2. the canal: a gentle meander across the whole frame ──
  const cw = Math.max(2, Math.round(K.canal.width / CELL)), cy0 = rows * (0.58 + L() * 0.1), camp = rows * 0.05, cph = L() * 6.283;
  const canalAt = (c) => cy0 + camp * Math.sin((c / cols) * 6.283 * 0.8 + cph);
  for (let c = 0; c < cols; c++) { const m = Math.round(canalAt(c)); for (let k = 0; k < cw; k++) set(c, m + k, C.WATER); }

  // ── 3. the wall: every inside cell bordering an outside cell, thickened inward; towers at intervals ──
  const wt = Math.max(1, Math.round(K.wall.thickness / CELL));
  const wallCells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (at(c, r) === C.OUTSIDE || at(c, r) === C.WATER) continue;
    let edge = false;
    for (let dr = -wt; dr <= wt && !edge; dr++) for (let dc = -wt; dc <= wt && !edge; dc++) if (Math.abs(dr) + Math.abs(dc) <= wt && at(c + dc, r + dr) === C.OUTSIDE) edge = true;
    if (edge) wallCells.push([c, r]);
  }
  for (const [c, r] of wallCells) set(c, r, C.WALL);
  // an open strip inside the wall (houses keep off it), so the wall stands clear of the town
  const strip = Math.max(1, Math.round((K.wall.strip || 0) / CELL));
  for (const [c, r] of wallCells) for (let dr = -strip - 1; dr <= strip + 1; dr++) for (let dc = -strip - 1; dc <= strip + 1; dc++) if (at(c + dc, r + dr) === C.EMPTY) set(c + dc, r + dr, C.OPEN);

  // ── 4. the precinct, off-centre on the far side of the canal ──
  const pw = Math.round(K.precinct.size[0] / CELL), pd = Math.round(K.precinct.size[1] / CELL);
  const pc0 = Math.round(cx - pw / 2 + (L() - 0.5) * cols * 0.12), pr0 = Math.max(Math.round(rows * 0.16), Math.round(canalAt(cx) - pd - rows * 0.08));
  for (let r = pr0; r < pr0 + pd; r++) for (let c = pc0; c < pc0 + pw; c++) if (at(c, r) !== C.WATER) set(c, r, C.PRECINCT);
  const precinct = { x: pc0 * CELL, y: pr0 * CELL, w: pw * CELL, d: pd * CELL };
  const precinctGate = [pc0 + Math.floor(pw / 2), pr0 + pd];   // the precinct opens toward the canal

  // ── 5. gates: where the wall meets a ray from the centre toward each compass side ──
  const gates = [];
  for (const th of [0.15, 1.75, 3.3, 4.75].map((a) => a + (L() - 0.5) * 0.4)) {
    let c = cx, r = cy, last = null;
    for (let s = 0; s < cols + rows; s++) {
      c += Math.cos(th); r += Math.sin(th) * (ry / rx);
      const v = at(Math.round(c), Math.round(r));
      if (v === C.WALL) last = [Math.round(c), Math.round(r)];
      if (v === C.OUTSIDE || v === -1) break;
    }
    if (last) gates.push(last);
  }

  // ── 6. lanes: a biased walk from each gate to the precinct gate, then dead-end alleys branching off ──
  const laneCells = [], bridgeCells = new Set();
  // what each lane cell is surfaced with (read at street level): the main streets are packed rubble,
  // the quays baked brick, everything else beaten mud
  const S = { MUD: 0, RUBBLE: 1, BRICK: 2 }, surf = new Uint8Array(cols * rows);
  const carve = (c, r, width, surface = S.MUD) => {
    for (let k = 0; k < width; k++) for (let j = 0; j < width; j++) {
      const v = at(c + k, r + j);
      if (v === C.EMPTY || v === C.WALL || v === C.LANE) { set(c + k, r + j, C.LANE); laneCells.push([c + k, r + j]); if (surface) surf[(r + j) * cols + c + k] = surface; }
      if (v === C.WATER) bridgeCells.add(`${c + k},${r + j}`);   // a footbridge where the lane crosses the canal
    }
  };
  const walk = (from, to, width, rng, path = [], maxSteps = 4000) => {
    let [c, r] = from;
    for (let s = 0; s < maxSteps; s++) {
      carve(c, r, width, S.RUBBLE);
      path.push([c, r]);
      const dc = to[0] - c, dr = to[1] - r;
      if (Math.abs(dc) + Math.abs(dr) <= 1) return true;
      const u = rng();
      // mostly toward the goal on the dominant axis, sometimes the other axis, sometimes a sideways wobble
      if (u < 0.62) { if (Math.abs(dc) > Math.abs(dr)) c += Math.sign(dc); else r += Math.sign(dr); }
      else if (u < 0.86) { if (Math.abs(dc) > Math.abs(dr)) r += Math.sign(dr || (rng() < 0.5 ? 1 : -1)); else c += Math.sign(dc || (rng() < 0.5 ? 1 : -1)); }
      else { if (rng() < 0.5) c += rng() < 0.5 ? 1 : -1; else r += rng() < 0.5 ? 1 : -1; }
      if (at(c, r) === C.PRECINCT) return true;
      if (at(c, r) === C.OUTSIDE || at(c, r) === -1) return false;
    }
    return false;
  };
  const LL = stream(seed, 'lanes');
  const mainPaths = gates.map((g) => { const path = []; walk(g, precinctGate, K.lanes.main, LL, path); return path; });
  // a quay lane along each canal bank
  for (let c = 0; c < cols; c++) { const m = Math.round(canalAt(c)); for (const r of [m - 1, m + cw]) if (at(c, r) === C.EMPTY) { set(c, r, C.LANE); laneCells.push([c, r]); surf[r * cols + c] = S.BRICK; } }
  for (let i = 0; i < K.lanes.branches; i++) {
    const [c, r] = laneCells[Math.floor(LL() * laneCells.length)];
    const len = K.lanes.branchLen[0] + Math.floor(LL() * (K.lanes.branchLen[1] - K.lanes.branchLen[0]));
    const horiz = LL() < 0.5, dir = LL() < 0.5 ? 1 : -1;
    let cc = c, rr = r;
    for (let s = 0; s < len; s++) {
      if (horiz) cc += dir; else rr += dir;
      if (LL() < 0.18) { if (horiz) rr += LL() < 0.5 ? 1 : -1; else cc += LL() < 0.5 ? 1 : -1; }
      const v = at(cc, rr);
      if (v !== C.EMPTY && v !== C.LANE) break;
      set(cc, rr, C.LANE);
    }
  }

  // ── 7. the precinct: terrace, precinct wall and floor (ground work), then its slots ──
  const slots = [];   // what the layout asks for: { asset, rect, facing, z? }, built by the culture's kit
  const PR = K.precinct;
  boxes.push({ kind: 'terrace', ...precinct, z0: 0, z1: 1.2, tint: P.platform });
  const pwT = PR.wall;
  boxes.push(
    { kind: 'precinct-wall', x: precinct.x, y: precinct.y, w: precinct.w, d: pwT, z0: 0, z1: PR.wallHeight, tint: P.wall },
    { kind: 'precinct-wall', x: precinct.x, y: precinct.y + pwT, w: pwT, d: precinct.d - 2 * pwT, z0: 0, z1: PR.wallHeight, tint: P.wall },
    { kind: 'precinct-wall', x: precinct.x + precinct.w - pwT, y: precinct.y + pwT, w: pwT, d: precinct.d - 2 * pwT, z0: 0, z1: PR.wallHeight, tint: P.wall },
  );
  // the front wall, with a gate gap toward the canal
  const gx = precinctGate[0] * CELL, gapW = 8;
  boxes.push(
    { kind: 'precinct-wall', x: precinct.x, y: precinct.y + precinct.d - pwT, w: gx - gapW / 2 - precinct.x, d: pwT, z0: 0, z1: PR.wallHeight, tint: P.wall },
    { kind: 'precinct-wall', x: gx + gapW / 2, y: precinct.y + precinct.d - pwT, w: precinct.x + precinct.w - gx - gapW / 2, d: pwT, z0: 0, z1: PR.wallHeight, tint: P.wall },
  );
  grounds.push({ kind: 'precinct-floor', x: precinct.x + pwT, y: precinct.y + pwT, w: precinct.w - 2 * pwT, d: precinct.d - 2 * pwT, z: 1.35, fill: P.precinctFloor, surface: 'brick' });
  // the ziggurat sits back in the precinct, its stair toward the gate (+y); a lesser temple in the court
  const [plw, pld] = PR.platform;
  slots.push({ asset: 'ziggurat', rect: { x: precinct.x + (precinct.w - plw) / 2, y: precinct.y + precinct.d * 0.12, w: plw, d: pld }, facing: 's', z: 1.2 });
  slots.push({ asset: 'white-temple', rect: { x: precinct.x + precinct.w * 0.08, y: precinct.y + precinct.d * 0.55, w: precinct.w * 0.22, d: precinct.d * 0.25 }, facing: 'e', z: 1.2 });

  // ── 8. houses: pack the remaining inside cells with lots; each lot is a slot facing its lane ──
  const H = K.house, LOT = stream(seed, 'lots');
  const order = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (at(c, r) === C.EMPTY) order.push(c + r * cols);
  // lots are laid in reading order, so each grows to its full size against its neighbours (a shuffled
  // order fragments the blocks into slivers); the dice still size every lot
  const lots = [];
  for (const idx of order) {
    const c0 = idx % cols, r0 = Math.floor(idx / cols);
    if (at(c0, r0) !== C.EMPTY) continue;
    const tw2 = Math.round((H.size[0] + LOT() * (H.size[1] - H.size[0])) / CELL), td2 = Math.round((H.size[0] + LOT() * (H.size[1] - H.size[0])) / CELL);
    let w = 1, d = 1;
    // grow right then down while every cell is free
    while (w < tw2 && colFree(c0 + w, r0, d)) w++;
    while (d < td2 && rowFree(c0, r0 + d, w)) d++;
    if (w * d < 2) { set(c0, r0, C.OPEN); continue; }
    for (let r = r0; r < r0 + d; r++) for (let c = c0; c < c0 + w; c++) set(c, r, C.HOUSE);
    lots.push({ c0, r0, w, d });
  }
  function colFree(c, r, d) { for (let k = 0; k < d; k++) if (at(c, r + k) !== C.EMPTY) return false; return true; }
  function rowFree(c, r, w) { for (let k = 0; k < w; k++) if (at(c + k, r) !== C.EMPTY) return false; return true; }
  // a lot faces the side with the most lane along it (the door is on the street); which house it gets
  // follows from its size alone
  const open = (c, r) => { const v = at(c, r); return v === C.LANE || v === C.OPEN; };
  for (const { c0, r0, w, d } of lots) {
    const side = { n: 0, s: 0, w: 0, e: 0 };
    for (let k = 0; k < w; k++) { side.n += open(c0 + k, r0 - 1); side.s += open(c0 + k, r0 + d); }
    for (let k = 0; k < d; k++) { side.w += open(c0 - 1, r0 + k); side.e += open(c0 + w, r0 + k); }
    const facing = ['s', 'n', 'e', 'w'].reduce((best, f) => (side[f] > side[best] ? f : best), 's');
    const rect = { x: c0 * CELL, y: r0 * CELL, w: w * CELL, d: d * CELL };
    const asset = Math.min(rect.w, rect.d) >= H.courtyardMin ? 'house-court' : rect.w * rect.d >= 120 ? 'house-tall' : 'house-small';
    slots.push({ asset, rect, facing });
  }

  // ── 9. the wall, its towers and gates, as slots facing out of the town (gate cells stay open) ──
  const gateSet = new Set();
  for (const [gc, gr] of gates) for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) gateSet.add(`${gc + dc},${gr + dr}`);
  const W = K.wall;
  const faceOut = (x, y) => { const dx = x / CELL - cx, dy = (y / CELL - cy) * (rx / ry); return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : (dy > 0 ? 's' : 'n'); };
  runs(grid, cols, rows, (v, c, r) => v === C.WALL && !gateSet.has(`${c},${r}`), (c, r, n) => {
    const rect = { x: c * CELL, y: r * CELL, w: n * CELL, d: CELL };
    const facing = faceOut(rect.x + rect.w / 2, rect.y + CELL / 2), [dc, dr] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[facing];
    let exposed = false;   // the run's outer face meets open country: it wears the face detail
    for (let k = 0; k < n && !exposed; k++) { const v = at(c + k + dc, r + dr); exposed = v === C.OUTSIDE || v === -1; }
    slots.push({ asset: 'wall-run', rect, facing, exposed });
  });
  const T = stream(seed, 'towers');
  let lastT = null;
  const ringOrder = wallCells.filter(([c, r]) => !gateSet.has(`${c},${r}`)).sort((a, b) => Math.atan2(a[1] - cy, (a[0] - cx) * ry / rx) - Math.atan2(b[1] - cy, (b[0] - cx) * ry / rx));
  for (const [c, r] of ringOrder) {
    if (at(c, r) !== C.WALL) continue;
    const p = [c * CELL, r * CELL];
    if (lastT && Math.hypot(p[0] - lastT[0], p[1] - lastT[1]) < W.towerEvery) continue;
    const s = W.tower * (0.9 + T() * 0.2);
    slots.push({ asset: 'wall-tower', rect: { x: p[0] - s / 2 + CELL / 2, y: p[1] - s / 2 + CELL / 2, w: s, d: s }, facing: faceOut(p[0], p[1]) });
    lastT = p;
  }
  // a gate: two towers flanking the opening, across the wall's line
  for (const [gc, gr] of gates) {
    const along = at(gc + 3, gr) === C.WALL || at(gc - 3, gr) === C.WALL;   // the wall runs along x here
    const x = gc * CELL + CELL / 2, y = gr * CELL + CELL / 2, L = 27, Dg = 12;
    const rect = along ? { x: x - L / 2, y: y - Dg / 2, w: L, d: Dg } : { x: x - Dg / 2, y: y - L / 2, w: Dg, d: L };
    const out = faceOut(x, y);
    slots.push({ asset: 'city-gate', rect, facing: along ? (out === 'n' || out === 's' ? out : (y / CELL > cy ? 's' : 'n')) : (out === 'e' || out === 'w' ? out : (x / CELL > cx ? 'e' : 'w')) });
  }

  // ── 9b. the marsh fringe: reed houses on the canal banks outside the wall, their open ends to the water ──
  const M = stream(seed, 'marsh'), rw = 6, rd = 11;
  const freeOut = (x, y, w, d) => { for (let r = Math.floor(y / CELL); r <= Math.floor((y + d) / CELL); r++) for (let c = Math.floor(x / CELL); c <= Math.floor((x + w) / CELL); c++) if (at(c, r) !== C.OUTSIDE) return false; return true; };
  let reeds = 0;
  for (let c = 1; c < cols - 3; c += 3 + Math.floor(M() * 4)) {
    const m = Math.round(canalAt(c));
    for (const north of [true, false]) {
      if (M() < 0.35) continue;
      const x = c * CELL + M() * 2, y = north ? (m - 1) * CELL - rd - 0.5 : (m + cw + 1) * CELL + 0.5;
      if (!freeOut(x, y, rw, rd)) continue;
      for (let r = Math.floor(y / CELL); r <= Math.floor((y + rd) / CELL); r++) for (let cc = Math.floor(x / CELL); cc <= Math.floor((x + rw) / CELL); cc++) set(cc, r, C.REED);
      slots.push({ asset: 'reed-house', rect: { x, y, w: rw, d: rd }, facing: north ? 's' : 'n' });
      reeds++;
    }
  }

  // ── 10. art and street structures, placed by meaning (see patterns.js families `art` and `street`) ──
  // the sacred axis: the ziggurat's stair comes down toward the precinct gate; art gathers at its foot,
  // at the gate and at the temple door
  const PZ = 1.2, zig = slots.find((q) => q.asset === 'ziggurat').rect, ax = zig.x + zig.w / 2;
  const stairFoot = zig.y + zig.d + zig.d * 0.5;                    // where the central flight lands (its run is half the depth)
  const stairW = Math.max(3.5, zig.w * 0.09) + 1.4;                 // the flight and its cheeks
  const pfront = precinct.y + precinct.d - pwT;
  slots.push({ asset: 'ritual-vase', rect: { x: ax - stairW / 2 - 2.6, y: stairFoot - 1.4, w: stairW + 5.2, d: 1.4 }, facing: 's', z: PZ });
  slots.push({ asset: 'guardians', rect: { x: ax - stairW / 2 - 8, y: stairFoot - 3.4, w: stairW + 16, d: 3.4 }, facing: 's', z: PZ });
  slots.push({ asset: 'altar', rect: { x: ax - 3, y: stairFoot + 1.5, w: 6, d: 6 }, facing: 'n', z: PZ });
  // the precinct gate: the goddess's reed posts outside it, victory stelae just within
  slots.push({ asset: 'door-posts', rect: { x: gx - gapW / 2 - 1.6, y: precinct.y + precinct.d + 0.4, w: gapW + 3.2, d: 1.4 }, facing: 's' });
  for (const o of [-1, 1]) slots.push({ asset: 'stele', rect: { x: gx + o * (gapW / 2 + 5) - 1.4, y: pfront - 4, w: 2.8, d: 2.2 }, facing: 's', z: PZ });
  // the white temple's door (its front faces east): posts either side of it
  const wtr = slots.find((q) => q.asset === 'white-temple').rect;
  slots.push({ asset: 'door-posts', rect: { x: wtr.x + wtr.w + 0.3, y: wtr.y + wtr.d * 0.5 - 4, w: 1.4, d: 8 }, facing: 'e', z: PZ });
  // worshippers stand in a row before the god, facing the ziggurat
  slots.push({ asset: 'votive-row', rect: { x: precinct.x + precinct.w * 0.08, y: pfront - 9, w: precinct.w * 0.24, d: 2.6 }, facing: 'n', z: PZ });
  // the pillar hall, cone mosaic, in the court's other front corner, facing the axis
  slots.push({ asset: 'pillar-hall', rect: { x: precinct.x + precinct.w * 0.64, y: precinct.y + precinct.d * 0.66, w: precinct.w * 0.3, d: precinct.d * 0.22 }, facing: 'w', z: PZ });

  // the temple economy: the courtyard lots nearest the precinct become its granaries
  const nearP = (r) => Math.max(precinct.x - (r.x + r.w), r.x - (precinct.x + precinct.w), precinct.y - (r.y + r.d), r.y - (precinct.y + precinct.d), 0);
  slots.filter((q) => q.asset === 'house-court').sort((a, b) => nearP(a.rect) - nearP(b.rect) || a.rect.y - b.rect.y || a.rect.x - b.rect.x).slice(0, 2).forEach((q) => { q.asset = 'granary'; });
  const ST = stream(seed, 'street');
  // wells where lanes meet: a lane cell with lane on three or four sides, spread through the town
  const wells = [], lane = (c, r) => at(c, r) === C.LANE;
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
    if (!lane(c, r) || lane(c - 1, r) + lane(c + 1, r) + lane(c, r - 1) + lane(c, r + 1) < 3) continue;
    const p = [c * CELL + CELL / 2, r * CELL + CELL / 2];
    if (wells.every((w) => Math.hypot(w[0] - p[0], w[1] - p[1]) > 55) && ST() < 0.5) wells.push(p);
  }
  for (const [x, y] of wells.slice(0, 7)) slots.push({ asset: 'well', rect: { x: x - 1.45, y: y - 1.45, w: 2.9, d: 2.9 }, facing: 's' });
  // the potters' quarter: kilns in the open strip under one stretch of the wall, where the smoke goes
  const quarter = ST() * 6.283, kilns = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (at(c, r) !== C.OPEN || at(c + 1, r) !== C.OPEN || at(c, r + 1) !== C.OPEN) continue;
    const th = Math.atan2((r - cy) * rx / ry, c - cx), dth = Math.abs(((th - quarter + 9.42) % 6.283) - 3.14);
    const p = [c * CELL, r * CELL];
    if (dth < 0.35 && kilns.every((k) => Math.hypot(k[0] - p[0], k[1] - p[1]) > 9)) kilns.push(p);
  }
  for (const [x, y] of kilns.slice(0, 5)) slots.push({ asset: 'pottery-kiln', rect: { x, y, w: 4, d: 4 }, facing: faceOut(x, y) === 'n' ? 's' : 'n' });
  // boats moored in the canal inside the town, along the quays
  for (let c = 4; c < cols - 6; c += 9 + Math.floor(ST() * 8)) {
    const m = Math.round(canalAt(c)), x = c * CELL;
    if (![0, 1, 2, 3].every((k) => at(c + k, m) === C.WATER) || bridgeCells.has(`${c},${m}`) || !inside(c, m)) continue;
    const north = ST() < 0.5, y = north ? m * CELL + 0.3 : (m + cw) * CELL - 2.5;
    slots.push({ asset: 'reed-boat', rect: { x, y, w: 10, d: 2.2 }, facing: north ? 'n' : 's', z: 0.1 });
  }

  // ── place: every slot built by the culture's kit, on its own dressing stream ──
  const kit = assets || K.assets;
  for (const [i, slot] of slots.entries()) {
    const A = kit[slot.asset];
    if (!A) throw new Error(`no asset '${slot.asset}' in the ${culture} kit`);
    const placed = placeAsset(A, slot, { palette: P, culture: K, rng: stream(seed, `asset|${i}`) });
    boxes.push(...placed.boxes); grounds.push(...placed.grounds);
  }

  // ── 10. ground: base earth, lanes, water, fields and palm groves outside ──
  grounds.unshift({ kind: 'ground', x: 0, y: 0, w: cols * CELL, d: rows * CELL, z: 0.01, fill: P.ground, surface: 'dry-earth' });
  const laneSurface = { [S.MUD]: ['mud', P.lane], [S.RUBBLE]: ['rubble', P.street], [S.BRICK]: ['brick', P.paving] };
  for (const sv of [S.MUD, S.RUBBLE, S.BRICK]) {
    const [surface, fill] = laneSurface[sv];
    runs(grid, cols, rows, (v, c, r) => (v === C.LANE || v === C.OPEN) && surf[r * cols + c] === sv, (c, r, n) => grounds.push({ kind: 'lane', x: c * CELL, y: r * CELL, w: n * CELL + 0.15, d: CELL + 0.15, z: 0.02, fill, surface }));   // a hair of overlap closes the seams
  }
  runs(grid, cols, rows, (v) => v === C.WATER, (c, r, n) => grounds.push({ kind: 'water', x: c * CELL, y: r * CELL, w: n * CELL, d: CELL, z: 0.015, fill: P.water }));
  for (const key of bridgeCells) { const [c, r] = key.split(',').map(Number); boxes.push({ kind: 'bridge', x: c * CELL, y: r * CELL, w: CELL, d: CELL, z0: 0.3, z1: 0.8, tint: P.bridge }); }
  const G = stream(seed, 'groves');
  let palms = 0;
  for (let r = 0; r < rows; r += 4) for (let c = 0; c < cols; c += 4) {
    if (at(c, r) !== C.OUTSIDE) continue;
    const nearWater = Math.abs(r - canalAt(c)) < 14;
    const u = G();
    if (u < 0.35) grounds.push({ kind: 'field', x: c * CELL, y: r * CELL, w: 4 * CELL, d: 4 * CELL, z: 0.02, fill: pick(P.field, G) });
    if (palms < K.groves.max && G() < K.groves.density * (nearWater ? 1.4 : 0.6)) {
      const n = 1 + Math.floor(G() * 2);
      for (let k = 0; k < n; k++) {
        const px = c * CELL + G() * 12, py = r * CELL + G() * 12, pp = palm(px, py, G);
        if (at(Math.floor(px / CELL), Math.floor(py / CELL)) === C.OUTSIDE) { boxes.push(pp); palms++; }   // never in a reed house
      }
    }
  }
  // palms along the canal inside the town
  for (let c = 0; c < cols; c += 5) { const m = Math.round(canalAt(c)) - 2; if (at(c, m) === C.EMPTY || at(c, m) === C.OPEN) { boxes.push(palm(c * CELL + 1.5, m * CELL + 1.5, G)); palms++; } }

  // ── the street view: standing in the main street that climbs from the south toward the precinct,
  // some 60–80 m short of its gate, eye height, looking up the street at the ziggurat ──
  const pg = [precinctGate[0] * CELL, precinctGate[1] * CELL];
  const southern = mainPaths.filter((pth) => pth.length && pth[0][1] * CELL > pg[1] + 30).sort((a, b) => b.length - a.length)[0] || mainPaths.find((pth) => pth.length) || [[precinctGate[0], precinctGate[1] + 20]];
  const half = (K.lanes.main * CELL) / 2;
  const standAt = southern.map(([c, r]) => [c * CELL + half, r * CELL + half]).find(([x, y]) => Math.hypot(x - pg[0], y - pg[1]) < 80 && y > pg[1] + 25) || [pg[0], pg[1] + 60];
  const views = {
    street: { eye: [standAt[0], standAt[1], 1.7], at: [pg[0], precinct.y + precinct.d * 0.35, 9] },
    // just inside the precinct gate, off the sacred axis so the altar does not fill the eye: the altar, the vases and
    // the copper bulls at the stair foot, the stair climbing to the shrine
    precinct: { eye: [pg[0] + 5.2, precinct.y + precinct.d - pwT - 0.6, 1.35 + 1.9], at: [pg[0] - 2, precinct.y + precinct.d * 0.4, 8] },   // between the gate jamb and the stele
  };

  for (const b of boxes) if (b.skin === undefined) { const skin = skinFor(K, b); if (skin) b.skin = skin; }   // the precinct's own masses
  return {
    boxes, grounds, views, frame: { w: cols * CELL, d: rows * CELL },
    slots,
    stats: {
      culture, houses: slots.filter((q) => q.asset.startsWith('house')).length, courtyards: slots.filter((q) => q.asset === 'house-court').length,
      towers: slots.filter((q) => q.asset === 'wall-tower').length, reedHouses: slots.filter((q) => q.asset === 'reed-house').length, gates: gates.length, palms, precinct, laneCells: grid.reduce((n, v) => n + (v === C.LANE ? 1 : 0), 0),
    },
    grid: { cols, rows, cell: CELL, data: grid, codes: C },
  };
}

// row runs of cells matching `test`, as (c, r, n)
function runs(grid, cols, rows, test, emit) {
  for (let r = 0; r < rows; r++) {
    let start = -1;
    for (let c = 0; c <= cols; c++) {
      const ok = c < cols && test(grid[r * cols + c], c, r);
      if (ok && start < 0) start = c;
      if (!ok && start >= 0) { emit(start, r, c - start); start = -1; }
    }
  }
}

/**
 * The asset call: what a layout asks the kit for — each asset's slot count, the size envelope its slots
 * span (local W × D, metres) and whether the kit has a designed asset or still a placeholder. This is
 * the design brief for the image worker.
 */
export function assetCall(plan, kit) {
  const by = new Map();
  for (const q of plan.slots) {
    const { W, D } = localSize(q.rect, q.facing);
    const e = by.get(q.asset) || { asset: q.asset, count: 0, W: [Infinity, -Infinity], D: [Infinity, -Infinity] };
    e.count++; e.W = [Math.min(e.W[0], W), Math.max(e.W[1], W)]; e.D = [Math.min(e.D[0], D), Math.max(e.D[1], D)];
    by.set(q.asset, e);
  }
  return [...by.values()].map((e) => ({ ...e, designed: !!kit[e.asset]?.designed }));
}

/** Plan → a CSS 3D scene (the city scene's assembler), in scene units, with an aerial and a lane-level camera. */
// the box city's own light, so solids shade like the masses beside them
const SCENE_LIGHT = makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
// px per scene unit. A panel rasterises at its own px size and an eye-level camera magnifies the near
// ground many times, so at the box city's 22 the paving smears to a blur — the eye-level views raster
// at 48. From the air every panel is on screen at once and the box city's 22 is plenty.
const UNIT_SCALE = { aerial: 22, approach: 22, street: 48, precinct: 48 };

/**
 * Metre grounds → scene faces, kept in their stacking order (base earth, then fields, water, lanes,
 * courts): the ground layers sit millimetres apart, so it is draw order that keeps the canal above the
 * earth. A surfaced ground (mud, rubble, brick, dry earth) is a tiled face; the rest flat colour.
 */
function groundsToScene(grounds, s, us, textured = true) {
  const faces = [];
  for (const g of grounds) {
    const o = { ...g, x: g.x * s, y: g.y * s, w: g.w * s, d: g.d * s, z: g.z * s }, lit = scaleHex(g.fill, litFactor([0, 0, 1], SCENE_LIGHT));
    if (g.surface && textured) faces.push(groundTileFace(o, g.surface, g.fill, lit, { us, mpu: METRES_PER_UNIT }));
    else faces.push({ corners: [[o.x, o.y, o.z], [o.x + o.w, o.y, o.z], [o.x + o.w, o.y + o.d, o.z], [o.x, o.y + o.d, o.z]], fill: lit, doubleSided: true });
  }
  return { grounds: [], faces };
}
/** Emit a historic scene: the box city's page, with the ground tiles defined once at the top. */
function emitHistoric(scene) {
  const css = groundTileCss(scene.faces);
  const html = emitPreserve3dScene(scene);
  return css ? html.replace('<style>\n', `<style>\n${css}`) : html;
}

/** Metre masses → scene units: plain boxes for the box emitter, angled solids as their own faces. */
function toScene(masses, s, us = UNIT_SCALE.aerial) {
  const boxes = [], faces = [];
  for (const b of masses) {
    const tile = { us, mpu: METRES_PER_UNIT };
    // a skinned box goes the solid way (an unleaning frustum) so its faces can wear the skin
    const m = b.skin && !b.solid ? { ...b, solid: 'frustum', top: { x: b.x, y: b.y, w: b.w, d: b.d } } : b;
    if (m.solid) { const fs = solidFaces(scaleSolid(m, s), SCENE_LIGHT, tile); faces.push(...(b.skin ? fs.map((f) => skinFace(f, b.skin, tile)) : fs)); continue; }
    const o = { ...b, x: b.x * s, y: b.y * s, w: b.w * s, d: b.d * s, z0: b.z0 * s, z1: b.z1 * s };
    if (b.plant) o.plant = { ...b.plant, height: b.plant.height * s, stemRadius: b.plant.stemRadius * s };
    else o.lod = 'mass';   // a plain lit mass in its own tint: the big read
    boxes.push(o);
  }
  return { boxes, faces };
}

export function assembleHistoricCityScene(opts = {}) {
  const view = ['approach', 'street', 'precinct'].includes(opts.view) ? opts.view : 'aerial';
  const plan = planHistoricCity(opts);
  const s = 1 / METRES_PER_UNIT;
  const { boxes, faces } = toScene(plan.boxes, s, UNIT_SCALE[view]);
  const G = groundsToScene(plan.grounds, s, UNIT_SCALE[view]), grounds = G.grounds;
  faces.unshift(...G.faces);
  const W = plan.frame.w * s, Dd = plan.frame.d * s, pc = plan.stats.precinct;
  const pcx = (pc.x + pc.w / 2) * s, pcy = (pc.y + pc.d / 2) * s;
  const cameras = [
    { name: 'aerial', worldFraming: { cameraPosition: [W * 0.5, Dd * 1.25, Math.max(W, Dd) * 0.55], lookAt: [W * 0.5, Dd * 0.45, 0], horizontalFov: 62, pictureCenter: [560, 390] } },
    { name: 'approach', worldFraming: { cameraPosition: [pcx - 30, pcy + 55, 6], lookAt: [pcx, pcy, 4], horizontalFov: 70, pictureCenter: [560, 390] } },
  ];
  for (const [name, v] of Object.entries(plan.views)) cameras.push({ name, worldFraming: { cameraPosition: v.eye.map((q) => q * s), lookAt: v.at.map((q) => q * s), horizontalFov: 74, pictureCenter: [560, 390] } });
  // the asked-for view first (it is the one the page opens on)
  const first = cameras.findIndex((c) => c.name === view);
  if (first > 0) cameras.unshift(...cameras.splice(first, 1));
  const scene = assembleBoxCityScene({ boxes, grounds, faces, cameras, title: `mojulo historic city · ${plan.stats.culture}`, bg: '#d9cdb4', light: SCENE_LIGHT, unitScale: UNIT_SCALE[view] });
  return { ...scene, stats: plan.stats };
}

/** A plan or asset scene → the CSS 3D page (ground tiles embedded once). */
export { emitHistoric };

export function renderHistoricCityToHtml(opts = {}) {
  return emitHistoric(assembleHistoricCityScene(opts));
}

/**
 * One asset alone on a base tile, seen from the front-left and above, like the massing sheet it was
 * read from: the review view for the asset loop (set it beside the sheet).
 */
export function assembleAssetSheetScene({ asset, culture = 'sumer', size, seed = 1, kit } = {}) {
  const K = HISTORIC_CULTURES[culture] || SUMER;
  const A = kit[asset];
  if (!A) throw new Error(`unknown asset '${asset}'`);
  const [w, d] = size || [(A.envelope.w[0] + A.envelope.w[1]) / 2, (A.envelope.d[0] + A.envelope.d[1]) / 2];
  const pad = Math.max(w, d) * 0.45, tile = { x: 0, y: 0, w: w + 2 * pad, d: d + 2 * pad };
  const slot = { asset, rect: { x: pad, y: pad, w, d }, facing: 's', exposed: true };   // front toward +y, where the camera stands
  const placed = placeAsset(A, slot, { palette: K.palette, culture: K, rng: stream(seed, `asset|${asset}`) });
  const s = 1 / METRES_PER_UNIT;
  // small pieces (a stele, a vase) get more pixels per unit, or their facets are a pixel wide
  const us = Math.round(Math.min(150, Math.max(UNIT_SCALE.aerial, UNIT_SCALE.aerial * (50 / Math.max(tile.w, tile.d)))));
  const { boxes, faces } = toScene(placed.boxes, s, us);
  const G = groundsToScene([{ kind: 'ground', ...tile, z: 0.01, fill: K.palette.ground }, ...placed.grounds], s, us), grounds = G.grounds;
  faces.unshift(...G.faces);
  const top = Math.max(...placed.boxes.map((b) => b.z1));   // frame the tall ones by their height too
  const S = Math.max(tile.w, tile.d, top * 2.4) * s, cx = tile.w * s / 2, cy = tile.d * s / 2;
  const cameras = [{ name: 'sheet', worldFraming: { cameraPosition: [cx - S * 0.75, cy + S * 0.95, S * 0.85], lookAt: [cx, cy, top * s * 0.4], horizontalFov: 42, pictureCenter: [560, 390] } }];
  return assembleBoxCityScene({ boxes, grounds, faces, cameras, title: `mojulo historic asset · ${asset}`, bg: '#dcdcdc', light: SCENE_LIGHT, unitScale: us });
}

/**
 * An asset's blueprint (SVG): its own parts, built for a mid-envelope slot, drawn as pure geometry —
 * the step before the 3D render (see assets/blueprint.js).
 */
export function assetBlueprint({ asset, culture = 'sumer', size, seed = 1, kit } = {}) {
  const K = HISTORIC_CULTURES[culture] || SUMER, A = (kit || K.assets)[asset];
  if (!A) throw new Error(`unknown asset '${asset}'`);
  const [W, D] = size || [(A.envelope.w[0] + A.envelope.w[1]) / 2, (A.envelope.d[0] + A.envelope.d[1]) / 2];
  const out = A.build({ W, D, slot: { asset, rect: { x: 0, y: 0, w: W, d: D }, facing: 'n', exposed: true } }, { palette: K.palette, culture: K, rng: stream(seed, `asset|${asset}`) });
  const parts = Array.isArray(out) ? out : out.boxes;
  return assetBlueprintSvg({ id: asset, read: A.read || '', notes: A.notes || [], W, D, parts });
}
