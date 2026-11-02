/**
 * load — the body's motion through a stride integrated from the hooves' forces, never keyed. Periodic, so it is solved
 * in the frequency domain: the stride's signals sampled at a fixed N, their harmonics up to K, each harmonic integrated
 * or filtered exactly, the result evaluated at any phase. Deterministic (fixed N, K; no iteration to converge).
 *
 *  - FORCES: each hoof pushes up through its stance as a half-sine (a single hump), or the walk's double hump
 *    (`sin πu + b·sin 3πu`, MERKENS 1993), its impulse over the stride its pair's share of the weight. The shares come
 *    from where the hooves stand about the centre of mass, so the stride's mean moment is zero.
 *  - HEAVE: z'' = g·(ΣF − 1): in a suspension ΣF = 0 and the body falls at g, a parabola by construction.
 *  - PITCH: θ'' = g·Σ F·y / k², y each hoof's place fore-aft of the centre of mass, k the radius of gyration: the
 *    canter's and the gallop's rock come out of the footfalls.
 *  - PENDULUMS: the neck (and the tail) as a damped oscillator on the withers (the croup), driven by its base's
 *    vertical acceleration and the trunk's pitch: the nod's size and its lag behind the forehand are the response.
 */
import { G } from './reference.js';

const TAU = 2 * Math.PI;
export const N = 256, K = 48;
const frac = (x) => x - Math.floor(x);

/** a periodic signal's harmonics: C[k] = [re, im], k = 0..K, of s sampled at N points over one period */
export function harmonics(s) {
  const C = [];
  for (let k = 0; k <= K; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) { const a = -TAU * k * n / N; re += s[n] * Math.cos(a); im += s[n] * Math.sin(a); }
    const w = k === 0 ? 1 / N : 2 / N;
    C.push([re * w, im * w]);
  }
  return C;
}
/** evaluate harmonics at phase t ∈ [0, 1) */
export function evaluate(C, t) {
  let v = 0;
  for (let k = 0; k < C.length; k++) { const a = TAU * k * t; v += C[k][0] * Math.cos(a) - C[k][1] * Math.sin(a); }
  return v;
}
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
/** the harmonics passed through a transfer function H(k) → [re, im] (k = 0 dropped: a mean of zero) */
export const filter = (C, H) => C.map((c, k) => (k === 0 ? [0, 0] : cmul(c, H(k))));
/** twice integrated over a stride of T seconds (the mean dropped) */
export const integrate2 = (C, T) => filter(C, (k) => [-1 / (TAU * k / T) ** 2, 0]);
/** a damped oscillator x'' + 2ζω x' + ω² x = s, its steady periodic response */
export const oscillate = (C, T, omega, zeta) => filter(C, (k) => { const w = TAU * k / T; return cdiv([1, 0], [omega * omega - w * w, 2 * zeta * omega * w]); });
/** the second derivative's harmonics (for an acceleration from a displacement) */
export const accel = (C, T) => filter(C, (k) => [-((TAU * k / T) ** 2), 0]);

/** a hoof's vertical force (body weights) at its stance fraction u ∈ [0, 1) */
export function hoofForce(u, A, b) { return u < 0 || u >= 1 ? 0 : A * (Math.sin(Math.PI * u) + b * Math.sin(3 * Math.PI * u)); }

/**
 * The stride's loads and the body's response. `limbs` [{ id, phase, share, yc }], `duty`, `L` the stride (m, signed),
 * `T` its period (s), `b` the force's double hump, `k` the radius of gyration, `arms` { withers, croup } fore-aft of the
 * centre of mass, `neck` / `tail` { omega, zeta, gain, r }. Returns the harmonics and the per-limb force function.
 */
export function strideLoads({ limbs, duty, L, T, b = 0, k = 0.75, arms, neck, tail }) {
  const Is = 2 / Math.PI + b * 2 / (3 * Math.PI);
  const amp = Object.fromEntries(limbs.map((l) => [l.id, l.share / (duty * Is)]));
  const forceOf = (l, t) => hoofForce(frac(t - l.phase) / duty, amp[l.id], b);
  const yOf = (l, t) => l.yc + L * (duty / 2 - frac(t - l.phase));      // the contact's place fore-aft while it stands
  const sumF = [], mom = [];
  for (let n = 0; n < N; n++) {
    const t = n / N;
    let f = 0, m = 0;
    for (const l of limbs) { const F = forceOf(l, t); f += F; m += F * yOf(l, t); }
    sumF.push(G * (f - 1)); mom.push(G * m / (k * k));
  }
  const zAcc = harmonics(sumF), pAcc = harmonics(mom);
  zAcc[0] = [0, 0]; pAcc[0] = [0, 0];
  const heave = integrate2(zAcc, T), pitch = integrate2(pAcc, T);
  // the pendulums' drives: their base's vertical acceleration (heave + pitch × arm) scaled to an angular one, and the
  // trunk's own pitch acceleration (the base turns under them)
  const drive = (arm, P) => zAcc.map((c, kk) => [(-P.gain * (c[0] + pAcc[kk][0] * arm) / P.r) - pAcc[kk][0], (-P.gain * (c[1] + pAcc[kk][1] * arm) / P.r) - pAcc[kk][1]]);
  const nod = neck ? oscillate(drive(arms.withers, neck), T, neck.omega, neck.zeta) : null;
  const swish = tail ? oscillate(drive(arms.croup, tail), T, tail.omega, tail.zeta) : null;
  return { heave, pitch, nod, swish, zAcc, pAcc, forceOf, yOf, amp };
}
