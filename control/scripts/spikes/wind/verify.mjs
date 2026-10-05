import assert from 'node:assert/strict';
import { elastica } from '../../../lib/graph/vegetation/mechanics.js';
import { bakeElasticaTable } from './table.mjs';
import { buildWind } from './kernel.mjs';
import { buildScene } from './scene.mjs';

const t0 = performance.now();
const table = bakeElasticaTable();
const bakeMs = performance.now() - t0;
const k = buildWind(table);
const scene = buildScene();
const withPhi = (sc, f) => ({ ...sc, elements: sc.elements.map((e) => ({ ...e, phi: f(e) })) });
const results = [];
const check = (name, fn) => { fn(); results.push(name); };

const breeze = k.makeWind({ speed: 6, dir: 0.3, gust: 0.6, seed: 3 });
const still = k.makeWind({ speed: 0 });
const P = k.prepareScene(scene);

check('φ = 0 everywhere is byte-identical to still air', () => {
  const P0 = k.prepareScene(withPhi(scene, () => 0));
  for (const t of [0, 1.7, 12.25]) assert.deepEqual(k.sampleScene(P0, breeze, t).pts, P0.rest);
});
check('zero wind is byte-identical to still air at any φ', () => {
  for (const t of [0, 3.3]) assert.deepEqual(k.sampleScene(P, still, t).pts, P.rest);
});
check('a φ = 0 post holds still while the ribbon tied to it streams', () => {
  const post = scene.elements.findIndex((e) => e.part === 'post'), ribbon = scene.elements.findIndex((e) => e.part === 'ribbon');
  const s = k.sampleScene(P, breeze, 4);
  assert.deepEqual(s.pts[post], P.rest[post]);
  assert(s.pts[ribbon].at(-1)[2] - P.rest[ribbon].at(-1)[2] > 0.2, 'the ribbon lifts in the wind');
});

// The table is the production elastica: off-grid lookups against direct solves.
let worst = 0;
check('the baked table matches production elastica off-grid (< 1.5% of L)', () => {
  for (const [theta0, B] of [[0, 3], [0.41, 7.3], [-0.9, 0.6], [1.2, 40], [0.05, 0.02], [-0.3, 95]]) {
    const direct = elastica({ B, theta0, n: 200 }).tip, shape = k.lookup(theta0, B), tip = shape.at(-1);
    worst = Math.max(worst, Math.hypot(tip[0] - direct[0], tip[1] - direct[1]));
  }
  assert(worst < 0.015, `worst tip error ${worst}`);
});

check('steady wind poses a blade as the elastica under the rotated load', () => {
  const steady = k.makeWind({ speed: 5, dir: 0, gust: 0 });
  const blade = { L: 0.5, B: 4, sail: 0.35, phi: 1 };
  const sc = { stations: [{ pos: [0, 0, 0.25], B: 4, L: 0.5, zeta: 0.12 }], elements: [{ ...blade, station: 0, base: [0, 0, 0], dir: [0, 0, 1] }] };
  const Ps = k.prepareScene(sc), a = k.sampleScene(Ps, steady, 2).pts[0], b = k.sampleScene(Ps, steady, 9).pts[0];
  assert.deepEqual(a, b, 'steady wind holds a steady pose');
  const u = 5 * k.profile(steady, 0.25), r = blade.phi * blade.sail * u * u, m = Math.hypot(r, 1);
  const theta0 = Math.asin(1 / m);                              // the blade's angle above the plane normal to the load
  const d = elastica({ B: blade.B * m, theta0, n: 200 }).tip;  // (x along eh, y along "up" = −load)
  const up = [-r / m, 0, 1 / m], eh = [1 / m, 0, r / m];       // eh: the in-plane horizontal, on the blade's side
  const want = [0, 1, 2].map((c) => blade.L * (d[0] * eh[c] + d[1] * up[c]));
  assert(Math.hypot(...want.map((v, c) => v - a.at(-1)[c])) < 0.015 * blade.L, `tip ${a.at(-1)} vs ${want}`);
  assert(a.at(-1)[0] > 0.1, 'the blade leans downwind');
});

check('any time can be sampled in any order (seekable)', () => {
  const fresh = k.sampleScene(P, breeze, 7.3);
  for (let t = 0; t < 7; t += 0.5) k.sampleScene(P, breeze, t);
  assert.deepEqual(k.sampleScene(P, breeze, 7.3), fresh);
});
check('seeded: same seed same field, another seed another', () => {
  const a = k.windAt(breeze, 2, 1, 1, 3), b = k.windAt(k.makeWind({ ...breeze }), 2, 1, 1, 3), c = k.windAt(k.makeWind({ ...breeze, seed: 4 }), 2, 1, 1, 3);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
});

let lagFound = 0;
check('gusts travel downwind at the mean speed (frozen turbulence)', () => {
  const w = k.makeWind({ speed: 6, dir: 0, gust: 0.8, evolve: 20 }), dist = 6, dt = 0.05;
  const A = [], B = [];
  for (let t = 0; t < 60; t += dt) { A.push(Math.hypot(...k.windAt(w, 0, 0, 2, t))); B.push(Math.hypot(...k.windAt(w, dist, 0, 2, t))); }
  const mean = (s) => s.reduce((x, y) => x + y) / s.length, ma = mean(A), mb = mean(B);
  let best = -Infinity;
  for (let lag = 0; lag < 60; lag++) {
    let c = 0; for (let i = 0; i + lag < A.length; i++) c += (A[i] - ma) * (B[i + lag] - mb);
    c /= A.length - lag; if (c > best) { best = c; lagFound = lag * dt; }
  }
  assert(Math.abs(lagFound - dist / 6) <= 0.1, `peak lag ${lagFound}s, expected ${dist / 6}s`);
});

let peakRatio = 0;
check('the response filter has unit DC gain and resonates near f1', () => {
  const f1 = k.naturalFrequency(4, 0.5), { lags, wts } = k.responseWeights(f1, 0.12);
  assert(Math.abs(wts.reduce((a, b) => a + b) - 1) < 1e-12);
  let peak = 0, at = 0;
  for (let f = 0.1; f < 4 * f1; f += 0.01) {
    let re = 0, im = 0; lags.forEach((tau, j) => { re += wts[j] * Math.cos(2 * Math.PI * f * tau); im -= wts[j] * Math.sin(2 * Math.PI * f * tau); });
    const g = Math.hypot(re, im); if (g > peak) { peak = g; at = f; }
  }
  peakRatio = at / f1;
  assert(Math.abs(peakRatio - 1) < 0.1 && peak > 2, `peak ${peak.toFixed(2)} at ${at.toFixed(2)} Hz, f1 ${f1.toFixed(2)} Hz`);
});

const blades = scene.elements.map((e, i) => i).filter((i) => scene.elements[i].part === 'blade').slice(0, 80);
const lean = (Pp, w) => {                 // mean downwind tip travel over 10 s
  const d = [Math.cos(w.dir), Math.sin(w.dir)]; let s = 0, n = 0;
  for (let t = 0; t < 10; t += 0.25) { const pts = k.sampleScene(Pp, w, t).pts; for (const i of blades) { const a = pts[i].at(-1), b = Pp.rest[i].at(-1); s += (a[0] - b[0]) * d[0] + (a[1] - b[1]) * d[1]; n++; } }
  return s / n;
};
const leans = {};
check('grass leans further with more flaccidity and more wind', () => {
  for (const f of [0, 0.5, 1]) leans[`phi${f}`] = lean(k.prepareScene(withPhi(scene, () => f)), breeze);
  for (const sp of [2, 5, 9]) leans[`speed${sp}`] = lean(P, k.makeWind({ ...breeze, speed: sp }));
  assert(leans.phi0 === 0 && leans.phi0 < leans['phi0.5'] && leans['phi0.5'] < leans.phi1);
  assert(leans.speed2 < leans.speed5 && leans.speed5 < leans.speed9);
});
check('leaves stay attached as their branches move', () => {
  const s = k.sampleScene(P, breeze, 5.5);
  scene.elements.forEach((e, i) => { if (e.parent >= 0) { const f = k.frameAt(s.pts[e.parent], e.at).p; assert(Math.hypot(...f.map((v, c) => v - s.pts[i][0][c])) < 1e-12); } });
});
check('the wind is weaker near the ground (log profile)', () => {
  assert(k.profile(breeze, 0.05) < k.profile(breeze, 0.5) && k.profile(breeze, 0.5) < k.profile(breeze, 2) && k.profile(breeze, 2) === 1);
});

// free particles
const far = { x0: -1e6, y0: -1e6, W: 2e6, H: 2e6 };
const loose = (phi) => ['dust', 'leaf', 'twig'].flatMap((kind) => Array.from({ length: 40 }, (_, i) => ({ kind, x: (i % 8) * 1.5, y: Math.floor(i / 8) * 1.5, phi })));
const run = (st, w, ticks) => { for (let i = 0; i < ticks; i++) k.stepParticles(st, w, 1 / 60); return st; };
check('φ = 0 debris and still air leave debris exactly where it lay', () => {
  const init = k.makeParticles(loose(1), far);
  assert.deepEqual([...run(k.makeParticles(loose(0), far), breeze, 600).x], [...init.x]);
  assert.deepEqual([...run(k.makeParticles(loose(1), far), still, 600).x], [...init.x]);
});
const travel = {};
check('dust travels before leaves, leaves before twigs', () => {
  const gale = k.makeWind({ ...breeze, speed: 9 }), st = run(k.makeParticles(loose(1), far), gale, 1200), init = k.makeParticles(loose(1), far);
  for (const [ki, name] of ['dust', 'leaf', 'twig'].entries()) {
    let s = 0; for (let i = 0; i < st.n; i++) if (st.kind[i] === ki) s += Math.hypot(st.x[i] - init.x[i], st.y[i] - init.y[i]); travel[name] = s / 40;
  }
  assert(travel.dust > travel.leaf && travel.leaf > travel.twig, JSON.stringify(travel));
});
check('particle seeking replays exactly from checkpoints', () => {
  const init = k.makeParticles(scene.particles, scene.domain), tl = k.makeTimeline(init, breeze);
  const direct = run(k.cloneParticles(init), breeze, 600);
  tl.at(12); const sought = tl.at(10);
  assert.deepEqual([...sought.x, ...sought.y, ...sought.z], [...direct.x, ...direct.y, ...direct.z]);
  assert([...sought.x, ...sought.y, ...sought.z].every(Number.isFinite) && sought.n === scene.particles.length);
});
check('invalid input is rejected', () => {
  assert.throws(() => k.makeWind({ speed: NaN }));
  assert.throws(() => k.makeWind({ speed: -1 }));
  assert.throws(() => k.prepareScene(withPhi(scene, () => 1.5)));
  assert.throws(() => k.prepareScene({ stations: [{ pos: [0, 0, 0], B: 1, L: 1, zeta: 0.1 }], elements: [{ station: 0, base: [0, 0, 0], dir: [0, 0, 1], L: 1, B: 1, sail: 1, phi: 1, parent: 0, at: 0.5 }] }));
  assert.throws(() => k.makeParticles([{ kind: 'boulder', x: 0, y: 0, phi: 1 }], far));
});

// cost (Node only, rendering excluded)
for (let i = 0; i < 30; i++) k.sampleScene(P, breeze, i / 60);
let t1 = performance.now(); for (let i = 0; i < 120; i++) k.sampleScene(P, breeze, i / 60);
const frameMs = (performance.now() - t1) / 120;
const pst = k.makeParticles(scene.particles, scene.domain); run(pst, breeze, 60);
t1 = performance.now(); run(pst, breeze, 600); const tickMs = (performance.now() - t1) / 600;

console.log(JSON.stringify({
  pass: results,
  measured: {
    tableBakeMs: Math.round(bakeMs), tableWorstTipError: +worst.toFixed(4), gustLagS: +lagFound.toFixed(2), resonanceOverF1: +peakRatio.toFixed(3),
    meanDownwindTipTravelM: Object.fromEntries(Object.entries(leans).map(([a, b]) => [a, +b.toFixed(4)])),
    meanDebrisTravelM20s: Object.fromEntries(Object.entries(travel).map(([a, b]) => [a, +b.toFixed(2)])),
    scene: { elements: scene.elements.length, stations: scene.stations.length, particles: scene.particles.length },
    anchoredMsPerFrame: +frameMs.toFixed(2), particleMsPerTick: +tickMs.toFixed(3),
  },
}, null, 2));
console.log(`PASS: ${results.length} checks.`);
