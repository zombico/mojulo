/**
 * THE TROT ON ALL FOURS, from the mechanics: the feature animal's trot laid out the way the horse study solves its
 * gaits, made dimensionless so a round body on short legs trots as its own legs let it. Rig-agnostic laws, posed on the
 * mascot's rig (feature-body.js trotted):
 *
 *   THE BEAT      a two-beat diagonal: the left hind with the right fore, half a stride on the right hind with the left
 *                 fore, the hind a moment before its fore (advanced placement): HILDEBRAND 1965, BACK 1995.
 *   THE STRIDE    dynamic similarity (Alexander & Jayes 1983): animals of one build move alike at one Froude number
 *                 v²/(g·h), h the hip's height. At `froude` the speed, the stride's frequency and the duty are the
 *                 reference horse's trot (CLAYTON 1994, HEGLUND 1974) scaled to this hip; the stance is cut to what
 *                 the shorter pair of legs reaches (a short leg takes short steps, and quicker ones).
 *   ONE GROUND    every planted foot, fore and hind, slides back at the one ground speed (in place, a treadmill), so
 *                 no paw skates; the swing is laid between the stance it leaves and the one it lands in, C1 at both
 *                 ends (a quintic, the stance's own speed added at either end: no pop at lift-off or touchdown), lifted
 *                 by a bump that peaks early in the swing (FOLD.trot's 0.40), the paw swung back to meet the ground.
 *   THE BOUNCE    the body's heave integrated from the feet's vertical forces (each a half-sine through its stance,
 *                 their impulse over the stride the weight): z'' = g·(ΣF − 1), two dips a stride, exaggerated by
 *                 `bounce` for the style; the trunk twisting between its girdles as the diagonals take the weight.
 *   FOLLOW-THROUGH the head on its neck and the tail on the rump as damped pendulums driven by the trunk's heave: the
 *                 nod lags the bounce (the horse study's NECK), the tail answers it later and looser.
 *
 * Pure and deterministic: fixed samples and harmonics, no iteration to converge.
 *
 *   trotMeasures({ hip, reachH, reachF, spanH, spanF }) → { scale, speed, f, seconds, duty, stride, stance, cut }
 *   trotSignals(M) → { feet(id, t) → [dy, dz], heave(t), twist(t), nod(t), swish(t) }
 */
const TAU = 2 * Math.PI, G = 9.81, frac = (x) => x - Math.floor(x);
const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;

/** The reference horse's hip (m): the leg of dynamic similarity (the horse study's REFERENCE_HORSE). */
export const TROT_REFERENCE_HIP = 1.32;

/**
 * The trot's numbers. `feet` each foot's touchdown in the stride (LH = 0); `f` and `duty` as lines in the reference
 * speed (m/s), the horse's trot (CLAYTON 1994); `froude` where in the trot the stylized body goes (the reference horse's
 * working trot is ≈ 1.2; 0.6 a jog, its suspension short); `lift` the swing's clearance at the reference (m, fore and
 * hind, ≈ BACK 1995), `show` its exaggeration for the style; `peak` where in the swing it peaks; `impact` the share of the
 * ground's speed a paw matches before it lands; `reach` the share of a leg the stance may stretch it to; `column` the share of its arm a standing foreleg's shoulder stands over the floor, `rise` the most the trunk is tipped up
 * for it (degrees), `give` the share of the bounce the front girdle takes (the forelegs a column, the haunches the rest); `crouch` how far the body sinks for it, a share of the hip; `bounce` the
 * heave's exaggeration; `twist` the trunk's twist at full diagonal load (the spine's axial drive); `nod` and `swish` the
 * pendulums (ω at the reference, scaled by √(g/leg); ζ; gain; the result's limit in degrees); `keys` the clip's keys, the
 * packer's sample count, so every packed sample is a key and nothing is blended between two.
 */
export const FEATURE_TROT = Object.freeze({
  feet: Object.freeze({ LH: 0, RF: 0.015, RH: 0.5, LF: 0.515 }),
  f: [1.2, 0.06], duty: [0.5, -0.02], froude: 0.6,
  lift: Object.freeze({ fore: 0.16, hind: 0.11 }), show: 1.8, peak: 0.4, impact: 0.7,
  reach: 0.995, column: 0.97, rise: 35, give: 0.25, crouch: 0.06, bounce: 2.5, twist: 0.12,
  nod: Object.freeze({ omega: TAU * 1.6, zeta: 0.6, gain: 2.2, most: 7 }),
  swish: Object.freeze({ omega: TAU * 1.2, zeta: 0.3, gain: 3, most: 12 }),
  keys: 12,
});

/** the stride at the trot's Froude for this hip, its stance cut to what both pairs of legs reach (`spanH`, `spanF`: the
 *  most each pair's foot may travel fore and aft of its stance's middle, m) */
export function trotMeasures({ hip, spanH, spanF }, T = FEATURE_TROT) {
  const scale = hip / TROT_REFERENCE_HIP, v0 = Math.sqrt(T.froude * G * hip), vRef = v0 / Math.sqrt(scale);
  const f = (T.f[0] + T.f[1] * vRef) / Math.sqrt(scale), duty = T.duty[0] + T.duty[1] * vRef;
  const stance0 = (duty * v0) / f, most = 2 * Math.min(spanH, spanF), stance = Math.min(stance0, most);
  // (cut short, the stride is shorter at the same cadence: the animal goes slower, never stretches past its reach)
  const speed = (stance / duty) * f;
  return { scale: r4(scale), speed: r4(speed), f: r4(f), seconds: r4(1 / f), duty: r4(duty), stride: r4(stance / duty), stance: r4(stance), ...(stance < stance0 ? { cut: r4(stance / stance0) } : {}) };
}

// ── the stride's signals in the frequency domain (the horse study's load.js, in brief) ──
const N = 256, K = 24;
function harmonics(s) {
  const C = [];
  for (let k = 0; k <= K; k++) { let re = 0, im = 0; for (let n = 0; n < N; n++) { const a = (-TAU * k * n) / N; re += s[n] * Math.cos(a); im += s[n] * Math.sin(a); } const w = k ? 2 / N : 1 / N; C.push([re * w, im * w]); }
  return C;
}
const evaluate = (C, t) => C.reduce((v, c, k) => v + c[0] * Math.cos(TAU * k * t) - c[1] * Math.sin(TAU * k * t), 0);
const filter = (C, H) => C.map((c, k) => { if (!k) return [0, 0]; const h = H(k); return [c[0] * h[0] - c[1] * h[1], c[0] * h[1] + c[1] * h[0]]; });
const integrate2 = (C, T) => filter(C, (k) => [-1 / ((TAU * k) / T) ** 2, 0]);
const oscillate = (C, T, w0, z) => filter(C, (k) => { const w = (TAU * k) / T, a = w0 * w0 - w * w, b = 2 * z * w0 * w, d = a * a + b * b; return [a / d, -b / d]; });

/** a smooth bump, 0 with zero slope at both ends, 1 at `peak` (the horse study's legs.js) */
export const bump = (v, peak = 0.5) => { if (v <= 0 || v >= 1) return 0; const w = v ** (Math.log(0.5) / Math.log(peak)); return Math.sin(Math.PI * w) ** 2; };
/** the swing's path along one axis: a quintic from p0 to p1, still at both ends, and the stance's own speed added over a
 *  short span at each end (m0 leaving, m1 arriving, per unit of swing): C1 at lift-off and touchdown (legs.js swingPath) */
export function swingPath(p0, m0, p1, m1, v, tauLo = 0.08, tauTd = 0.12) {
  const S = v * v * v * (10 - 15 * v + 6 * v * v), a = v < tauLo ? v * (1 - v / tauLo) ** 2 : 0, w = 1 - v, b = w < tauTd ? -w * (1 - w / tauTd) ** 2 : 0;
  return p0 + (p1 - p0) * S + m0 * a + m1 * b;
}

/**
 * The stride's signals for measures M (trotMeasures) and the swing's lifts (m, fore and hind): each foot's place fore
 * and aft of its stance's middle and its rise off the floor, the trunk's heave (m, about its mean), its twist (−1 … 1,
 * + the chest turned toward the right fore as it lands), the nod and the swish (degrees, + down).
 */
export function trotSignals(M, lift, T = FEATURE_TROT) {
  const { duty, stance } = M, Ts = 1 / M.f, half = stance / 2, ground = -stance / duty;   // (dy per unit of the stride)
  const feet = (id, t) => {
    const u = frac(t - T.feet[id]);
    if (u < duty) return [half - stance * (u / duty), 0];
    const v = (u - duty) / (1 - duty), m = ground * (1 - duty);
    return [swingPath(-half, m, half, T.impact * m, v), lift[id[1] === 'F' ? 'fore' : 'hind'] * bump(v, T.peak)];
  };
  // (each foot's vertical force a half-sine through its stance, a quarter of the weight's impulse each)
  const force = (id, t) => { const u = frac(t - T.feet[id]) / duty; return u < 1 ? (Math.PI / (8 * duty)) * Math.sin(Math.PI * u) : 0; };
  const sum = [], diag = [];
  for (let n = 0; n < N; n++) { const t = n / N; sum.push(G * (['LH', 'RF', 'RH', 'LF'].reduce((s, id) => s + force(id, t), 0) - 1)); diag.push(force('LH', t) + force('RF', t) - force('RH', t) - force('LF', t)); }
  const zAcc = harmonics(sum), heave = integrate2(zAcc, Ts), dMax = Math.max(...diag.map(Math.abs)) || 1;
  // (the twist: the diagonal's load difference, its low harmonics, so it turns smoothly between the beats)
  const twist = harmonics(diag.map((x) => x / dMax)).map((c, k) => (k > 3 ? [0, 0] : c));
  // (the pendulums: driven by the trunk's vertical acceleration, their natural frequency scaled to this leg)
  const pend = (P) => oscillate(zAcc.map((c) => [-P.gain * c[0], -P.gain * c[1]]), Ts, P.omega / Math.sqrt(M.scale), P.zeta);
  const nod = pend(T.nod), swish = pend(T.swish);
  const limit = (C, most) => { let a = 0; for (let n = 0; n < 64; n++) a = Math.max(a, Math.abs(evaluate(C, n / 64))); const s = a > 0 ? Math.min(1, (most * Math.PI) / 180 / a) : 0; return (t) => (evaluate(C, t) * s * 180) / Math.PI; };
  return { feet, heave: (t) => T.bounce * evaluate(heave, t), twist: (t) => evaluate(twist, t), nod: limit(nod, T.nod.most), swish: limit(swish, T.swish.most), force };
}
