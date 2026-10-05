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
import { placeAsset, localSize } from './assets/kit.js';
import { CELL, C, LAYER, laneZ, stream, pick, claimGrid, runs, alleyLattice, packLots, lotSlot, placeSlots, skinLoose } from './layout-kit.js';
import { HISTORIC_CULTURES } from './cultures/index.js';
import { LAYOUTS } from './layouts/index.js';
import { solidFaces, scaleSolid } from './assets/solids.js';
import { assetBlueprintSvg } from './assets/blueprint.js';
import { makeLight, litFactor } from '../polygonizer/vexar.js';
import { groundTileFace, groundTileCss, skinFace } from './ground.js';
import { bakeShade, shadeLayer, shadeCss } from './light.js';
import { HISTORIC_STYLES } from './style/index.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';
import { deriveSky } from '../polygonizer/painted-landscape.js';
import { resolveFire, firePageChannel } from '../fire/fire.js';
import { standStatues } from './statues.js';

export { HISTORIC_CULTURES };   // the registry: ./cultures/index.js
export const METRES_PER_UNIT = 3.66;              // the city scenes' unit (a storey ≈ 0.85 u)

/**
 * Plan a historic city. Each culture brings its layout (`culture.layout`, an id in ./layouts/index.js), which reads
 * the culture's card; with none it is Sumer's 'ring-canal' (a walled ring cut by a canal, the precinct at the heart,
 * below). An unknown culture falls back to Sumer (the builders' old behaviour; the `historic` kind refuses one
 * first); an unknown layout id is refused. All share ./layout-kit.js.
 */
export function planHistoricCity(opts = {}) {
  const K = HISTORIC_CULTURES[opts.culture || 'sumer'] || SUMER;
  if (!K.layout || K.layout === 'ring-canal') return planRingCanal(opts);
  const plan = LAYOUTS[K.layout];
  if (!plan) throw new Error(`historic: unknown layout '${K.layout}' — one of 'ring-canal', ${Object.keys(LAYOUTS).map((l) => `'${l}'`).join(', ')}`);
  return plan({ ...opts, culture: opts.culture }, K);
}

/**
 * `countryside: false` leaves the ground outside the ring bare (no fields, no palms there): a region
 * scene (./historic-region.js) dresses it with its own hinterland. The plan's `canal` is the canal's
 * line, so a region can carry it on past the frame.
 */
function planRingCanal({ seed = 1, culture = 'sumer', frame = { w: 380, d: 290 }, assets, countryside = true } = {}) {
  const K = HISTORIC_CULTURES[culture] || SUMER, P = K.palette;
  const g = claimGrid(frame), { cols, rows, grid, at, set } = g;
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
  let pw = Math.round(K.precinct.size[0] / CELL), pd = Math.round(K.precinct.size[1] / CELL);
  const pcStart = Math.round(cx - pw / 2 + (L() - 0.5) * cols * 0.12);
  let pc0 = pcStart, pr0 = Math.max(Math.round(rows * 0.16), Math.round(canalAt(cx) - pd - rows * 0.08));
  // keep clear of the wall (its towers reach into the town) and of the canal: nudge the precinct
  // toward the canal and side to side until its margin holds only open town; a cramped ring gets a
  // precinct a cell smaller each way until one fits
  const clearAt = (c0, r0, m = 2) => {
    for (let r = r0 - m; r < r0 + pd + m; r++) for (let c = c0 - m; c < c0 + pw + m; c++) { const v = at(c, r); if (v === C.WALL || v === C.OUTSIDE || v === -1 || v === C.WATER) return false; }
    return true;
  };
  const r0Start = pr0;
  fit: for (let shrink = 0; shrink < 8; shrink++, pw--, pd--) {
    for (let dr = 0; dr < 24; dr++) for (const dc of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 8, -8, 10, -10]) {
      if (clearAt(pcStart + dc, r0Start + dr)) { pc0 = pcStart + dc; pr0 = r0Start + dr; break fit; }
    }
  }
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
  // placed by clearance, not by fraction: the ziggurat's reach includes its front stair (half its
  // depth again), and each flanking building keeps `PR.clear` metres of open court from it, so no
  // stair runs into another building's
  const zr = { x: precinct.x + (precinct.w - plw) / 2, y: precinct.y + pwT + 4, w: plw, d: pld };
  slots.push({ asset: 'ziggurat', rect: zr, facing: 's', z: 1.2 });
  const [tw0, td0] = PR.temple, flankY = zr.y + pld * 0.55, posts = 1.7;
  slots.push({ asset: 'white-temple', rect: { x: Math.max(precinct.x + pwT + 4, zr.x - PR.clear - posts - tw0), y: flankY, w: tw0, d: td0 }, facing: 'e', z: 1.2 });

  // the block alleys: a loose lattice of narrow lanes, jogging a cell now and then, so no block is
  // more than two houses deep and every house fronts a lane you can walk down (the organic streets
  // above stay the town's bones; these are the paths between the houses)
  if (K.lanes.block) alleyLattice(g, K.lanes.block, seed, laneCells);

  // ── 8. houses: pack the remaining inside cells with lots; each lot is a slot facing its lane ──
  const H = K.house;
  for (const lot of packLots(g, H.size, seed)) slots.push(lotSlot(g, lot, H.gap || 0, (rect) => (Math.min(rect.w, rect.d) >= H.courtyardMin ? 'house-court' : rect.w * rect.d >= 120 ? 'house-tall' : 'house-small')));

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
  slots.push({ asset: 'votive-row', rect: { x: precinct.x + pwT + 6, y: pfront - 9, w: Math.min(26, gx - gapW / 2 - 8 - precinct.x - pwT - 6), d: 2.6 }, facing: 'n', z: PZ });
  // the pillar hall, cone mosaic, in the court's other front corner, facing the axis
  const [hw0, hd0] = PR.hall, hx = zig.x + zig.w + PR.clear;
  slots.push({ asset: 'pillar-hall', rect: { x: hx, y: zig.y + zig.d * 0.55, w: Math.min(hw0, precinct.x + precinct.w - pwT - 4 - hx), d: hd0 }, facing: 'w', z: PZ });

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
  // the bridges: one where each main street crosses the canal, a humped brick bridge whose opening
  // lets the boats through (its rect reaches up both quays for the stairs)
  const sinkZ = -(K.canal.sink || 1.5), bridgeXs = [];
  {
    const seen = new Set();
    for (const key of bridgeCells) {
      if (seen.has(key)) continue;
      const q = [key], cs = []; seen.add(key);
      while (q.length) { const [c, r] = q.pop().split(',').map(Number); cs.push(c); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k2 = `${c + dc},${r + dr}`; if (bridgeCells.has(k2) && !seen.has(k2)) { seen.add(k2); q.push(k2); } } }
      // a street's width, however many streets meet here (two crossings merged would make a tunnel)
      const c0 = Math.min(...cs), c1 = Math.max(...cs), w = Math.min(8, Math.max(6, (c1 - c0 + 1) * CELL - 1.2)), x = ((c0 + c1 + 1) * CELL) / 2 - w / 2, xm = x + w / 2;
      const yN = canalAt(xm / CELL - 0.5) * CELL, yS = yN + cw * CELL, reach = 9;
      slots.push({ asset: 'canal-bridge', rect: { x, y: yN - reach, w, d: yS - yN + 2 * reach }, facing: 'n', span: { y0: reach, y1: reach + yS - yN }, waterZ: sinkZ });
      bridgeXs.push([x - 4, x + w + 4]);
    }
  }
  // boats moored in the canal inside the town, along the quays, clear of the bridges, afloat
  for (let c = 4; c < cols - 6; c += 9 + Math.floor(ST() * 8)) {
    const m = Math.round(canalAt(c)), x = c * CELL;
    if (![0, 1, 2, 3].every((k) => at(c + k, m) === C.WATER) || bridgeXs.some(([a, b]) => x + 10 > a && x < b) || !inside(c, m)) continue;
    const yb = canalAt((x + 5) / CELL - 0.5) * CELL, north = ST() < 0.5, y = north ? yb + 0.7 : yb + cw * CELL - 2.9;
    slots.push({ asset: 'reed-boat', rect: { x, y, w: 10, d: 2.2 }, facing: north ? 'n' : 's', z: sinkZ + 0.05 });
  }

  // ── place: every slot built by the culture's kit, on its own dressing stream ──
  placeSlots(slots, assets || K.assets, K, seed, boxes, grounds, culture);

  // ── 10. ground: base earth, lanes, water, fields and palm groves outside ──
  // the canal, read at street level: a smooth channel sunk below the town, its banks walled in baked
  // brick, one quay strip along each bank (the only surface there: nothing is laid over it). The
  // grid keeps planning in cells; what is drawn follows the canal's own line.
  const sink = K.canal.sink || 1.5, waterZ = -sink, bankN = (x) => canalAt(x / CELL - 0.5) * CELL, bankS = (x) => bankN(x) + cw * CELL;
  const mAt = (c) => Math.round(canalAt(c)), isBank = (c, r) => r === mAt(c) - 1 || r === mAt(c) + cw;
  const quayed = (c, r) => { const v = at(c, r); return v === C.LANE || v === C.OPEN; };
  const earthBase = [];
  for (let c = 0; c < cols; c++) {
    const x0 = c * CELL, x1 = x0 + CELL, m = mAt(c), n0 = bankN(x0), n1 = bankN(x1), s0 = bankS(x0), s1 = bankS(x1);
    const ov = c % 2 ? 0.3 : 0, xa = x0 - ov, xb = x1 + ov, na = bankN(xa), nb = bankN(xb);   // odd columns overlap their neighbours a hair (a seam in the page otherwise; all of them would stack in the World)
    grounds.push({ kind: 'water', poly: [[xa, na], [xb, nb], [xb, nb + cw * CELL], [xa, na + cw * CELL]], z: waterZ + (c % 2 ? LAYER : 0), fill: P.water });
    // the revetments, battered a little, from the quay edge down below the water
    const lean = 0.25, foot = waterZ - 0.2;
    const ra = x0 - 0.12, rb = x1 + 0.12, rn0 = bankN(ra), rn1 = bankN(rb), rs0 = bankS(ra), rs1 = bankS(rb);   // panels overlap a hair
    boxes.push({ kind: 'revetment', solid: 'panel', pts: [[ra, rn0, 0], [rb, rn1, 0], [rb, rn1 + lean, foot], [ra, rn0 + lean, foot]], out: [0, 1, 0], x: x0, y: Math.min(n0, n1), w: CELL, d: lean, z0: foot, z1: 0, tint: scaleHex(P.paving, 0.82) });
    boxes.push({ kind: 'revetment', solid: 'panel', pts: [[ra, rs0, 0], [rb, rs1, 0], [rb, rs1 - lean, foot], [ra, rs0 - lean, foot]], out: [0, -1, 0], x: x0, y: Math.min(s0, s1) - lean, w: CELL, d: lean, z0: foot, z1: 0, tint: scaleHex(P.paving, 0.82) });
    // the bank strips: from the grid line to the smooth bank, a rect and the sliver the meander leaves
    for (const [r, edge, lo] of [[m - 1, [n0, n1], true], [m + cw, [s0, s1], false]]) {
      const [surface, fill] = quayed(c, r) ? ['brick', P.paving] : ['dry-earth', P.ground];
      const gy = lo ? r * CELL : (r + 1) * CELL, inner = lo ? Math.min(...edge) : Math.max(...edge);
      grounds.push({ kind: 'quay', x: x0 - (c % 2 ? 0.15 : 0), y: Math.min(gy, inner), w: CELL + (c % 2 ? 0.3 : 0), d: Math.abs(inner - gy), z: 0.02 + (c % 2 ? LAYER : 0), fill, surface });
      if (Math.abs(edge[0] - edge[1]) > 1e-6) {
        const tip = (lo ? edge[0] > edge[1] : edge[0] < edge[1]) ? [x0, edge[0]] : [x1, edge[1]];
        grounds.push({ kind: 'quay-edge', poly: [[x0, inner], [x1, inner], tip], z: 0.02, fill });
      }
    }
    earthBase.push([c, m]);
  }
  // the base earth, north and south of the canal band, in runs of columns sharing a canal row
  for (let i = 0; i < earthBase.length;) {
    let j = i; while (j < earthBase.length && earthBase[j][1] === earthBase[i][1]) j++;
    const x = earthBase[i][0] * CELL, w = (j - i) * CELL, m = earthBase[i][1];
    grounds.unshift({ kind: 'ground', x, y: 0, w, d: (m - 1) * CELL, z: 0.01, fill: P.ground, surface: 'dry-earth' });
    grounds.unshift({ kind: 'ground', x, y: (m + cw + 1) * CELL, w, d: (rows - m - cw - 1) * CELL, z: 0.01, fill: P.ground, surface: 'dry-earth' });
    i = j;
  }
  const laneSurface = { [S.MUD]: ['mud', P.lane], [S.RUBBLE]: ['rubble', P.street], [S.BRICK]: ['brick', P.paving] };
  for (const sv of [S.MUD, S.RUBBLE, S.BRICK]) {
    const [surface, fill] = laneSurface[sv];
    runs(grid, cols, rows, (v, c, r) => (v === C.LANE || v === C.OPEN) && surf[r * cols + c] === sv && !isBank(c, r), (c, r, n) => grounds.push({ kind: 'lane', x: c * CELL, y: r * CELL - (r % 2 ? 0.08 : 0), w: n * CELL + 0.15, d: CELL + (r % 2 ? 0.16 : 0), z: laneZ(sv, r), fill, surface }));   // a hair of overlap closes the seams — on odd rows only, or the World's de-overlap stacks the rows into a slope
  }

  const G = stream(seed, 'groves');
  let palms = 0;
  for (let r = 0; r < rows; r += 4) for (let c = 0; c < cols; c += 4) {
    if (!countryside || at(c, r) !== C.OUTSIDE) continue;
    const nearWater = Math.abs(r - canalAt(c)) < 14;
    const u = G();
    const crossesCanal = [0, 1, 2, 3].some((k) => r + 4 > mAt(c + k) - 2 && r < mAt(c + k) + cw + 2);
    if (u < 0.35 && !crossesCanal) grounds.push({ kind: 'field', x: c * CELL, y: r * CELL, w: 4 * CELL, d: 4 * CELL, z: 0.02, fill: pick(P.field, G) });
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
  // the lane cell (a main street's rubble first) nearest a point, south of a line
  const nearestLane = (x, y, south) => {
    let best = null, bd = Infinity;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (at(c, r) !== C.LANE || r * CELL < south) continue;
      const d = Math.hypot(c * CELL + CELL / 2 - x, r * CELL + CELL / 2 - y) - (surf[r * cols + c] === S.RUBBLE ? 20 : 0);
      if (d < bd) { bd = d; best = [c * CELL + CELL / 2, r * CELL + CELL / 2]; }
    }
    return best || [x, y];
  };
  const southern = mainPaths.filter((pth) => pth.length && pth[0][1] * CELL > pg[1] + 30).sort((a, b) => b.length - a.length)[0] || mainPaths.find((pth) => pth.length) || [[precinctGate[0], precinctGate[1] + 20]];
  const half = (K.lanes.main * CELL) / 2;
  const standAt = southern.map(([c, r]) => [c * CELL + half, r * CELL + half])
    // south of the canal (the street climbs to the bridge and on to the precinct), some 75 m out
    .filter(([x, y]) => y > canalAt(x / CELL - 0.5) * CELL + cw * CELL + 10 && at(Math.floor(x / CELL), Math.floor(y / CELL)) === C.LANE)
    .sort((a, b) => Math.abs(Math.hypot(a[0] - pg[0], a[1] - pg[1]) - 75) - Math.abs(Math.hypot(b[0] - pg[0], b[1] - pg[1]) - 75))[0] || nearestLane(pg[0], pg[1] + 75, pg[1] + 25);
  const midBridge = slots.filter((q) => q.asset === 'canal-bridge').sort((a, b) => Math.abs(a.rect.x - cols * CELL / 2) - Math.abs(b.rect.x - cols * CELL / 2))[0];
  const views = {
    street: { eye: [standAt[0], standAt[1], 1.7], at: [pg[0], precinct.y + precinct.d * 0.35, 9] },
    // just inside the precinct gate, off the sacred axis so the altar does not fill the eye: the altar, the vases and
    // the copper bulls at the stair foot, the stair climbing to the shrine
    precinct: { eye: [pg[0] + 5.2, precinct.y + precinct.d - pwT - 0.6, 1.35 + 1.9], at: [pg[0] - 2, precinct.y + precinct.d * 0.4, 8] },   // between the gate jamb and the stele
    // from a boat on the canal, some way west of the bridge nearest the town's middle, looking along
    // the water into its arch (the way the boats go)
    ...(midBridge ? { canal: { eye: [midBridge.rect.x - 30, canalAt((midBridge.rect.x - 30) / CELL - 0.5) * CELL + cw * CELL / 2, -(K.canal.sink || 1.5) + 1.9], at: [midBridge.rect.x, canalAt(midBridge.rect.x / CELL - 0.5) * CELL + cw * CELL / 2, 0.6] } } : {}),
  };

  skinLoose(boxes, K);   // the precinct's own masses
  return {
    boxes, grounds, views, frame: { w: cols * CELL, d: rows * CELL },
    slots,
    stats: {
      culture, houses: slots.filter((q) => q.asset.startsWith('house')).length, courtyards: slots.filter((q) => q.asset === 'house-court').length,
      towers: slots.filter((q) => q.asset === 'wall-tower').length, reedHouses: slots.filter((q) => q.asset === 'reed-house').length, gates: gates.length, palms, precinct, laneCells: grid.reduce((n, v) => n + (v === C.LANE ? 1 : 0), 0),
    },
    grid: { cols, rows, cell: CELL, data: grid, codes: C },
    // the canal's north bank y(x) = row0·cell + amp·cell·sin((x/cell − ½)/cols · 2π · 0.8 + ph), metres; its width
    canal: { row0: cy0, amp: camp, ph: cph, cols, cell: CELL, width: cw * CELL, sink: K.canal.sink || 1.5 },
  };
}

/** The town canal's north bank as a function of x (metres, the town's frame), continued past the frame. */
export function canalBankN(canal) {
  const { row0, amp, ph, cols, cell } = canal;
  return (x) => (row0 + amp * Math.sin(((x / cell - 0.5) / cols) * 6.283 * 0.8 + ph)) * cell;
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
export const SCENE_LIGHT = makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
// px per scene unit. A panel rasterises at its own px size and an eye-level camera magnifies the near
// ground many times, so at the box city's 22 the paving smears to a blur — the eye-level views raster
// at 48. From the air every panel is on screen at once and the box city's 22 is plenty. Lindos' views across the
// water (`sea`, `bay`) look at the rock from afar: 22, or the page drops faces under the load.
const UNIT_SCALE = { aerial: 22, approach: 22, street: 48, precinct: 48, canal: 48, avenue: 48, temple: 48, river: 48, valley: 48, pyramid: 48, cemetery: 48, town: 48, harbour: 48, works: 48, summit: 48, climb: 48, stoa: 48, sea: 22, bay: 22, theatre: 48, palace: 48, gate: 48, ward: 48, market: 48, bridge: 48, bluff: 48, forum: 48, faun: 48, castor: 48, sacra: 48, rostra: 48, capitol: 48, lacus: 48, julius: 48, basilica: 48, aisle: 48, cella: 48 };

/**
 * Metre grounds → scene faces, kept in their stacking order (base earth, then fields, water, lanes,
 * courts): the ground layers sit millimetres apart, so it is draw order that keeps the canal above the
 * earth. A surfaced ground (mud, rubble, brick, dry earth) is a tiled face; the rest flat colour.
 * `shade` (a ./light.js bake): its map is laid over every ground face, at the face's place in it.
 */
export function groundsToScene(grounds, s, us, textured = true, shade = null, world = false) {
  const faces = [];
  // the shade layer goes over a face whose local axes run +x and +y (a ground rect; a near-square poly)
  const shaded = (f, x, y) => (shade ? { ...f, shade: shade.key, bg: `${shadeLayer(shade, x, y, s, us)}, ${f.bg || f.fill}` } : f);
  for (const g of grounds) {
    const o = { ...g, x: g.x * s, y: g.y * s, w: g.w * s, d: g.d * s, z: g.z * s }, lit = scaleHex(g.fill, litFactor([0, 0, 1], SCENE_LIGHT));
    if (g.poly) {
      const f = { corners: g.poly.map(([x, y]) => [x * s, y * s, g.z * s]), fill: lit, doubleSided: true }, [a, b, , c] = g.poly;
      const square = g.poly.length === 4 && b[0] - a[0] > 0 && Math.abs(b[1] - a[1]) < 0.1 * (b[0] - a[0]) && c[1] - a[1] > 0 && Math.abs(c[0] - a[0]) < 0.1 * (c[1] - a[1]);
      faces.push(square ? shaded(f, a[0], a[1]) : f);
      continue;
    }
    if (g.surface && textured) faces.push(shaded(groundTileFace(o, g.surface, g.fill, lit, { us, mpu: METRES_PER_UNIT }), g.x, g.y));
    // water with a look (`liquid`), for the World page: its water shader and the opacity at each corner
    else if (world && g.liquid) {
      // one sheet: each piece at its exact rect and one level (overlaps would darken twice through translucent water)
      const q = g.sheet ? { x: g.sheet.x * s, y: g.sheet.y * s, w: g.sheet.w * s, d: g.sheet.d * s, z: g.sheet.z * s } : o;
      faces.push({ corners: [[q.x, q.y, q.z], [q.x + q.w, q.y, q.z], [q.x + q.w, q.y + q.d, q.z], [q.x, q.y + q.d, q.z]], fill: (g.sheet && g.sheet.fill) || g.fill, water: true, liquid: g.liquid, ...(g.cornerAlpha ? { cornerAlpha: g.cornerAlpha } : {}), doubleSided: true });
    }
    else faces.push(shaded({ corners: [[o.x, o.y, o.z], [o.x + o.w, o.y, o.z], [o.x + o.w, o.y + o.d, o.z], [o.x, o.y + o.d, o.z]], fill: lit, doubleSided: true }, g.x, g.y));
  }
  return { grounds: [], faces };
}
/** Emit a historic scene: the box city's page, with the ground tiles defined once at the top. */
function emitHistoric(scene) {
  const css = groundTileCss(scene.faces) + shadeCss(scene.faces);
  const html = emitPreserve3dScene(scene);
  return css ? html.replace('<style>\n', `<style>\n${css}`) : html;
}

/**
 * Metre masses → scene units: plain boxes for the box emitter, angled solids as their own faces.
 * `focus` (metres): what directed skins face — a temple's sanctuary.
 */
export function toScene(masses, s, us = UNIT_SCALE.aerial, focus) {
  const boxes = [], faces = [];
  for (const b of masses) {
    const tile = { us, mpu: METRES_PER_UNIT, toward: focus && [focus[0] * s, focus[1] * s] };
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

/**
 * The culture's style card dresses the scene's light: its sun baked into a shade map over the ground
 * (./light.js) and its sky behind the town. `shade: false` (or a culture without a card) leaves both off.
 */
export function historicLight(plan, opts = {}) {
  const style = HISTORIC_STYLES[plan.stats.culture];
  if (!style || opts.shade === false) return { style: null, shade: null, sky: undefined };
  // a card that says `light.terrain` stands the land in the bake too (its cliffs cast onto the sea)
  const terrain = style.light.terrain && plan.hAt ? plan.hAt : undefined;
  return { style, shade: bakeShade({ frame: plan.frame, masses: plan.boxes, grounds: plan.grounds, terrain }, SCENE_LIGHT, style.light), sky: style.sky };
}

export function assembleHistoricCityScene(opts = {}) {
  let plan = planHistoricCity(opts);
  // STATUES (historic/statues.js, the World's alone): the stand-ins on the named slots come down, and a record per
  // figure says where a stored statue stands instead — the World resolver fits its faces there. Absent ⇒ untouched.
  const stood = opts.world && opts.statues?.length ? standStatues(plan, opts.statues, { culture: plan.stats?.culture }) : null;
  if (stood) plan = { ...plan, boxes: stood.boxes };
  const view = opts.view === 'approach' || (opts.view && plan.views[opts.view]) ? opts.view : 'aerial';
  // px per scene unit for the view: the table's, or eye level for a view it does not name (a new culture's own views)
  const US = UNIT_SCALE[view] ?? 48;
  const s = 1 / METRES_PER_UNIT, world = !!opts.world;
  // `world`: built for the WebGL World page, which also draws what the plan keeps for it alone (a seabed)
  // a World with live fire (`fire`) burns its flames itself: the painted flame cards stand down there
  const live = world && Array.isArray(plan.fireSources) && plan.fireSources.length > 0;
  const masses = live ? plan.boxes.filter((m) => m.kind !== 'flame') : plan.boxes;
  // repeated parts (a plan's `repeats`): the World draws each template once as instances; the CSS page their light stand-ins
  const reps = plan.repeats || [];
  const lows = world ? [] : reps.filter((r) => !r.world).flatMap((r) => r.transforms.flatMap((t) => r.low.map((m) => liftMass(m, t.pos))));
  const { boxes, faces } = toScene(world && plan.world ? [...masses, ...lows, ...plan.world.boxes] : [...masses, ...lows], s, US, plan.focus);
  const { shade, sky } = historicLight(plan, opts);
  const G = groundsToScene(plan.grounds, s, US, true, shade, world), grounds = G.grounds;
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
  const scene = assembleBoxCityScene({ boxes, grounds, faces, cameras, title: `mojulo historic city · ${(HISTORIC_CULTURES[plan.stats.culture] || SUMER).label}`, bg: '#d9cdb4', sky, light: SCENE_LIGHT, unitScale: US });
  // the fires stay in metres: the World's fire channel burns them so and scales them into the scene's units
  const fireSources = live ? plan.fireSources : null;
  // the World's crop (`plan.world.skirt`): kept with the plan's heights until the sky's horizon colour is known
  const skirt = world && plan.world && plan.world.skirt && plan.hAt ? { ...plan.world.skirt, hAt: plan.hAt, frame: plan.frame } : null;
  const repeats = world && reps.length ? reps.map((r) => {
    const T = toScene(r.template, s, US);
    if (T.boxes.length) throw new Error(`repeat '${r.key}': a template is built of solids only`);
    return { group: r.key, template: T.faces, transforms: r.transforms.map((t) => ({ pos: t.pos.map((v) => v * s) })) };
  }) : null;
  // the statue records in metres, with the unit and the sun their faces bake under (worlds/world-scene.js resolves them)
  const statueRefs = stood?.statueRefs.length ? { unit: METRES_PER_UNIT, light: SCENE_LIGHT, list: stood.statueRefs } : null;
  return { ...scene, stats: plan.stats, ...(shade ? { shade } : {}), ...(fireSources ? { fireSources } : {}), ...(skirt ? { skirt } : {}), ...(repeats ? { repeats } : {}), ...(statueRefs ? { statueRefs } : {}) };
}
/** A mass moved by `[dx, dy, dz]` (an instance's stand-in put in place). */
function liftMass(m, [dx, dy, dz]) {
  const o = { ...m, x: m.x + dx, y: m.y + dy, z0: m.z0 + dz, z1: m.z1 + dz };
  if (m.top) o.top = { ...m.top, x: m.top.x + dx, y: m.top.y + dy };
  if (m.pts) o.pts = m.pts.map(([x, y, z]) => [x + dx, y + dy, z + dz]);
  for (const k of ['a', 'b']) if (Array.isArray(m[k])) o[k] = [m[k][0] + dx, m[k][1] + dy, m[k][2] + dz];
  return o;
}

/**
 * A historic city for the WebGL World page (scene/scene-three.js `emitThreeWorld`): the same scene, with the
 * World's own needs met — the ground tiles and wall skins resolved into its texture map, the style card's sky as
 * the World's zenith/horizon dome (the water reflects it), the sea under its water look where the culture gives
 * one, and what the plan keeps for the World alone (a seabed under clear shallows). The World ignores the CSS
 * shade map: its light is its own. Opens on `view` like the page.
 */
export function assembleHistoricWorld(opts = {}) {
  // the CSS shade map is the page's: the World never reads it, so it is not baked here
  const { fireSources, skirt, ...scene } = assembleHistoricCityScene({ ...opts, world: true, shade: false });
  const style = HISTORIC_STYLES[scene.stats.culture];
  const card = style && style.sky && style.sky.palette ? deriveSky(style.sky.palette, { x: 0, y: 0, z: style.sky.sunElev }) : null;
  if (skirt) scene.faces.push(...skirtFaces(skirt, 1 / METRES_PER_UNIT, card ? card.horizon : [208, 217, 218]));
  // `fire`: the hearths and kilns burn live (fire/fire.js), lighting the town by day as their own glow
  const lit = fireSources ? resolveFire(true, fireSources, { explicit: false }) : null;
  // a repeat's template wears its skins too: its textures are collected with the page's own
  return { ...scene, textures: collectFaceTextures(scene.repeats ? [...scene.faces, ...scene.repeats.flatMap((r) => r.template)] : scene.faces, { ...(scene.textures || {}) }), ...(card ? { sky: { zenith: card.zenith.map(Math.round), horizon: card.horizon.map(Math.round), day: 1, stars: 0, seed: 1 } } : {}),
    ...(lit ? { fire: firePageChannel(lit, { day: card ? 1 : 0, unit: METRES_PER_UNIT }) } : {}) };
}
/**
 * The World's crop: the land just past the frame, `width` m of it in `cell` squares, its heights the frame edge's
 * carried straight out (a bluff or a river runs on), each corner's colour fading from the ground's (or the water's,
 * below `waterZ`) to the sky's horizon by its distance from the frame. Past it the picture is sky and haze, so the
 * town stays the focus however the World is turned. Metres in, scene units out.
 */
function skirtFaces({ width, cell, waterZ = -Infinity, fill, water, hAt, frame }, s, horizon) {
  const lit = litFactor([0, 0, 1], SCENE_LIGHT), base = [scaleHex(fill, lit), scaleHex(water || fill, lit)].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const hex = (c) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
  const clamp = (v, hi) => Math.min(hi - 0.01, Math.max(0.01, v)), out = [];
  const corner = (x, y) => {
    const z = hAt(clamp(x, frame.w), clamp(y, frame.d)), wet = z < waterZ, d = Math.hypot(Math.max(0, -x, x - frame.w), Math.max(0, -y, y - frame.d));
    const t = Math.min(1, d / width) ** 0.7, c = base[wet ? 1 : 0];
    return { p: [x * s, y * s, (wet ? waterZ : z) * s], fill: hex(c.map((v, i) => v + (horizon[i] - v) * t)), far: d >= width };
  };
  for (let y = -width; y < frame.d + width; y += cell) for (let x = -width; x < frame.w + width; x += cell) {
    if (x >= 0 && y >= 0 && x + cell <= frame.w && y + cell <= frame.d) continue;   // the frame draws its own ground
    const c = [corner(x, y), corner(x + cell, y), corner(x + cell, y + cell), corner(x, y + cell)];
    if (c.every((q) => q.far)) continue;
    out.push({ corners: c.map((q) => q.p), fill: c[0].fill, cornerFills: c.map((q) => q.fill), doubleSided: true });
  }
  return out;
}
/** A historic city → the World page HTML (self-contained unless `cdn`). */
export function renderHistoricCityToWorld(opts = {}) {
  const { cdn = false, walk = false, ...rest } = opts;
  return emitThreeWorld({ ...assembleHistoricWorld(rest), inline: !cdn, cdn, walk, hud: false });
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
export function assembleAssetSheetScene({ asset, culture = 'sumer', size, seed = 1, kit, palette } = {}) {
  const K = HISTORIC_CULTURES[culture] || SUMER;
  const A = kit[asset];
  if (!A) throw new Error(`unknown asset '${asset}'`);
  const [w, d] = size || [(A.envelope.w[0] + A.envelope.w[1]) / 2, (A.envelope.d[0] + A.envelope.d[1]) / 2];
  const pad = Math.max(w, d) * 0.45, tile = { x: 0, y: 0, w: w + 2 * pad, d: d + 2 * pad };
  const slot = { asset, rect: { x: pad, y: pad, w, d }, facing: 's', exposed: true };   // front toward +y, where the camera stands
  const placed = placeAsset(A, slot, { palette: palette || K.palette, culture: K, rng: stream(seed, `asset|${asset}`) });
  const s = 1 / METRES_PER_UNIT;
  // small pieces (a stele, a vase) get more pixels per unit, or their facets are a pixel wide
  const us = Math.round(Math.min(150, Math.max(UNIT_SCALE.aerial, UNIT_SCALE.aerial * (50 / Math.max(tile.w, tile.d)))));
  const { boxes, faces } = toScene(placed.boxes, s, us);
  // a sunk asset (a pit) shows through a hole in the sheet's ground
  const r = slot.rect, base = A.sunk
    ? [{ ...tile, d: r.y }, { ...tile, y: r.y + r.d, d: tile.d - r.y - r.d }, { ...tile, y: r.y, w: r.x, d: r.d }, { ...tile, x: r.x + r.w, y: r.y, w: tile.w - r.x - r.w, d: r.d }]
    : [tile];
  const G = groundsToScene([...base.map((t) => ({ kind: 'ground', ...t, z: 0.01, fill: K.palette.ground })), ...placed.grounds], s, us), grounds = G.grounds;
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
export function assetBlueprint({ asset, culture = 'sumer', size, seed = 1, kit, palette } = {}) {
  const K = HISTORIC_CULTURES[culture] || SUMER, A = (kit || K.assets)[asset];
  if (!A) throw new Error(`unknown asset '${asset}'`);
  const [W, D] = size || [(A.envelope.w[0] + A.envelope.w[1]) / 2, (A.envelope.d[0] + A.envelope.d[1]) / 2];
  const out = A.build({ W, D, slot: { asset, rect: { x: 0, y: 0, w: W, d: D }, facing: 'n', exposed: true } }, { palette: palette || K.palette, culture: K, rng: stream(seed, `asset|${asset}`) });
  const parts = Array.isArray(out) ? out : out.boxes;
  return assetBlueprintSvg({ id: asset, read: A.read || '', notes: A.notes || [], W, D, parts });
}
