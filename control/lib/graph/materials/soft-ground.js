// A 2.5D soft-ground bed (sand, snow, mud): footprints and pushing. Import-free closure, so a page can inline
// buildSandBed.toString() and run the same rules Node verifies (the terrainKernel / buildBus pattern). Born as the
// sand-bed spike (scripts/spikes/sand-bed, which now re-exports this file); the beach's touch tier runs it in a window
// around the player.
//
// Representation: integer depth per grid point, in quanta of `quantum` metres, over a base (hard ground) height
// quantised to the same unit. Two layers: loose material (`sand`) and packed material (`packed`), with
// top = base + loose + packed. A packed quantum holds `compaction` loose quanta of mass, so
// mass = loose + compaction · packed, and integer transfers keep it exact.
//   compaction  r  1 for sand and mud (displaced, not compressed); about 3 for fresh snow (powder → packed). A press
//                  crushes r loose quanta into 1 packed quantum, lowering the column by r − 1. Packed material bears
//                  load and never flows, so a boot in an old print barely sinks.
//   spill          for compressible ground, the fraction of the cut pushed out to the rim before compaction.
//   viscosity  v   a flowing column sheds v · half its worst excess per tick: 1 for granular sand (meets halfway at
//                  once), small for mud, whose over-steep walls ooze down over seconds.
//
// Relaxation is the grain kernel's friction pair, over 8 neighbours with distance-weighted thresholds:
//   staticFriction μs  a resting column starts to flow only when its drop to some neighbour exceeds μs · distance;
//   friction       μ   a flowing column keeps shedding while any drop exceeds μ · distance, then sleeps.
//   cohesion       c   Mohr–Coulomb: shear strength is c + σ·tanφ, so a cohesive wall stands to a critical height
//                      whatever its angle. A column starts to flow only when its drop exceeds μs · distance + c; once it
//                      has failed, cohesion is broken and it flows down to μ alone.
// Prints persist because their walls sit under that yield; a wall over it avalanches down toward atan(μ). Dry sand has
// μs close to μ and no cohesion; damp sand, snow and mud stand steeper walls through cohesion.
// Sleep is sound: a column's rule reads its own top and its 8 neighbours', so a change at c wakes exactly the 3×3 of c.
//
// MOISTURE (optional, per cell): `moisture: { dry, damp, fluid }`, each { friction, staticFriction, cohesion }, makes the
// friction rule read each column's own wetness w (0..255, `setMoisture`): w ramps dry → damp over 0..WET_DAMP and damp →
// fluid above it. Damp sand stands its prints (capillary cohesion); fluid is sand under running water — no cohesion and
// μs ≈ μ, so prints in the backwash relax away. Wetness is quantised to 16 levels with a threshold table per level, so
// the rule stays integer; a column whose level changes is re-tested (its 3×3 woken), which keeps sleep sound. Without
// `moisture` the bed is exactly the single-ground kernel (the tuned friction applies everywhere).
//
// RELIEF (optional): `relief: true` measures every slope on the material alone, as if the hard ground were flat — the
// base is then the rest shape (a sloped beach face), and only what feet and plows do to the skin relaxes. Without it a
// weak ground (backwash slurry) would slide down any base steeper than its friction.
//
// SHIFT: `shift(dc, dr, baseAt)` slides the window by whole cells (a bed that follows a walker): columns keep their state
// and move; columns entering at the far edge are fresh ground at `depth` over `baseAt(x, y)`, dry.
export const WET_DAMP = 187;   // = 11 · 17: level 11 is exactly the damp preset (levels sit at w = 17·l, 0 dry … 255 fluid)
export function buildSandBed({
  cols = 400, rows = 400, cell = 0.025, quantum = 0.001, origin = [0, 0],
  base = null, depth = 0.3, friction = 0.6, staticFriction = 0.75, cohesion = 0, compaction = 1, spill = 1, viscosity = 1,
  moisture = null, relief = false,
} = {}) {
  if (![cols, rows].every(n => Number.isInteger(n) && n >= 3 && n <= 2048)) throw Error('cols/rows must be integers in [3,2048]');
  if (!(cell > 0 && quantum > 0 && quantum <= cell)) throw Error('cell and quantum must be positive, quantum ≤ cell');
  if (!Number.isInteger(compaction) || compaction < 1 || compaction > 8 || !(spill >= 0 && spill <= 1)) {
    throw Error('compaction an integer in [1,8]; spill in [0,1]');
  }
  const R = compaction, SPILL = Math.round(spill * 256);
  const N = cols * rows;
  if (base && base.length !== N) throw Error('base must have cols·rows samples');
  // baseU drives the friction rules; baseF is the exact hard ground for heights and rendering, so a smooth swell
  // does not read as 1-quantum terraces under grazing light.
  let baseU = new Int32Array(N), baseF = new Float64Array(N), sand = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const b = base ? base[i] : 0, d = typeof depth === 'number' ? depth : depth[i];
    if (!Number.isFinite(b) || !(d >= 0)) throw Error('finite base and nonnegative depth required');
    baseF[i] = b; baseU[i] = Math.round(b / quantum); sand[i] = Math.round(d / quantum);
  }
  let packed = new Int32Array(N), flowing = new Uint8Array(N), queued = new Uint32Array(N);
  let disturbed = new Uint8Array(N);   // render hint only: 255 when a column last changed by a foot or plow
  let wet = new Uint8Array(N);           // per-column wetness (only read with `moisture`)
  const D0 = typeof depth === 'number' ? Math.round(depth / quantum) : 0;
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const DIST = NB.map(([a, b]) => (a && b ? Math.SQRT2 : 1) * cell);
  const TS = new Int32Array(8), TD = new Int32Array(8);
  let active = [], tick = 0, mu = 0, mus = 0, coh = 0, VISC = 256;
  let dirty = null;
  function tune({ friction: f = mu, staticFriction: s = mus, cohesion: k = coh, viscosity: v = VISC / 256 } = {}) {
    if (!(f >= 0.1 && f <= 1.5) || !(s >= f && s <= 3)) throw Error('friction in [0.1,1.5]; staticFriction in [friction,3]');
    if (!(v >= 0.01 && v <= 1) || !(k >= 0 && k <= 1)) throw Error('viscosity in [0.01,1]; cohesion in [0,1] metres');
    mu = f; mus = s; coh = k; VISC = Math.round(v * 256);
    for (let n = 0; n < 8; n++) { TS[n] = Math.floor((mus * DIST[n] + coh) / quantum); TD[n] = Math.floor(mu * DIST[n] / quantum); }
    if (MOIST) buildLevels();
    for (let i = 0; i < N; i++) if (sand[i]) enqueue(i);   // every wall re-tests the new friction
  }
  // per-level thresholds: level l (w >> 4) lerps dry → damp → fluid
  const MOIST = moisture && moisture.dry && moisture.damp && moisture.fluid ? moisture : null;
  const TSM = MOIST ? new Int32Array(128) : null, TDM = MOIST ? new Int32Array(128) : null;
  function buildLevels() {
    const lerp = (a, b, t) => ({ f: a.friction + (b.friction - a.friction) * t, s: a.staticFriction + (b.staticFriction - a.staticFriction) * t, c: (a.cohesion || 0) + ((b.cohesion || 0) - (a.cohesion || 0)) * t });
    for (let l = 0; l < 16; l++) {
      const w = l * 17, g = w <= WET_DAMP ? lerp(MOIST.dry, MOIST.damp, w / WET_DAMP) : lerp(MOIST.damp, MOIST.fluid, (w - WET_DAMP) / (255 - WET_DAMP));
      for (let n = 0; n < 8; n++) { TSM[l * 8 + n] = Math.floor((g.s * DIST[n] + g.c) / quantum); TDM[l * 8 + n] = Math.floor(g.f * DIST[n] / quantum); }
    }
  }
  function setMoisture(i, w) {
    const v = w < 0 ? 0 : w > 255 ? 255 : w | 0;
    if ((wet[i] >> 4) !== (v >> 4)) { wet[i] = v; if (sand[i]) wake(i); } else wet[i] = v;
  }
  function enqueue(i) { if (queued[i] !== tick + 1) { queued[i] = tick + 1; active.push(i); } }
  function touch(i) {
    const c = i % cols, r = (i - c) / cols;
    if (!dirty) dirty = [c, r, c, r];
    else { if (c < dirty[0]) dirty[0] = c; if (r < dirty[1]) dirty[1] = r; if (c > dirty[2]) dirty[2] = c; if (r > dirty[3]) dirty[3] = r; }
  }
  function wake(i) {
    const c = i % cols, r = (i - c) / cols;
    for (let y = Math.max(0, r - 1); y <= Math.min(rows - 1, r + 1); y++) {
      for (let x = Math.max(0, c - 1); x <= Math.min(cols - 1, c + 1); x++) enqueue(y * cols + x);
    }
  }
  function change(i, delta, mark) {
    sand[i] += delta; touch(i); wake(i);
    if (mark) disturbed[i] = 255;
  }
  function pack(i, loose, solid) {         // set both layers of a column at once (press, plow)
    sand[i] = loose; packed[i] = solid; disturbed[i] = 255; touch(i); wake(i);
  }
  const drops = new Int32Array(8), recv = new Int32Array(8);
  function step() {
    tick++;
    if (!active.length) return { tick, checked: 0, moved: 0, active: 0 };
    const order = Int32Array.from(active).sort();
    active = [];
    let checked = 0, moved = 0;
    for (let k = 0; k < order.length; k++) {
      const i = order[tick % 2 ? k : order.length - 1 - k];
      if (!sand[i]) { flowing[i] = 0; continue; }
      checked++;
      const c = i % cols, r = (i - c) / cols, top = (relief ? 0 : baseU[i]) + sand[i] + packed[i];
      const ts = MOIST ? TSM.subarray((wet[i] >> 4) * 8) : TS, td = MOIST ? TDM.subarray((wet[i] >> 4) * 8) : TD;
      let over = false;
      for (let n = 0; n < 8; n++) {
        const x = c + NB[n][0], y = r + NB[n][1];
        if (x < 0 || y < 0 || x >= cols || y >= rows) { drops[n] = -1; recv[n] = -1; continue; }   // closed edge
        const j = y * cols + x;
        recv[n] = j; drops[n] = top - (relief ? 0 : baseU[j]) - sand[j] - packed[j];
        if (drops[n] > ts[n]) over = true;
      }
      if (!flowing[i] && !over) continue;                     // static friction holds: asleep
      let sum = 0, max = 0, best = -1;
      for (let n = 0; n < 8; n++) {
        const e = recv[n] < 0 ? 0 : drops[n] - td[n];
        drops[n] = e > 0 ? e : 0; sum += drops[n];
        if (drops[n] > max) { max = drops[n]; best = n; }
      }
      if (!sum) { flowing[i] = 0; continue; }                 // under the sliding angle everywhere: comes to rest
      flowing[i] = 1;
      // Shed half the worst excess (two columns meet halfway) times viscosity, shared by excess; the remainder goes to
      // the steepest. Only loose material moves.
      const T = Math.min(sand[i], Math.max(1, (max * VISC) >> 9));
      let given = 0;
      for (let n = 0; n < 8; n++) {
        if (!drops[n]) continue;
        const a = Math.floor(T * drops[n] / sum);
        if (a) { change(recv[n], a, false); given += a; }
      }
      if (T - given) change(recv[best], T - given, false);
      change(i, -T, false);
      moved += T;
    }
    return { tick, checked, moved, active: active.length };
  }
  const colOf = x => (x - origin[0]) / cell, rowOf = y => (y - origin[1]) / cell;
  // Visit grid points inside a shape given in a local frame (u forward along heading, v to the left).
  function visit(x, y, heading, reach, fn) {
    const cs = Math.cos(heading), sn = Math.sin(heading);
    const c0 = Math.max(0, Math.floor(colOf(x - reach))), c1 = Math.min(cols - 1, Math.ceil(colOf(x + reach)));
    const r0 = Math.max(0, Math.floor(rowOf(y - reach))), r1 = Math.min(rows - 1, Math.ceil(rowOf(y + reach)));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const px = origin[0] + c * cell - x, py = origin[1] + r * cell - y;
      fn(r * cols + c, px * cs + py * sn, -px * sn + py * cs, px, py);
    }
  }
  // Split `amount` over weighted targets exactly (floor shares; remainder to the heaviest, first on ties).
  function deposit(targets, weights, amount, mark) {
    let sum = 0, best = 0;
    for (let k = 0; k < weights.length; k++) { sum += weights[k]; if (weights[k] > weights[best]) best = k; }
    if (!targets.length || !amount) return 0;
    let given = 0;
    for (let k = 0; k < targets.length; k++) {
      const a = Math.floor(amount * weights[k] / sum);
      if (a) { change(targets[k], a, mark); given += a; }
    }
    if (amount - given) change(targets[best], amount - given, mark);
    return amount;
  }
  // A foot plant. The sole (heel disc + forefoot ellipse) is a plate lowered to the mean surface under it minus `sink`,
  // heel deeper than toe. Incompressible ground (r = 1) sends everything above the plate to a rim band around the
  // print, weighted toward `push` (travel direction × strength): a dent with a raised, lopsided lip. Compressible
  // ground spills `spill` of the cut to the rim, crushes loose to packed under the sole for the rest, and spills only
  // what it could not compact; a sole that reaches packed material stops there.
  function press({ x, y, heading = 0, length = 0.26, width = 0.1, sink = 0.02, rim = 0.035, push = [0, 0] }) {
    if (![x, y, heading, length, width, sink, rim].every(Number.isFinite) || length <= 0 || width <= 0 || sink < 0 || rim <= 0) {
      throw Error('finite foot geometry required');
    }
    const hu = -0.3 * length, hr = 0.42 * width, fu = 0.17 * length, fa = 0.31 * length, fb = 0.5 * width;
    const inside = (u, v, grow) => (u - hu) ** 2 + v * v <= (hr + grow) ** 2
      || ((u - fu) / (fa + grow)) ** 2 + (v / (fb + grow)) ** 2 <= 1;
    const reach = length / 2 + rim + 2 * cell;
    let n = 0, mean = 0;
    visit(x, y, heading, reach, (i, u, v) => { if (inside(u, v, 0)) { n++; mean += baseU[i] + sand[i] + packed[i]; } });
    if (!n) return { displaced: 0, cells: 0 };
    mean = Math.round(mean / n);
    const sinkU = sink / quantum;
    let displaced = 0;
    const rimCells = [], rimWeights = [];
    const pl = Math.hypot(push[0], push[1]), px = pl ? push[0] / pl : 0, py = pl ? push[1] / pl : 0, bias = Math.min(4, pl);
    visit(x, y, heading, reach, (i, u, v, dx, dy) => {
      if (inside(u, v, 0)) {
        const sole = mean - Math.round(sinkU * (1 - 0.6 * u / length));   // heel (u<0) sinks deeper than the toe
        const cut = Math.min(sand[i] + packed[i], baseU[i] + sand[i] + packed[i] - sole);
        if (cut <= 0) { disturbed[i] = 255; touch(i); return; }
        if (R === 1) { const t = Math.min(sand[i], cut); if (t) { change(i, -t, true); displaced += t; } return; }
        let loose = sand[i], solid = packed[i], left = cut;
        const sp = Math.min(loose, (cut * SPILL) >> 8);
        loose -= sp; left -= sp;
        const k = Math.min(Math.floor(loose / R), Math.ceil(left / (R - 1)));
        loose -= R * k; solid += k; left -= (R - 1) * k;
        const extra = left > 0 ? Math.min(loose, left) : 0;
        loose -= extra;
        pack(i, loose, solid); displaced += sp + extra;
      } else if (inside(u, v, rim)) {
        const d = Math.hypot(dx, dy) || 1, along = (dx * px + dy * py) / d;
        rimCells.push(i); rimWeights.push(4 + Math.round(4 * bias * Math.max(0, along)));
      }
    });
    deposit(rimCells, rimWeights, displaced, true);
    return { displaced, cells: n };
  }
  // A box (half extents hl × hw, oriented by heading) whose bottom sits at `bottom` metres has moved by (dx, dy).
  // Material above the bottom inside the box is carried to where its line of travel leaves the box: a berm on the
  // leading face that relaxation spreads into a bow wave and side levees, and a cleared track behind. Packed material
  // the box cuts breaks back to loose (r loose quanta each).
  function plow({ x, y, heading = 0, hl = 0.4, hw = 0.4, bottom, dx = 0, dy = 0 }) {
    if (![x, y, heading, hl, hw, bottom, dx, dy].every(Number.isFinite)) throw Error('finite plow geometry required');
    const len = Math.hypot(dx, dy);
    if (!len) return 0;
    const mx = dx / len, my = dy / len, cs = Math.cos(heading), sn = Math.sin(heading), bottomU = Math.round(bottom / quantum);
    const inBox = (px, py) => { const u = px * cs + py * sn, v = -px * sn + py * cs; return Math.abs(u) <= hl && Math.abs(v) <= hw; };
    const reach = Math.hypot(hl, hw) + cell;
    let carried = 0;
    const out = new Map();
    visit(x, y, heading, reach, (i, u, v, px, py) => {
      if (Math.abs(u) > hl || Math.abs(v) > hw) return;
      const cut = Math.min(sand[i] + packed[i], baseU[i] + sand[i] + packed[i] - bottomU);
      if (cut <= 0) return;
      let s = cell;
      while (inBox(px + mx * s, py + my * s)) s += cell;
      const c = Math.round(colOf(x + px + mx * s)), r = Math.round(rowOf(y + py + my * s));
      if (c < 0 || r < 0 || c >= cols || r >= rows) return;          // the bed's edge is a wall: leave it in place
      const tl = Math.min(sand[i], cut), tp = cut - tl, m = tl + R * tp;
      if (tp) pack(i, sand[i] - tl, packed[i] - tp); else change(i, -tl, true);
      carried += m;
      const j = r * cols + c; out.set(j, (out.get(j) || 0) + m);
    });
    for (const [j, a] of out) change(j, a, true);
    return carried;
  }
  function heightAt(x, y) {
    const fc = Math.min(cols - 1.000001, Math.max(0, colOf(x))), fr = Math.min(rows - 1.000001, Math.max(0, rowOf(y)));
    const c = Math.floor(fc), r = Math.floor(fr), tx = fc - c, ty = fr - r, i = r * cols + c;
    const t = k => baseF[k] + (sand[k] + packed[k]) * quantum;
    return (t(i) * (1 - tx) + t(i + 1) * tx) * (1 - ty) + (t(i + cols) * (1 - tx) + t(i + cols + 1) * tx) * ty;
  }
  function baseAt(x, y) {
    const c = Math.min(cols - 1, Math.max(0, Math.round(colOf(x)))), r = Math.min(rows - 1, Math.max(0, Math.round(rowOf(y))));
    return baseF[r * cols + c];
  }
  // Slide the window by (dc, dr) whole cells: column (c, r) takes what was at (c + dc, r + dr). Fresh columns are dry
  // ground at the bed's depth over baseAt(x, y). The pending relaxation follows its columns.
  function shift(dc, dr, baseAt) {
    if (!Number.isInteger(dc) || !Number.isInteger(dr)) throw Error('shift by whole cells');
    if (!dc && !dr) return;
    origin = [origin[0] + dc * cell, origin[1] + dr * cell];
    const nb = new Int32Array(N), nf = new Float64Array(N), ns = new Int32Array(N), np = new Int32Array(N), nfl = new Uint8Array(N), nd = new Uint8Array(N), nw = new Uint8Array(N);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, oc = c + dc, or = r + dr;
      if (oc >= 0 && or >= 0 && oc < cols && or < rows) {
        const j = or * cols + oc;
        nb[i] = baseU[j]; nf[i] = baseF[j]; ns[i] = sand[j]; np[i] = packed[j]; nfl[i] = flowing[j]; nd[i] = disturbed[j]; nw[i] = wet[j];
      } else {
        const b = baseAt(origin[0] + c * cell, origin[1] + r * cell);
        if (!Number.isFinite(b)) throw Error('baseAt must return a finite height');
        nf[i] = b; nb[i] = Math.round(b / quantum); ns[i] = D0;
      }
    }
    baseU = nb; baseF = nf; sand = ns; packed = np; flowing = nfl; disturbed = nd; wet = nw;
    const was = active; active = []; queued = new Uint32Array(N);
    for (const j of was) { const oc = j % cols, or = (j - oc) / cols, c = oc - dc, r = or - dr; if (c >= 0 && r >= 0 && c < cols && r < rows) enqueue(r * cols + c); }
    // the seam between kept and fresh columns re-tests
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const oc = c + dc, or = r + dr, fresh = !(oc >= 0 && or >= 0 && oc < cols && or < rows);
      if (fresh) wake(r * cols + c);
    }
    dirty = [0, 0, cols - 1, rows - 1];
  }
  function takeDirty() { const d = dirty; dirty = null; return d; }
  function mass() { let m = 0; for (let i = 0; i < N; i++) m += sand[i] + R * packed[i]; return m; }
  tune({ friction, staticFriction, cohesion, viscosity });
  active = []; queued.fill(0);   // a fresh bed starts asleep
  return {
    cols, rows, cell, quantum, compaction: R,
    // the arrays are replaced by shift(): read them through these getters, never cache them across a shift
    get origin() { return origin; }, get baseU() { return baseU; }, get baseF() { return baseF; }, get sand() { return sand; },
    get packed() { return packed; }, get disturbed() { return disturbed; }, get wet() { return wet; },
    tune, step, press, plow, heightAt, baseAt, takeDirty, mass, setMoisture, shift,
    wakeAll: () => { for (let i = 0; i < N; i++) if (sand[i]) enqueue(i); },
    stats: () => ({ tick, active: active.length, friction: mu, staticFriction: mus, cohesion: coh, viscosity: VISC / 256 }),
  };
}

// Ground presets. μ/μs and viscosity can change live on a bed (wetting dry sand); compaction cannot, so a preset with a
// different compaction needs a fresh bed. `sink` is a walker's default foot sink in metres.
export const SOFT_GROUNDS = Object.freeze({
  'dry-sand': Object.freeze({ friction: 0.6, staticFriction: 0.7, cohesion: 0, compaction: 1, spill: 1, viscosity: 1, sink: 0.025 }),
  'damp-sand': Object.freeze({ friction: 0.65, staticFriction: 0.8, cohesion: 0.04, compaction: 1, spill: 1, viscosity: 1, sink: 0.03 }),
  'fresh-snow': Object.freeze({ friction: 0.8, staticFriction: 1.2, cohesion: 0.2, compaction: 3, spill: 0.12, viscosity: 1, sink: 0.12 }),
  'mud': Object.freeze({ friction: 0.35, staticFriction: 0.7, cohesion: 0.03, compaction: 1, spill: 1, viscosity: 0.04, sink: 0.06 }),
});
