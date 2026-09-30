// usage (from the repo root): node ci-diag/bench-dmath.mjs
// dmath against the engine's Math: 1e6 calls per function over geometry-range inputs, best of 5 rounds, ns per call.
import * as dmath from '../control/lib/util/dmath.js';

const N = 1e6;
let s = 0x2545f491;
const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = {
  sin: () => (r() * 2 - 1) * 20, cos: () => (r() * 2 - 1) * 20, tan: () => (r() * 2 - 1) * 1.5, asin: () => r() * 2 - 1, acos: () => r() * 2 - 1,
  atan: () => (r() * 2 - 1) * 50, atan2: () => (r() * 2 - 1) * 10, exp: () => (r() * 2 - 1) * 20, expm1: () => (r() * 2 - 1) * 2, log: () => r() * 1000 + 1e-9,
  log1p: () => r() * 10, log2: () => r() * 1000 + 1e-9, log10: () => r() * 1000 + 1e-9, pow: () => r() * 10, cbrt: () => (r() * 2 - 1) * 1000,
  hypot: () => (r() * 2 - 1) * 10, sinh: () => (r() * 2 - 1) * 5, cosh: () => (r() * 2 - 1) * 5, tanh: () => (r() * 2 - 1) * 5,
};
const two = new Set(['atan2', 'pow', 'hypot']);
const rows = [];
for (const [fn, g] of Object.entries(gen)) {
  const a = new Float64Array(N), b = new Float64Array(N);
  for (let i = 0; i < N; i++) { a[i] = g(); b[i] = fn === 'pow' ? (r() * 2 - 1) * 4 : g(); }
  const time = (f) => {
    let best = Infinity, acc = 0;
    for (let round = 0; round < 5; round++) {
      const t0 = process.hrtime.bigint();
      if (two.has(fn)) for (let i = 0; i < N; i++) acc += f(a[i], b[i]); else for (let i = 0; i < N; i++) acc += f(a[i]);
      best = Math.min(best, Number(process.hrtime.bigint() - t0) / N);
    }
    if (acc === 42) console.log('');   // keep the loop's result alive
    return best;
  };
  const m = time(Math[fn]), d = time(dmath[fn]);
  rows.push([fn, m.toFixed(1), d.toFixed(1), (d / m).toFixed(2)]);
}
console.log(`${process.version} ${process.arch}\n| fn | Math ns/call | dmath ns/call | ratio |\n|---|---|---|---|`);
for (const row of rows) console.log(`| ${row.join(' | ')} |`);
