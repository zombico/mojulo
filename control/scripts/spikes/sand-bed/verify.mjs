import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { buildSandBed, SOFT_GROUNDS } from './kernel.mjs';
const settle = (b, max = 20000) => { let checks = 0; for (let t = 0; t < max; t++) { const m = b.step(); checks += m.checked; if (!m.active) return { ticks: t + 1, checks }; } throw Error('did not settle'); };
const DRY = SOFT_GROUNDS['dry-sand'], DAMP = SOFT_GROUNDS['damp-sand'], SNOW = SOFT_GROUNDS['fresh-snow'], MUD = SOFT_GROUNDS.mud;
const bed = f => buildSandBed({ cols: 120, rows: 120, depth: 0.2, ...f });
const S0 = 0.2;   // undisturbed surface on the flat test bed
// Print shape: heel below the surface by about the sink (heel sinks deeper than toe), a raised rim, heavier where pushed.
function print(f) {
  const b = bed(f), m0 = b.mass();
  const r = b.press({ x: 1.5, y: 1.5, heading: 0, sink: 0.03, push: [1.5, 0] });
  const s = settle(b);
  const top = (x, y) => b.heightAt(x, y);
  const heel = S0 - top(1.5 - 0.078, 1.5), toe = S0 - top(1.5 + 0.044, 1.5);
  const ring = (dx, dy) => Math.max(...[0, 1, 2, 3].map(k => top(1.5 + dx * (0.13 + 0.02 * k), 1.5 + dy * (0.05 + 0.02 * k)))) - S0;
  let deficit = 0;
  for (let i = 0; i < b.sand.length; i++) deficit += Math.max(0, Math.round(S0 / b.quantum) - b.baseU[i] - b.sand[i]);
  return { b, m0, r, s, heel, toe, front: ring(1, 0), back: ring(-1, 0), side: ring(0, 1), deficit };
}
const dry = print(DRY), damp = print(DAMP);
for (const p of [dry, damp]) {
  assert.equal(p.b.mass(), p.m0);                                   // every displaced unit is in the rim
  assert(p.r.displaced > 0 && p.heel > 0.02 && p.heel > p.toe, `heel ${p.heel} toe ${p.toe}`);
  assert(p.front > 0.005 && p.front > p.back, `rim front ${p.front} back ${p.back}`);
  assert(p.s.ticks < 50);                                            // a print settles in a handful of ticks
  const snap = p.b.sand.slice();
  for (let i = 0; i < 2000; i++) assert.equal(p.b.step().checked, 0);
  assert.deepEqual(p.b.sand, snap);                                  // retained: unchanged and doing no work
  p.b.wakeAll(); assert.equal(p.b.step().moved, 0);                 // sleep is sound: nothing asleep was unstable
}
// Damp sand (high μs) keeps more of the print open than dry sand, whose walls slump back in.
assert(damp.deficit > dry.deficit, `damp ${damp.deficit} dry ${dry.deficit}`);
// Re-tuning damp → dry under existing prints slumps them, mass exact, and every wall ends under the static angle.
damp.b.tune(DRY); settle(damp.b); assert.equal(damp.b.mass(), damp.m0);
// Settled ground never exceeds its yield anywhere: drop ≤ μs · distance + cohesion between every pair of neighbours.
function overYield(b) {
  const { cols, rows, cell, quantum } = b, { staticFriction, cohesion } = b.stats(); let worst = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c; if (!b.sand[i]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = c + dx, y = r + dy; if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const j = y * cols + x, drop = b.baseU[i] + b.sand[i] + b.packed[i] - b.baseU[j] - b.sand[j] - b.packed[j];
      worst = Math.max(worst, drop - Math.floor((staticFriction * cell * Math.hypot(dx, dy) + cohesion) / quantum));
    }
  }
  return worst;
}
assert.equal(overYield(damp.b), 0);
// Plow: a box 10 cm into the surface, pushed 1.2 m, leaves a groove at its bottom, a bow wave ahead, levees beside.
const p = buildSandBed({ cols: 200, rows: 120, depth: 0.2, ...DAMP }), pm = p.mass();
let x = 0.8;
for (let k = 0; k < 60; k++) { p.plow({ x: x + 0.02, y: 1.5, hl: 0.2, hw: 0.2, bottom: 0.1, dx: 0.02, dy: 0 }); x += 0.02; p.step(); }
settle(p);
assert.equal(p.mass(), pm);
const groove = p.heightAt(1.3, 1.5), bow = Math.max(...[0.22, 0.25, 0.28, 0.32].map(d => p.heightAt(x + d, 1.5))), levee = Math.max(...[0.24, 0.27, 0.3].map(d => p.heightAt(1.3, 1.5 + d)));
assert(Math.abs(groove - 0.1) < 0.01 && bow > S0 + 0.05 && levee > S0 + 0.005, `groove ${groove} bow ${bow} levee ${levee}`);
assert.equal(overYield(p), 0);
// Snow compacts instead of displacing: a deep hole with vertical walls that hold, a small rim (only the spill), mass
// exact with packed quanta counted at the compaction ratio. Each pass in the same print sinks less (trail breaking).
const snow = buildSandBed({ cols: 120, rows: 120, depth: 0.3, ...SNOW }), sm = snow.mass();
const boot = () => snow.press({ x: 1.5, y: 1.5, heading: 0, sink: SNOW.sink, push: [1.2, 0] });
const heelAt = b => 0.3 - b.heightAt(1.5 - 0.078, 1.5);
const first = boot(), snowSettle = settle(snow), d1 = heelAt(snow);
let cutMass = 0; for (let i = 0; i < snow.packed.length; i++) cutMass += snow.packed[i];
assert.equal(snow.mass(), sm);
assert(d1 > 0.1 && cutMass > 0 && snowSettle.ticks <= 2, `snow heel ${d1}`);
assert(first.displaced < 0.25 * snow.compaction * cutMass, 'snow rim is the spill, not the whole cut');
const snowRim = Math.max(...[0.13, 0.15, 0.17].map(d => snow.heightAt(1.5 + d, 1.5))) - 0.3;
boot(); settle(snow); const d2 = heelAt(snow) - d1; boot(); settle(snow); const d3 = heelAt(snow) - d1 - d2;
assert(d2 > 0 && d2 < 0.75 * d1 && d3 < d2 && d3 < 0.01, `passes ${d1} ${d2} ${d3}`);
assert.equal(snow.mass(), sm); assert.equal(overYield(snow), 0);
// A plow through the packed trail breaks it back to loose at the compaction ratio, mass exact.
for (let k = 0; k < 30; k++) { snow.plow({ x: 1.0 + k * 0.03, y: 1.5, hl: 0.2, hw: 0.2, bottom: 0.15, dx: 0.03, dy: 0 }); snow.step(); }
settle(snow); assert.equal(snow.mass(), sm); assert.equal(overYield(snow), 0);
// Mud is viscous: a fresh print oozes back over far more ticks than sand, softening but not vanishing.
const mud = buildSandBed({ cols: 120, rows: 120, depth: 0.3, ...MUD }), mm = mud.mass();
mud.press({ x: 1.5, y: 1.5, heading: 0, sink: MUD.sink, push: [1.2, 0] });
const mudFresh = heelAt(mud), mudSettle = settle(mud), mudHeel = heelAt(mud);
assert.equal(mud.mass(), mm); assert.equal(overYield(mud), 0);
assert(mudSettle.ticks > 10 * damp.s.ticks && mudHeel < 0.8 * mudFresh && mudHeel > 0.02, `mud ${mudFresh} → ${mudHeel} in ${mudSettle.ticks}`);
// Deterministic replay of a scripted walk: same plants, same bed, byte for byte.
function walk() {
  const b = buildSandBed({ cols: 160, rows: 160, depth: 0.25, ...DAMP });
  for (let k = 0; k < 24; k++) {
    const t = k * 0.26, h = 0.4 + 0.08 * k, side = k % 2 ? -1 : 1;
    b.press({ x: 0.8 + Math.cos(h) * t + -Math.sin(h) * 0.11 * side, y: 0.8 + Math.sin(h) * t + Math.cos(h) * 0.11 * side, heading: h, sink: 0.03, push: [Math.cos(h), Math.sin(h)] });
    for (let i = 0; i < 20; i++) b.step();
  }
  settle(b); return b;
}
const w1 = walk(), w2 = walk();
assert.deepEqual(w1.sand, w2.sand);
assert.throws(() => buildSandBed({ cols: 2 }));
assert.throws(() => p.press({ x: NaN, y: 0 }));
assert.throws(() => p.tune({ friction: 0.9, staticFriction: 0.5 }));
// Cost on the preview's 400×400 bed (10 m at 2.5 cm): a walker planting a foot every 16 ticks while it relaxes.
const big = buildSandBed({ cols: 400, rows: 400, origin: [-5, -5], depth: 0.3, ...DAMP });
let checked = 0, ticks = 0, worst = 0; const t0 = performance.now();
for (let k = 0; k < 60; k++) {
  const h = k * 0.1, side = k % 2 ? -1 : 1;
  big.press({ x: -3 + k * 0.1 - Math.sin(h) * 0.11 * side, y: Math.sin(h) + Math.cos(h) * 0.11 * side, heading: Math.atan2(Math.cos(h), 1), sink: 0.03, push: [1, 0] });
  for (let i = 0; i < 16; i++) { const a = performance.now(); checked += big.step().checked; worst = Math.max(worst, performance.now() - a); ticks++; }
}
const ms = performance.now() - t0, idle = settle(big);
for (let i = 0; i < 1000; i++) assert.equal(big.step().checked, 0);
console.log(JSON.stringify({
  passed: ['print conserves mass', 'heel deeper than toe', 'rim heavier toward push', 'print settles in a few ticks',
    'settled print retained with zero work', 'sleep soundness under a full wake', 'damp keeps more print than dry',
    'dry re-tune slumps under its yield, mass exact', 'plow groove, bow wave and levees, mass exact',
    'snow compacts: deep held hole, spill-only rim, mass exact', 'snow trail breaking: each pass sinks less', 'plow breaks packed snow, mass exact',
    'mud oozes back over many ticks and keeps a dent', 'deterministic replay', 'input validation'],
  print: { dry: { heelMm: +(dry.heel * 1000).toFixed(1), rimFrontMm: +(dry.front * 1000).toFixed(1), rimBackMm: +(dry.back * 1000).toFixed(1), deficit: dry.deficit, settleTicks: dry.s.ticks },
    damp: { heelMm: +(damp.heel * 1000).toFixed(1), rimFrontMm: +(damp.front * 1000).toFixed(1), rimBackMm: +(damp.back * 1000).toFixed(1), deficit: damp.deficit, settleTicks: damp.s.ticks } },
  snow: { heelMm: +(d1 * 1000).toFixed(1), secondPassMm: +(d2 * 1000).toFixed(1), thirdPassMm: +(d3 * 1000).toFixed(1), rimMm: +(snowRim * 1000).toFixed(1) },
  mud: { freshHeelMm: +(mudFresh * 1000).toFixed(1), settledHeelMm: +(mudHeel * 1000).toFixed(1), oozeTicks: mudSettle.ticks },
  plow: { grooveM: +groove.toFixed(3), bowM: +bow.toFixed(3), leveeM: +levee.toFixed(3) },
  benchmark: { bed: '400×400 @ 2.5 cm', prints: 60, ticks, totalMs: +ms.toFixed(1), meanMsPerTick: +(ms / ticks).toFixed(4), worstTickMs: +worst.toFixed(2), checked, settleAfter: idle.ticks },
  scope: 'Node kernel only; excludes mesh upload and rendering',
}, null, 2));
