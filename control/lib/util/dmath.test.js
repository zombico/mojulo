/**
 * dmath's contract: the golden digests below pin its output over a fixed seeded input set (geometry-range draws,
 * hard cases for every reduction path and threshold, special values), and the same bytes must come out on every
 * engine, CPU and Node version. Re-pin ONLY alongside a change that says a function's output changes: every
 * recipe that takes its math from dmath regrows differently when it does.
 *
 * Beside the pin: ECMAScript's special values and ToNumber coercion; agreement with this runtime's Math on 200k
 * seeded geometry-range inputs per function (on x64 they are the same bits for everything but pow; elsewhere within
 * the bound SLACK explains); and a scan of dmath.js for arithmetic that is not bit-exact on every engine. Inputs
 * come from seeded draws through + - * /, floor and bit patterns only, so they are the same everywhere too.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import * as dmath from './dmath.js';

const FNS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10',
  'pow', 'cbrt', 'hypot', 'sinh', 'cosh', 'tanh'];

// ── doubles as bits ────────────────────────────────────────────────────────────────────────────────
const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
F64[0] = 1;
const HI = U32[1] === 0x3ff00000 ? 1 : 0, LO = 1 - HI;
const bits = (hi, lo = 0) => { U32[HI] = hi; U32[LO] = lo; return F64[0]; };
const hiOf = (x) => { F64[0] = x; return U32[HI]; };
const loOf = (x) => { F64[0] = x; return U32[LO]; };
const hex = (x) => { F64[0] = x; return U32[HI].toString(16).padStart(8, '0') + U32[LO].toString(16).padStart(8, '0'); };
// The k-th double above x (below it for k < 0), for finite x >= 0.
function nudge(x, k) {
  let hi = hiOf(x), lo = loOf(x) + k;
  while (lo < 0) { lo += 4294967296; hi -= 1; }
  while (lo >= 4294967296) { lo -= 4294967296; hi += 1; }
  return bits(hi, lo);
}
// Distance in ulps: 0 for the same number (+0 and -0 alike, NaN and NaN alike), Infinity if only one is NaN
// or infinite.
function ulps(a, b) {
  if (a !== a || b !== b) return (a !== a) === (b !== b) ? 0 : Infinity;
  if (a === b) return 0;
  if (a - a !== 0 || b - b !== 0) return Infinity;
  const ah = hiOf(a), al = loOf(a), bh = hiOf(b), bl = loOf(b);
  const d = (ah >>> 31) === (bh >>> 31)
    ? ((ah & 0x7fffffff) - (bh & 0x7fffffff)) * 4294967296 + (al - bl)
    : ((ah & 0x7fffffff) + (bh & 0x7fffffff)) * 4294967296 + (al + bl);
  return d < 0 ? -d : d;
}
const kind = (x) => (x !== x ? 'NaN' : x === 0 ? (1 / x > 0 ? '+0' : '-0') : x === Infinity ? '+inf' : x === -Infinity ? '-inf' : 'finite');

// How far dmath may sit from this runtime's Math, in ulps. Where both round faithfully (error under one ulp, as
// fdlibm's sin, exp, log, pow and the rest do) they can differ by one ulp at most. fdlibm's atan2, cosh, log10,
// sinh and tanh do not: against a 256-bit reference they err by up to 1.29, 1.23, 1.53, 1.60 and 1.96 ulps, in
// V8's Math and in dmath alike. On x64 the two are the same bits; a build of V8's C++ that fuses multiply-adds
// (arm64) errs on other inputs, so there they can sit as far apart as both errors together (measured on Linux
// arm64 over these inputs: atan2 and cosh 1, log10 0, sinh 2, tanh 3). hypot errs by up to 1.78 ulps too, but
// it is V8's own JavaScript-level algorithm, the same bits on every V8.
const SLACK = { atan2: 2, cosh: 2, log10: 3, sinh: 3, tanh: 4 };
const near = (fn, d, m) => kind(d) === kind(m) && ulps(d, m) <= (SLACK[fn] || 1);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── seeded geometry-range inputs ──────────────────────────────────────────────────────────────────
const PI = Math.PI;
const lin = (r, a, b) => a + (b - a) * r();
const int = (r, a, b) => a + Math.floor((b - a + 1) * r());
const pick = (r, list) => list[Math.floor(list.length * r())];
const sgn = (r, x) => (r() < 0.5 ? -x : x);
// A log-uniform magnitude in [2^e0, 2^(e1+1)), built from bits.
const mag = (r, e0, e1) => bits(((0x3ff + int(r, e0, e1)) << 20) | Math.floor(r() * 0x100000), Math.floor(r() * 4294967296));

function angle(r) {
  const u = r();
  if (u < 0.4) return [lin(r, -2 * PI, 2 * PI)];
  if (u < 0.6) return [lin(r, -200, 200)];
  if (u < 0.75) return [int(r, -1080, 1080) * (PI / 180)];                      // whole degrees
  if (u < 0.85) return [int(r, -48, 48) * PI / pick(r, [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24, 36])];
  if (u < 0.95) return [lin(r, 0, 1000) * (2 * PI)];                             // phase = t * 2pi
  return [sgn(r, mag(r, -30, -1))];
}
function unit(r) {
  const u = r();
  if (u < 0.6) return [lin(r, -1, 1)];
  if (u < 0.8) return [sgn(r, 1 - mag(r, -45, -2))];                            // near +-1
  return [sgn(r, mag(r, -40, -2))];
}
function logArg(r) {
  const u = r();
  if (u < 0.4) return [mag(r, -30, 30)];
  if (u < 0.7) return [lin(r, 0, 1000)];
  return [1 + sgn(r, mag(r, -50, -2))];                                          // near 1
}
const GEOMETRY = {
  sin: angle, cos: angle, tan: angle, asin: unit, acos: unit,
  atan(r) {
    const u = r();
    if (u < 0.5) return [lin(r, -10, 10)];
    if (u < 0.8) return [sgn(r, mag(r, -20, 20))];
    return [lin(r, -1000, 1000) / lin(r, -1000, 1000)];
  },
  atan2(r) {
    const u = r();
    if (u < 0.6) return [lin(r, -1000, 1000), lin(r, -1000, 1000)];
    if (u < 0.8) return [sgn(r, mag(r, -20, 20)), sgn(r, mag(r, -20, 20))];
    if (u < 0.9) return r() < 0.5 ? [lin(r, -10, 10), pick(r, [0, -0])] : [pick(r, [0, -0]), lin(r, -10, 10)];
    return [int(r, -10, 10), int(r, -10, 10)];                                   // grid directions
  },
  exp(r) {
    const u = r();
    if (u < 0.6) return [lin(r, -20, 20)];
    if (u < 0.8) return [lin(r, -745, 709.78)];
    return [sgn(r, mag(r, -40, 2))];
  },
  expm1: (r) => [r() < 0.6 ? lin(r, -3, 3) : sgn(r, mag(r, -50, 3))],
  log: logArg, log2: logArg, log10: logArg,
  log1p(r) {
    const u = r();
    if (u < 0.4) return [lin(r, -0.999, 10)];
    if (u < 0.7) return [sgn(r, mag(r, -50, -1))];
    return [mag(r, -10, 30)];
  },
  pow(r) {
    const u = r();
    if (u < 0.3) return [mag(r, -10, 10), lin(r, -8, 8)];
    if (u < 0.45) return [lin(r, 0, 100), int(r, -10, 10)];
    if (u < 0.55) return [10, int(r, -20, 20)];                                  // 10^k rounding steps
    if (u < 0.65) return [2, lin(r, -30, 30)];
    if (u < 0.75) return [lin(r, -50, 0), int(r, -9, 9)];
    if (u < 0.85) return [lin(r, 0, 10), pick(r, [0.5, 1 / 3, 1.5, 2.2, 1 / 2.2, 3, -0.5, 2])];
    return [1 + sgn(r, mag(r, -40, -2)), lin(r, -1e6, 1e6)];                     // near 1, large y
  },
  cbrt: (r) => [r() < 0.5 ? lin(r, -1000, 1000) : sgn(r, mag(r, -100, 100))],
  hypot(r) {
    const u = r();
    if (u < 0.5) return [lin(r, -1000, 1000), lin(r, -1000, 1000)];
    if (u < 0.6) return [sgn(r, mag(r, -30, 30)), sgn(r, mag(r, -30, 30))];
    return [lin(r, -100, 100), lin(r, -100, 100), lin(r, -100, 100)];
  },
  sinh: hyperbolic, cosh: hyperbolic,
  tanh(r) {
    const u = r();
    if (u < 0.6) return [lin(r, -5, 5)];
    if (u < 0.8) return [lin(r, -25, 25)];
    return [sgn(r, mag(r, -40, 1))];
  },
};
function hyperbolic(r) {
  const u = r();
  if (u < 0.6) return [lin(r, -10, 10)];
  if (u < 0.8) return [lin(r, -700, 700)];
  return [sgn(r, mag(r, -40, 1))];
}
const call = (f, a) => (a.length === 1 ? f(a[0]) : a.length === 2 ? f(a[0], a[1]) : a.length === 3 ? f(a[0], a[1], a[2]) : f(...a));

// ── hard cases: every reduction path, threshold and edge ──────────────────────────────────────────
const MAX = Number.MAX_VALUE, MIN = Number.MIN_VALUE, MIN_NORMAL = 2.2250738585072014e-308;
const around = (x, k = 2) => { const out = []; for (let i = -k; i <= k; i++) out.push(nudge(x, i)); return out; };
const both = (list) => list.flatMap((x) => [x, -x]);
const seeded = (seed, n, f) => { const r = mulberry32(seed); return Array.from({ length: n }, () => f(r)); };
const subnormal = (r) => bits(Math.floor(r() * 0x100000), Math.floor(r() * 4294967296));
const anyFinite = (r) => bits(Math.floor(r() * 0x7ff00000), Math.floor(r() * 4294967296));

const TRIG_HARD = both([
  ...around(PI / 4), ...around(bits(0x3fe921fb, 0)), ...around(bits(0x4002d97c, 0)), ...around(PI / 2, 3), ...around(PI, 3),
  ...around(3 * PI / 2, 3), ...around(2 * PI, 3), ...around(bits(0x413921fb, 0)), ...around(bits(0x413921fc, 0)),
  ...around(bits(0x3e400000, 0)), 1e22, 1e300, MAX, bits(0x7fe00000), 3.14e100, 1e-300, MIN, MIN_NORMAL,
  ...seeded(11, 256, (r) => bits(((0x413 + int(r, 0, 0x7fe - 0x413)) << 20) | Math.floor(r() * 0x100000), Math.floor(r() * 4294967296))),
  ...seeded(12, 256, (r) => nudge(int(r, 1, 1048576) * (PI / 2), int(r, -3, 3))),
  ...seeded(13, 128, (r) => nudge(int(r, 1048577, 1073741824) * (PI / 2), int(r, -3, 3))),
  ...seeded(14, 64, subnormal), ...seeded(15, 64, (r) => mag(r, -60, -20)),
]).map((x) => [x]);

const HARD = {
  sin: TRIG_HARD, cos: TRIG_HARD, tan: TRIG_HARD,
  asin: both([...around(1, 8), ...around(0.5), ...around(bits(0x3fef3333, 0)), ...around(bits(0x3e400000, 0)),
    ...around(bits(0x3c600000, 0)), MIN, MIN_NORMAL, ...seeded(21, 64, subnormal)]).map((x) => [x]),
  atan: both([...around(bits(0x3fdc0000, 0)), ...around(bits(0x3fe60000, 0)), ...around(bits(0x3ff30000, 0)),
    ...around(bits(0x40038000, 0)), ...around(bits(0x44100000, 0)), ...around(bits(0x3e400000, 0)), MAX, MIN,
    ...seeded(22, 128, anyFinite)]).map((x) => [x]),
  atan2: [
    ...(() => { const e = both([0, MIN, 1e-300, 1, 1e300, MAX, Infinity]); return e.flatMap((y) => e.map((x) => [y, x])); })(),
    ...seeded(23, 64, (r) => [1, nudge(bits((0x3ff + pick(r, [60, 61, -60, -61])) << 20), int(r, -2, 2))]),
    ...seeded(24, 64, (r) => [lin(r, -10, 10), 1]),
    ...seeded(25, 128, (r) => [sgn(r, anyFinite(r)), sgn(r, anyFinite(r))]),
  ],
  exp: both([...around(709.782712893384, 3), ...around(bits(0x40862e42, 0)), ...around(745.1332191019411, 3),
    ...around(708.3964185322641, 2), ...around(bits(0x3fd62e42, 0)), ...around(bits(0x3fd62e43, 0)),
    ...around(bits(0x3ff0a2b2, 0)), ...around(bits(0x3e300000, 0)), 1, 2, 1e-300, MIN,
    ...seeded(31, 128, (r) => lin(r, 708, 745.2)), ...seeded(32, 64, (r) => lin(r, 700, 709.79)),
    ...seeded(33, 128, (r) => int(r, -1074, 1023) * 0.6931471805599453)]).map((x) => [x]),
  expm1: both([...around(bits(0x4043687a, 0)), ...around(709.782712893384, 3), 38.9, 40, 1e300,
    ...around(bits(0x3c900000, 0)), ...around(bits(0x3fd62e42, 0)), ...around(bits(0x3ff0a2b2, 0)),
    ...around(13.862943611198906), ...around(38.816242111356935), MIN, ...seeded(34, 64, subnormal),
    ...seeded(35, 128, (r) => lin(r, -60, 60))]).map((x) => [x]),
  log1p: [-1, -nudge(1, 1), ...[1, 2, 3, 8, 1000].map((k) => -nudge(1, -k)), ...around(bits(0x3fd2bec4, 0)).map((x) => -x),
    ...around(bits(0x3fda827a, 0)), ...both([...around(bits(0x3e200000, 0)), ...around(bits(0x3c900000, 0)), MIN, 1e-300]),
    ...around(bits(0x43400000, 0)), MAX, ...seeded(36, 64, subnormal), ...seeded(37, 64, anyFinite)].map((x) => [x]),
  pow: [
    ...seeded(41, 32, (r) => [2, lin(r, 1023.9, 1024.1)]), ...seeded(42, 16, (r) => [10, lin(r, 308.2, 308.3)]),
    [MAX, 1], [MAX, 1.0000000000000002], [nudge(1, 1), 4611686018427387904], [0.5, -1024.5],
    ...seeded(43, 32, (r) => [2, lin(r, -1075.5, -1021.5)]), ...seeded(44, 32, (r) => [0.5, lin(r, 1021, 1075.5)]),
    ...seeded(45, 16, (r) => [10, lin(r, -324, -307)]), [2, -1076], [10, -330],
    ...seeded(46, 32, (r) => [nudge(1, int(r, -64, 64)), sgn(r, mag(r, 31, 70))]),
    ...seeded(47, 32, (r) => [1 + sgn(r, mag(r, -40, -21)), sgn(r, mag(r, 20, 40))]),
    [-2, 3], [-2, 4], [-3, 4503599627370497], [-3, 9007199254740992], [-8, 1 / 3], [-0.5, -3], [-1e300, 2], [-1e-300, -2],
    [-1e-300, -3], [-7, 1025], [MIN, 2], [1e-310, 0.5], [1e-310, -1], [1e-310, 1.5], [MIN, 0.5], [MIN, -0.5],
    ...[0.5, -0.5, 2, -2, 1, -1, 3, -3].flatMap((y) => [0, -0, 1, -1, 2, 3, 0.1, 1e300, MIN, -2, -MIN].map((x) => [x, y])),
    ...Array.from({ length: 61 }, (_, i) => [10, i - 30]), ...seeded(48, 32, (r) => [2, int(r, -1074, 1023)]),
    [3, 20], [7, 18], [5, 22], [9, 16], [11, 15], [13, 14], [-3, 33], [10, -4], [Math.E, 3],
    ...seeded(49, 64, (r) => [nudge(1, int(r, -1000, 1000)), lin(r, -1e6, 1e6)]),
    ...seeded(50, 64, (r) => [anyFinite(r), lin(r, -4, 4)]),
  ],
  cbrt: both([...seeded(51, 32, subnormal), MIN, MIN_NORMAL, MAX, 27, 64, 1e-300, 0.001, 1e300,
    ...seeded(52, 32, (r) => bits((0x3ff + int(r, -1022, 1023)) << 20)), ...Array.from({ length: 100 }, (_, i) => (i + 1) * (i + 1) * (i + 1)),
    ...seeded(53, 64, anyFinite)]).map((x) => [x]),
  hypot: [[1e300, 1e300], [1e-300, 1e-300], [MAX, MAX], [MAX, 1], [MIN, MIN], [MIN, 1e-320], [3, 4], [5, 12], [1, 1e-8],
    [1, 1e-17], [1e308, 1e308, 1e308], [MIN, MIN, MIN], [1, 2, 3, 4, 5, 6, 7, 8, 9], [1e300, 1e300, 1e300, 1e300, 1e300],
    [0, 0, 0, 0], [-0, -0], [1, -1, 1, -1, 1], ...seeded(54, 32, (r) => seeded(int(r, 1, 1e6), int(r, 4, 16), (q) => lin(q, -100, 100))),
    ...seeded(55, 64, (r) => [sgn(r, anyFinite(r)), sgn(r, anyFinite(r))]), ...seeded(56, 32, (r) => [anyFinite(r), anyFinite(r), anyFinite(r)])],
  sinh: HYPER_HARD(61), cosh: HYPER_HARD(62),
  tanh: both([...around(22), ...around(1), ...around(bits(0x3e300000, 0)), ...seeded(63, 32, (r) => lin(r, -30, 30)),
    ...seeded(64, 32, subnormal)]).map((x) => [x]),
};
HARD.acos = HARD.asin;
HARD.log = HARD.log2 = HARD.log10 = [...seeded(71, 64, subnormal), MIN, bits(0x000fffff, 0xffffffff), MIN_NORMAL, MAX,
  ...around(1, 64), ...seeded(72, 64, (r) => 1 + sgn(r, mag(r, -60, -20))), ...around(bits(0x3ff6a09e, 0x667f3bcd), 3),
  ...around(bits(0x3fe6a09e, 0x667f3bcd), 3), ...seeded(73, 64, (r) => bits((0x3ff + int(r, -1022, 1023)) << 20)),
  1e-22, 1e-15, 1e-10, 1e-5, 0.001, 0.01, 0.1, 10, 100, 1000, 1e5, 1e10, 1e15, 1e20, 1e22, 1e100, 1e300, Math.E,
  ...seeded(74, 64, anyFinite)].map((x) => [x]);
function HYPER_HARD(seed) {
  return both([...around(22), ...around(bits(0x40862e42, 0)), ...around(710.4758600739439, 3), 710.5, 711, ...around(bits(0x3e300000, 0)),
    ...around(bits(0x3fd62e43, 0)), ...around(bits(0x3c800000, 0)), ...around(1), ...seeded(seed, 32, (r) => lin(r, 700, 711)),
    ...seeded(seed + 100, 32, subnormal)]).map((x) => [x]);
}

const SPECIALS = [0, -0, 1, -1, 0.5, -0.5, 2, -2, 3, -3, Infinity, -Infinity, NaN, MIN, -MIN, MAX, -MAX, MIN_NORMAL, 1e-300, 1e300,
  PI, -PI, Math.E, 1.0000000000000002, 0.9999999999999999, 9007199254740992, -9007199254740994, 0.1, 10, 1 / 3];
const TWO_ARGS = new Set(['atan2', 'pow', 'hypot']);

// The golden input set of one function: 2048 geometry-range draws, the hard cases, and the specials (paired
// for the two-argument functions).
function goldenInputs(fn, index) {
  const r = mulberry32(0x5eed0000 + index);
  const out = Array.from({ length: 2048 }, () => GEOMETRY[fn](r));
  out.push(...HARD[fn]);
  if (TWO_ARGS.has(fn)) for (const a of SPECIALS) for (const b of SPECIALS) out.push([a, b]);
  else for (const a of SPECIALS) out.push([a]);
  return out;
}
// sha256 of the results as little-endian doubles, first 16 hex digits.
function digest(values) {
  const view = new DataView(new ArrayBuffer(values.length * 8));
  values.forEach((v, i) => view.setFloat64(i * 8, v, true));
  return createHash('sha256').update(new Uint8Array(view.buffer)).digest('hex').slice(0, 16);
}

// The contract. Recorded on x64 Node 22.12.0, 22.23.2 and 24.8.0 and checked equal on arm64 Node 22.12.0,
// 22.23.2 and 24.8.0.
const GOLDEN = {
  inputs: 'f7420101c94cbb44',
  sin: 'f6420a3d4de4bd5b', cos: 'f5b0e73b44c28e3e', tan: '9aec352b5450c41b', asin: 'f437f9f596a8f8c6', acos: '65e60b3535577eff',
  atan: 'f982b11aaccd711d', atan2: 'da23b9381a04a50e', exp: 'b9c590dba102adb5', expm1: '41cad01186517ef7', log: '0552b879c970bb4e',
  log1p: 'c516724849779da3', log2: '8602b55f6a41441a', log10: '407b0151c80029a4', pow: 'fc0c72022db2a443', cbrt: 'f977c1854dd4a490',
  hypot: '7a99a5d1d6d06af9', sinh: '1ee1cb161ad2af2c', cosh: '696f809688926121', tanh: 'c986a25c448b86ba',
  all: '23b9eb1e5ed99e46',
};

describe('dmath: the golden digests', () => {
  it('every function over the fixed input set gives the pinned bytes', () => {
    const got = {}, all = [], args = [];
    FNS.forEach((fn, i) => {
      const inputs = goldenInputs(fn, i), f = dmath[fn];
      const results = inputs.map((a) => call(f, a));
      for (const a of inputs) args.push(a.length, ...a);
      got[fn] = digest(results);
      all.push(...results);
    });
    expect({ inputs: digest(args), ...got, all: digest(all) }).toEqual(GOLDEN);
  });
});

describe('dmath: ECMAScript special values', () => {
  const Q = PI / 4, H = PI / 2;
  const SPEC = [
    ...['sin', 'tan', 'asin', 'atan', 'expm1', 'log1p', 'cbrt', 'sinh', 'tanh'].flatMap((fn) => [[fn, [0], 0], [fn, [-0], -0]]),
    ...FNS.filter((fn) => fn !== 'hypot').map((fn) => [fn, fn === 'atan2' || fn === 'pow' ? [NaN, 1] : [NaN], NaN]),
    ['sin', [Infinity], NaN], ['sin', [-Infinity], NaN], ['cos', [Infinity], NaN], ['cos', [-Infinity], NaN], ['tan', [Infinity], NaN],
    ['tan', [-Infinity], NaN], ['cos', [0], 1], ['cos', [-0], 1],
    ['asin', [1.0000000000000002], NaN], ['asin', [-1.0000000000000002], NaN], ['asin', [Infinity], NaN], ['asin', [1], H], ['asin', [-1], -H],
    ['acos', [1], 0], ['acos', [-1], PI], ['acos', [0], H], ['acos', [1.0000000000000002], NaN], ['acos', [-Infinity], NaN],
    ['atan', [Infinity], H], ['atan', [-Infinity], -H],
    ['exp', [0], 1], ['exp', [-0], 1], ['exp', [Infinity], Infinity], ['exp', [-Infinity], 0], ['exp', [1], Math.E],
    ['expm1', [Infinity], Infinity], ['expm1', [-Infinity], -1],
    ...['log', 'log2', 'log10'].flatMap((fn) => [[fn, [0], -Infinity], [fn, [-0], -Infinity], [fn, [1], 0], [fn, [-1], NaN],
      [fn, [-MIN], NaN], [fn, [-Infinity], NaN], [fn, [Infinity], Infinity]]),
    ['log2', [8], 3], ['log2', [0.125], -3], ['log10', [1000], 3], ['log10', [1e22], 22], ['log10', [0.001], -3],
    ['log1p', [-1], -Infinity], ['log1p', [-1.0000000000000002], NaN], ['log1p', [-Infinity], NaN], ['log1p', [Infinity], Infinity],
    ['cbrt', [Infinity], Infinity], ['cbrt', [-Infinity], -Infinity], ['cbrt', [27], 3], ['cbrt', [-8], -2],
    ['sinh', [Infinity], Infinity], ['sinh', [-Infinity], -Infinity], ['cosh', [0], 1], ['cosh', [-0], 1],
    ['cosh', [Infinity], Infinity], ['cosh', [-Infinity], Infinity], ['tanh', [Infinity], 1], ['tanh', [-Infinity], -1],
    // atan2: ECMAScript 21.3.2.8, in its order
    ['atan2', [1, NaN], NaN], ['atan2', [Infinity, Infinity], Q], ['atan2', [Infinity, -Infinity], 3 * Q], ['atan2', [Infinity, 1], H],
    ['atan2', [-Infinity, Infinity], -Q], ['atan2', [-Infinity, -Infinity], -3 * Q], ['atan2', [-Infinity, -1], -H],
    ['atan2', [0, 1], 0], ['atan2', [0, 0], 0], ['atan2', [0, -0], PI], ['atan2', [0, -1], PI], ['atan2', [0, Infinity], 0], ['atan2', [0, -Infinity], PI],
    ['atan2', [-0, 1], -0], ['atan2', [-0, 0], -0], ['atan2', [-0, -0], -PI], ['atan2', [-0, -1], -PI], ['atan2', [-0, -Infinity], -PI],
    ['atan2', [1, Infinity], 0], ['atan2', [1, -Infinity], PI], ['atan2', [1, 0], H], ['atan2', [1, -0], H],
    ['atan2', [-1, Infinity], -0], ['atan2', [-1, -Infinity], -PI], ['atan2', [-1, 0], -H], ['atan2', [-1, -0], -H],
    // pow: Number::exponentiate, in its order
    ['pow', [1, NaN], NaN], ['pow', [NaN, 0], 1], ['pow', [NaN, -0], 1], ['pow', [Infinity, 0], 1], ['pow', [0, -0], 1],
    ['pow', [Infinity, 0.5], Infinity], ['pow', [Infinity, -2], 0], ['pow', [-Infinity, 3], -Infinity], ['pow', [-Infinity, 2], Infinity],
    ['pow', [-Infinity, 0.5], Infinity], ['pow', [-Infinity, -3], -0], ['pow', [-Infinity, -2], 0], ['pow', [-Infinity, -0.5], 0],
    ['pow', [0, 3], 0], ['pow', [0, 0.5], 0], ['pow', [0, -3], Infinity], ['pow', [0, -0.5], Infinity],
    ['pow', [-0, 3], -0], ['pow', [-0, 2], 0], ['pow', [-0, 0.5], 0], ['pow', [-0, -3], -Infinity], ['pow', [-0, -2], Infinity], ['pow', [-0, -0.5], Infinity],
    ['pow', [2, Infinity], Infinity], ['pow', [-2, Infinity], Infinity], ['pow', [0.5, Infinity], 0], ['pow', [-0.5, Infinity], 0],
    ['pow', [1, Infinity], NaN], ['pow', [-1, Infinity], NaN], ['pow', [1, -Infinity], NaN], ['pow', [-1, -Infinity], NaN],
    ['pow', [2, -Infinity], 0], ['pow', [-2, -Infinity], 0], ['pow', [0.5, -Infinity], Infinity], ['pow', [-0.5, -Infinity], Infinity],
    ['pow', [-2, 0.5], NaN], ['pow', [-8, 1 / 3], NaN], ['pow', [-1, 0.5], NaN], ['pow', [-2, 3], -8], ['pow', [-2, -1], -0.5],
    ['pow', [4, 0.5], 2], ['pow', [3, 2], 9], ['pow', [10, -4], 0.0001], ['pow', [2, -1074], MIN], ['pow', [2, 1024], Infinity],
    // hypot: an infinity beats a NaN; all zeros give +0
    ['hypot', [], 0], ['hypot', [-0], 0], ['hypot', [-0, -0], 0], ['hypot', [-0, -0, -0, -0], 0], ['hypot', [-3], 3],
    ['hypot', [NaN, Infinity], Infinity], ['hypot', [-Infinity, NaN], Infinity], ['hypot', [NaN, 1, -Infinity], Infinity],
    ['hypot', [NaN, 1], NaN], ['hypot', [1, 2, NaN], NaN], ['hypot', [NaN, 1, 2, 3], NaN], ['hypot', [3, -4], 5], ['hypot', [2, 3, 6], 7],
  ];
  it.each(SPEC.map(([fn, a, want]) => [`${fn}(${a.map((v) => Object.is(v, -0) ? '-0' : String(v)).join(', ')})`, fn, a, want]))(
    '%s', (_, fn, a, want) => {
      expect(Object.is(call(dmath[fn], a), want)).toBe(true);
    });

  it('on the grid of special values, NaN, signed zeros and infinities come out where Math puts them', () => {
    const bad = [];
    for (const fn of FNS) {
      const pairs = TWO_ARGS.has(fn) ? SPECIALS.flatMap((a) => SPECIALS.map((b) => [a, b])) : SPECIALS.map((a) => [a]);
      for (const a of pairs) {
        const d = call(dmath[fn], a), m = call(Math[fn], a);
        if (!near(fn, d, m)) bad.push(`${fn}(${a.join(', ')}) = ${d}, Math: ${m}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('NaN comes out as the one quiet NaN on every CPU (V8 hands back 0xfff8... on x64, 0x7ff8... on arm64)', () => {
    const nans = [dmath.sin(Infinity), dmath.cos(-Infinity), dmath.tan(NaN), dmath.log(-1), dmath.log1p(-2), dmath.asin(2),
      dmath.acos(-2), dmath.pow(-2, 0.5), dmath.pow(1, Infinity), dmath.pow(NaN, 1), dmath.atan2(NaN, 1), dmath.exp(NaN),
      dmath.expm1(NaN), dmath.cbrt(NaN), dmath.sinh(Infinity - Infinity), dmath.cosh(NaN), dmath.tanh(NaN), dmath.hypot(NaN, 1)];
    expect(new Set(nans.map(hex))).toEqual(new Set(['7ff8000000000000']));
  });
});

describe('dmath: arguments, like Math', () => {
  it('coerces each argument with ToNumber, left to right', () => {
    const bad = [];
    for (const v of ['1.5', '', ' 2 ', '0x10', '1e-3', 'x', null, undefined, true, false, [2], [], {}, { valueOf: () => 0.25 }]) {
      for (const fn of FNS) {
        const a = TWO_ARGS.has(fn) ? [v, 2] : [v];
        if (!near(fn, call(dmath[fn], a), call(Math[fn], a))) bad.push(`${fn}(${String(v)})`);
      }
    }
    expect(bad).toEqual([]);
    const order = [];
    const spy = (name, v) => ({ valueOf: () => { order.push(name); return v; } });
    dmath.atan2(spy('y', 1), spy('x', 2));
    dmath.pow(spy('x', 2), spy('y', 3));
    dmath.hypot(spy('a', 1), spy('b', 2), spy('c', 3), spy('d', 4));
    expect(order).toEqual(['y', 'x', 'x', 'y', 'a', 'b', 'c', 'd']);
    expect(() => dmath.sin(1n)).toThrow(TypeError);
    expect(() => dmath.pow(2, Symbol('y'))).toThrow(TypeError);
    expect(() => dmath.hypot(1, 2n)).toThrow(TypeError);
  });

  it('missing arguments are undefined (NaN), and the lengths are Math\'s', () => {
    expect(Object.is(dmath.sin(), NaN)).toBe(true);
    expect(Object.is(dmath.pow(2), NaN)).toBe(true);
    expect(Object.is(dmath.atan2(1), NaN)).toBe(true);
    expect(Object.is(dmath.hypot(), 0)).toBe(true);
    for (const fn of FNS) expect(dmath[fn].length).toBe(Math[fn].length);
  });
});

describe("dmath against this runtime's Math", () => {
  const N = 200_000;
  it.each(FNS.map((fn, i) => [fn, i]))('%s: within its ulp bound on 200k seeded geometry-range inputs', (fn, i) => {
    const r = mulberry32(0x6e0e0000 + i), gen = GEOMETRY[fn], f = dmath[fn], m = Math[fn];
    let worst = 0, at = null;
    for (let k = 0; k < N; k++) {
      const a = gen(r), u = ulps(call(f, a), call(m, a));
      if (u > worst) { worst = u; at = a; }
    }
    expect(worst, `${fn}(${at && at.join(', ')})`).toBeLessThanOrEqual(SLACK[fn] || 1);
  });
});

describe('dmath.js: only engine-exact arithmetic', () => {
  const src = readFileSync(new URL('./dmath.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\\n]|\\.)*'/g, "''");

  it('uses no Math member but sqrt, abs, floor, trunc and fround, and no **, %, DataView, BigInt, Intl or Date', () => {
    const members = new Set([...code.matchAll(/\bMath\s*\.\s*([\w$]+)/g)].map((m) => m[1]));
    for (const m of members) expect(['sqrt', 'abs', 'floor', 'trunc', 'fround']).toContain(m);
    expect(code).not.toMatch(/\bMath\b(?!\s*\.\s*[\w$])/);                        // no Math[...] and no bare Math
    expect(code).not.toMatch(/\*\*/);
    expect(code).not.toMatch(/%/);
    expect(code).not.toMatch(/\b(DataView|BigInt|Intl|Date|Number|parseFloat|parseInt|eval|Function|globalThis|Reflect|WebAssembly|Atomics|toFixed|toPrecision|toExponential)\b/);
    expect(code).not.toMatch(/\b\d+n\b/);                                         // BigInt literals
    expect(code).not.toMatch(/\bimport\b|\brequire\b/);                           // self-contained
    expect(code).toMatch(/new Float64Array\(1\)/);                                // word access through one scratch double
  });

  it('keeps the fdlibm and V8 notices their licenses ask to preserve', () => {
    expect(src).toContain('Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.');
    expect(src).toContain('Copyright (C) 2004 by Sun Microsystems, Inc. All rights reserved.');
    expect(src).toContain('Copyright 2006-2011, the V8 project authors. All rights reserved.');
  });
});
