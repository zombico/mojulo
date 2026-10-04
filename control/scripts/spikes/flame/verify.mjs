// SPIKE flame: the machine gate for the lit match. Runs the kernel in Node against the production wind field.
//   node scripts/spikes/flame/verify.mjs
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { windField } = await import('../../../lib/graph/vegetation/wind.js');
const { matchKernel, breathAt } = await import('./kernel.mjs');

const DEG = Math.PI / 180, results = [], measured = {};
const check = (name, ok, info) => { results.push({ name, ok: !!ok }); if (info !== undefined) measured[name] = info; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info !== undefined ? '  ' + JSON.stringify(info) : ''}`); };
// a room draught: the field's speed is read at its 2 m reference, so `speed` is the air at the flame
const room = (speed, o = {}) => { const W = windField({ speed, dir: 0, gust: 0.6, scale: 0.6, evolve: 2, veer: 25 * DEG, seed: 3, z0: 0.03, ...o }); return (x, y, z, t) => W.at(x, y, 2, t); };
const still = () => [0, 0, 0];
const lit = (air, o = {}, t = 4) => { const m = matchKernel({ seed: 5, ...o }, air); m.strike(); m.advanceTo(t); return m; };
const tipOff = (f) => { const n = f.pts.length; return [f.pts[n - 3] - f.pts[0], f.pts[n - 2] - f.pts[1], f.pts[n - 1] - f.pts[2]]; };

// 1. determinism: the same seed and air give the same flame, front and smoke, byte for byte
{
  const a = lit(room(0.6)), b = lit(room(0.6)), fa = a.flameAt(a.t), fb = b.flameAt(b.t);
  const same = fa && fb && fa.pts.every((v, i) => v === fb.pts[i]) && a.front === b.front && a.smoke.x.every((v, i) => v === b.smoke.x[i]);
  check('deterministic per seed and air', same);
}
// 2. still air: the flame stands straight up whatever way the stick points
{
  let worst = 0; const len = [];
  for (const th of [-60, -20, 0, 30, 50]) { const m = lit(still, { theta: th * DEG }, 2.5), f = m.flameAt(m.t), d = tipOff(f); worst = Math.max(worst, Math.hypot(d[0], d[1])); len.push(+(d[2] * 1000).toFixed(1)); }
  check('still air: the flame is vertical at any stick angle', worst < 1e-12, { tipLateralM: worst, heightMm: len });
}
// 3. flaccidity: φ = 0 takes no air, byte-identical to still air even in a strong breeze
{
  const a = lit(room(1.6), { phi: { flame: 0, smoke: 0, sparks: 0 } }), b = lit(still), fa = a.flameAt(a.t), fb = b.flameAt(b.t);
  check('φ = 0 is still air exactly (flame, front, smoke, sparks)', fa.pts.every((v, i) => v === fb.pts[i]) && a.front === b.front && a.smoke.x.every((v, i) => v === b.smoke.x[i]) && JSON.stringify(a.sparksAt(0.1)) === JSON.stringify(b.sparksAt(0.1)));
}
// 4. the flame leans downwind, and further as the air quickens (mean over a few seconds, the gusts averaged out)
{
  const lean = [];
  for (const sp of [0.2, 0.5, 0.9, 1.3]) {
    const m = lit(room(sp, { gust: 0.15 }), {}, 2.2); let dx = 0, dz = 0, n = 0;
    for (let i = 0; i < 40 && m.lit; i++) { m.step(0.05); const f = m.flameAt(m.t); if (!f) break; const d = tipOff(f); dx += d[0]; dz += d[2]; n++; }
    lean.push(+(Math.atan2(dx / n, dz / n) / DEG).toFixed(1));
  }
  check('the flame leans downwind, more as the air quickens', lean[0] > 5 && lean.every((v, i) => i === 0 || v > lean[i - 1]), { leanDeg: lean });
}
// 5. a gust bends the base first and the tip after: the tip's lean lags the base's air
{
  const m = lit(still, {}, 2.5), t0 = m.t; let step = 0;
  const gust = (x, y, z, t) => [t > t0 + 0.02 ? 1 : 0, 0, 0];
  const g = matchKernel({ seed: 5 }, gust); g.strike(); g.advanceTo(t0 + 0.02); step = g.flameAt(t0 + 0.035);
  const lat = Array.from({ length: g.N }, (_, k) => step.pts[3 * k] - step.pts[0]);
  const mid = lat[Math.floor(g.N / 2)], tip = lat[g.N - 1];
  // 15 ms into a step gust, only the gas let go since it began has moved: the tip, older gas, has not yet turned
  const later = g.flameAt(t0 + 0.12), latLater = later.pts[3 * (g.N - 1)] - later.pts[0];
  check('a gust reaches the base first, the tip after', tip > 0.005 && latLater > tip + 0.004, { tipAt15msMm: +(tip * 1000).toFixed(2), tipAt100msMm: +(latLater * 1000).toFixed(2), midAt15msMm: +(mid * 1000).toFixed(2) });
}
// 6. burn rate by stick angle: head down races, level creeps, head up starves
{
  const rate = {}, why = {};
  for (const th of [-60, 0, 60]) { const m = lit(still, { theta: th * DEG }, 2.4), f0 = m.front; m.advanceTo(5.4); rate[th] = +(((m.front - f0) / 3) * 1000).toFixed(2); m.advanceTo(40); why[th] = m.why; }
  check('head down burns faster than level, level faster than head up', rate[-60] > rate[0] && rate[0] > rate[60], { mmPerS: rate });
  check('steep head up starves out; level burns to the clip', why[60] === 'starved' && why[0] === 'burnt', { outBy: why });
}
// 7. the strike flares bigger than the steady flame; the steady flame is match-sized
{
  const m = matchKernel({ seed: 5 }, still); m.strike(); m.advanceTo(0.06); const flare = m.L; m.advanceTo(3); const steady = m.L;
  check('the strike flares bigger than the steady flame; steady 20–35 mm', flare > 1.4 * steady && steady > 0.02 && steady < 0.035, { flareMm: +(flare * 1000).toFixed(1), steadyMm: +(steady * 1000).toFixed(1) });
  const sp = m.sparksAt(0.1); check('the strike throws sparks, gone within a second', sp.length > 5 && m.sparksAt(1.0).length === 0, { liveAt100ms: sp.length });
}
// 8. blow-off: a light draught keeps it; a breeze past the blow-off speed puts it out; a breath puts it out
{
  const calm = lit(room(0.8, { gust: 0.2 }), {}, 12), gale = lit(room(4.5, { gust: 0.2 }), {}, 6);
  check('a light draught keeps it lit; a strong breeze blows it out', calm.lit && gale.why === 'blown', { calm: calm.stage(), strong: gale.stage(), outAtS: +(gale.outAt).toFixed(3) });
  const m = matchKernel({ seed: 5 }, still); let B = null;
  const air = (x, y, z, t) => (B ? breathAt(B, x, y, z, t) : [0, 0, 0]);
  const mb = matchKernel({ seed: 5 }, air); mb.strike(); mb.advanceTo(3);
  const base = mb.base(); B = { t0: mb.t, from: [base[0] - 0.3, base[1], base[2] + 0.05], to: base, U: 8, dur: 0.4 };
  mb.advanceTo(4); m.strike();
  check('a breath from 30 cm blows it out', mb.why === 'blown', { outAfterBreathS: +(mb.outAt - B.t0).toFixed(3) });
}
// 9. smoke after it goes out: a wisp that rises, laminar near the ember, wavering higher up, and carried downwind
{
  const wisp = (air) => {
    const m = matchKernel({ seed: 5 }, air); m.strike(); m.advanceTo(3); m.lit = false; m.out = true; m.outAt = m.t; m.why = 'test'; m.advanceTo(5);
    const S = m.smoke, base = m.at(m.front); let n = 0, zs = 0, xs = 0; const low = [], high = [];
    for (let i = 0; i < S.alive.length; i++) if (S.alive[i] && S.kind[i] === 2) { n++; zs += S.z[i] - base[2]; xs += S.x[i] - base[0]; const lat = Math.hypot(S.x[i] - base[0], S.y[i] - base[1]) - Math.abs(xs / n); (S.age[i] < 0.2 ? low : S.age[i] > 1 ? high : []).push(Math.hypot(S.y[i] - base[1])); }
    const spread = (a) => (a.length ? a.reduce((p, v) => p + v, 0) / a.length : 0);
    return { n, rise: zs / n, drift: xs / n, low: spread(low), high: spread(high) };
  };
  const s0 = wisp(still), s1 = wisp(room(0.5, { gust: 0.1 }));
  check('the wisp rises from the ember', s0.n > 50 && s0.rise > 0.03, { puffs: s0.n, meanRiseCm: +(s0.rise * 100).toFixed(1) });
  check('the wisp is a thread near the ember and wavers higher up', s0.low < 0.0015 && s0.high > 2 * s0.low, { crossSpreadLowMm: +(s0.low * 1000).toFixed(2), crossSpreadHighMm: +(s0.high * 1000).toFixed(2) });
  // in still air the thread meanders on its own instability (a few cm); a draught carries the whole of it downwind
  check('a draught carries the wisp downwind, far past its own meander', s1.drift > 0.02 && Math.abs(s0.drift) < 0.2 * s1.drift, { stillDriftCm: +(s0.drift * 100).toFixed(2), draughtDriftCm: +(s1.drift * 100).toFixed(1) });
}
// 10. seekable: the flame and the sparks at a time do not depend on the order they are asked
{
  const m = lit(room(0.7), {}, 3), t = m.t, a = m.flameAt(t), b = m.flameAt(t - 0.01), c = m.flameAt(t);
  const s1 = JSON.stringify(m.sparksAt(0.08)), s2 = (m.sparksAt(0.2), JSON.stringify(m.sparksAt(0.08)));
  check('flame(t) and sparks(t) are seekable', a.pts.every((v, i) => v === c.pts[i]) && b.pts.some((v, i) => v !== a.pts[i]) && s1 === s2);
}
// 11. the front only moves toward the clip, and stops there
{
  const m = lit(still, { theta: -50 * DEG }, 0.1); let prev = m.front, mono = true;
  while (m.t < 30) { m.step(0.1); if (m.front < prev) mono = false; prev = m.front; }
  check('the front is monotonic and stops at the clip', mono && m.why === 'burnt' && m.front <= m.P.clip, { frontMm: +(m.front * 1000).toFixed(1), burntAtS: +(m.outAt).toFixed(1) });
}
// cost
{
  const m = lit(room(0.7), {}, 3), t0 = performance.now(); for (let i = 0; i < 200; i++) m.flameAt(m.t + i / 60); const fl = (performance.now() - t0) / 200;
  const t1 = performance.now(); m.lit = false; m.out = true; m.outAt = m.t; m.why = 'test'; m.step(2); const sm = (performance.now() - t1) / 480;
  measured.cost = { flameMs: +fl.toFixed(3), burnTickMs: +sm.toFixed(3) }; console.log('cost', JSON.stringify(measured.cost));
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
