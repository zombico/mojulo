/**
 * idle — a mount at rest: the stand, and what a standing horse does with it. Solved like everything else (the legs
 * from their mechanics on the build's own stand, the trunk by bodyPoint); nothing keyed but the timing.
 *
 *  - RESTING A HIND (the `cocked` support): the resting hoof tips onto its toe where it stood (the heel lifts, the toe
 *    stays planted: no slip), its leg flexing; the hip drops on that side and the body moves over the other hind, which
 *    takes the weight (its fetlock sinks under it). Weight 0 is the square stand.
 *  - GRAZING: the neck lowered at its base until the muzzle reaches the grass (solved by bisection), the face turned
 *    down, the forehand tipped and lowered a little.
 *  - LAYERS, each its own exact loop (an engine layers them as additive clips): breathing (its own period), the tail's
 *    swish against flies, the ears' flicks, the head's drift, the weight shifting from one hind to the other. Their
 *    periods step by the golden ratio φ from the tail's (3 s, 3φ, 3φ², 3φ³): φ is the most irrational number, so loops
 *    whose lengths stand in its powers almost never line up again, and the layered idle does not visibly repeat.
 *    Their shapes are seeded (mulberry32), so two horses with two seeds do not twitch alike.
 *  - A HERD: herdOffset(i, period) starts member i a golden fraction of a loop on from the last (frac(i·φ⁻¹)), the
 *    spacing a sunflower sets its seeds by: no two in step, however many.
 *
 *   restState(B, { restHind, rest, graze, ... }) → a standing frame with those
 *   idleLayer(B, name, { seed }) → { name, period, poseAt(t) } an exact loop of one layer
 *   idleClip(B, { seconds, seed, offset, layers }) → { duration, poseAt(t) } the layers together
 */
import { standOn } from './build.js';
import { assemble } from './pose.js';
import { legRig } from './legs.js';

const DEG = Math.PI / 180;
const TAU = 2 * Math.PI;
export const PHI = (1 + Math.sqrt(5)) / 2;
const IDS = ['LF', 'RF', 'LH', 'RH'];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const S5 = (u) => { u = clamp01(u); return u * u * u * (10 - 15 * u + 6 * u * u); };
const frac = (x) => x - Math.floor(x);

/** the layers and their loop lengths (seconds): the tail's 3 s and its φ-powers; breathing at its own rate (≈ 14/min) */
export const IDLE_LAYERS = Object.freeze({
  breathe: 4.2,
  tail: 3.0,
  ears: 3.0 * PHI,
  head: 3.0 * PHI * PHI,
  weight: 3.0 * PHI ** 3,
});

/** member i of a herd starts a golden fraction of a loop on from member i − 1 */
export const herdOffset = (i, period) => frac(i / PHI) * period;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** a seeded loop of period P: three harmonics of 1/P with seeded amplitudes and phases, peak about `amp` */
function seededLoop(seed, P, amp) {
  const r = mulberry32(seed), h = [1, 2, 3].map((k) => ({ k, a: amp * (0.6 / k) * (0.6 + 0.8 * r()), p: TAU * r() }));
  return (t) => h.reduce((s, { k, a, p }) => s + a * Math.sin(TAU * k * t / P + p), 0);
}

/**
 * A standing frame. `restHind` 'L' | 'R' and `rest` ∈ [0, 1] its weight; `graze` ∈ [0, 1]; and the layers' own: `breathe`
 * (m), `nu`, `lat` (the neck), `earR`, `earL` ({ yaw, droop }), `tau`, `tailLat` (the tail). Weight 0 everywhere is the
 * build's own stand.
 */
export function restState(B, m = {}) {
  const rig = legRig(B), k = B.scale;
  const rest = m.restHind ? clamp01(m.rest ?? 1) : 0, side = m.restHind === 'L' ? -1 : 1, g = clamp01(m.graze ?? 0);
  // the body: over the supporting hind, the resting hip dropped, a little lower; grazing, tipped nose-down
  const body = {
    z: B.trunk.com[1] - 0.012 * k * rest - 0.03 * k * g + (m.breathe ?? 0), pitch: -6 * DEG * g, psi: 0,
    sway: -side * 0.025 * k * rest, rollF: 0, rollH: side * 4 * DEG * rest,
    nu: m.nu ?? 0, lat: m.lat ?? 0, tau: m.tau ?? 0, tailLat: m.tailLat ?? 0, earR: m.earR, earL: m.earL, headCounter: 0.5,
  };
  const share = { fore: B.share.fore / 2, hind: B.share.hind / 2 };
  const restLoad = 0.04;
  const legsFor = (bd) => {
    const legs = {};
    for (const id of IDS) {
      const pair = id[1] === 'F' ? 'fore' : 'hind', sd = id[0] === 'R' ? 1 : -1;
      const l = { id, pair, side: sd, x: sd * B[pair].hoofX };
      const resting = pair === 'hind' && m.restHind === id[0];
      const supporting = pair === 'hind' && m.restHind && !resting;
      const y = B[pair].hoofY;
      const F = resting ? share.hind + (restLoad - share.hind) * rest : supporting ? share.hind + (2 * share.hind - restLoad - share.hind) * rest : share[pair];
      const eta = resting ? -50 * DEG * rest : 0;
      const st = standOn(B, pair, y, F, eta, (Fp) => rig.solve(l, bd, Fp, 0, l.x));
      legs[id] = { solve: st.solve, distal: st.distal, plane: rig.planeOf(l, bd, l.x) };
    }
    return legs;
  };
  // grazing: the neck lowered until the muzzle meets the grass (bisection on its swing), the head following it down
  if (g > 0) {
    // the neck lowered at its base (where a horse lowers it) until the muzzle meets the grass, the face turned down
    const legs0 = legsFor(body), face = -(90 - B.head.carriage) * DEG * (1 - g) + -100 * DEG * g;
    const muzzleAt = (drop) => assemble(B, { ...body, neckDrop: drop, headPitch: face, legs: legs0 }).points.muzzle[2];
    // the muzzle's goal eased from where it rests (this build's own) down to the grass
    const restMuzzle = assemble(B, { ...body, legs: legs0 }).points.muzzle[2], goal = restMuzzle + (0.03 * k - restMuzzle) * g;
    let lo = -2.0, hi = 0.3;
    for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (muzzleAt(mid) > goal) hi = mid; else lo = mid; }
    body.neckDrop = (lo + hi) / 2; body.headPitch = face;
  }
  const legs = legsFor(body);
  const { bones, points } = assemble(B, { ...body, legs });
  return { bones, points, legs, contact: { LF: true, RF: true, LH: true, RH: true }, clamps: IDS.filter((id) => legs[id].solve.clamped), body, ground: 0, root: 0 };
}

/** one layer's state at t (an exact loop of its period) */
function layerState(name, t, seed) {
  const P = IDLE_LAYERS[name];
  switch (name) {
    case 'breathe': return { breathe: 0.003 * Math.sin(TAU * t / P) };
    case 'tail': {
      // a swish over the first 40 % of the loop: across and back, the dock lifting a little with it
      const u = frac(t / P), w = u < 0.4 ? Math.sin(Math.PI * u / 0.4) ** 2 : 0;
      return { tailLat: 0.55 * w * Math.sin(TAU * u / 0.4) * (seed % 2 ? 1 : -1), tau: 0.12 * w };
    }
    case 'ears': {
      const R = seededLoop(seed * 7 + 1, P, 0.45), L = seededLoop(seed * 7 + 2, P, 0.45);
      return { earR: { yaw: 0.2 + R(t), droop: 0.08 * R(t + P / 3) }, earL: { yaw: 0.2 + L(t), droop: 0.08 * L(t + P / 3) } };
    }
    case 'head': {
      const nu = seededLoop(seed * 7 + 3, P, 0.06), lat = seededLoop(seed * 7 + 4, P, 0.12);
      return { nu: nu(t), lat: lat(t) };
    }
    case 'weight': {
      // rest the left hind, stand square, rest the right, stand square: each change eased
      const u = frac(t / P);
      const wL = u < 0.1 ? S5(u / 0.1) : u < 0.4 ? 1 : u < 0.5 ? 1 - S5((u - 0.4) / 0.1) : 0;
      const wR = u >= 0.5 && u < 0.6 ? S5((u - 0.5) / 0.1) : u >= 0.6 && u < 0.9 ? 1 : u >= 0.9 ? 1 - S5((u - 0.9) / 0.1) : 0;
      return wL > 0 ? { restHind: 'L', rest: wL } : wR > 0 ? { restHind: 'R', rest: wR } : {};
    }
    default: throw new Error(`mount: idle layer '${name}' is not one of ${Object.keys(IDLE_LAYERS).join(', ')}`);
  }
}

export function idleLayer(B, name, { seed = 1 } = {}) {
  if (!IDLE_LAYERS[name]) throw new Error(`mount: idle layer '${name}' is not one of ${Object.keys(IDLE_LAYERS).join(', ')}`);
  return { name, period: IDLE_LAYERS[name], duration: IDLE_LAYERS[name], poseAt: (t) => ({ ...restState(B, layerState(name, t, seed)), t }) };
}

export function idleClip(B, { seconds = IDLE_LAYERS.weight, seed = 1, offset = 0, layers = Object.keys(IDLE_LAYERS) } = {}) {
  const poseAt = (t) => {
    const m = {};
    for (const name of layers) Object.assign(m, layerState(name, t + offset, seed));
    return { ...restState(B, m), t };
  };
  return { duration: seconds, poseAt, layers };
}


/**
 * Grazing as a one-shot from the stand to the stand: the head lowered to the grass over `down` seconds, held grazing for
 * `hold` (the idle's layers running on), raised over `up`. Opens and closes on the stand.
 */
export function grazeClip(B, { down = 2.5, hold = 3, up = 2, seed = 1 } = {}) {
  const duration = down + hold + up;
  const g = (t) => (t < down ? S5(t / down) : t < down + hold ? 1 : 1 - S5((t - down - hold) / up));
  const poseAt = (t) => {
    const w = g(t), m = { graze: w };
    // the layers fade in only while the head is down, so the clip still opens and closes on the stand
    for (const name of ['ears', 'tail', 'breathe']) for (const [key, val] of Object.entries(layerState(name, t, seed))) m[key] = typeof val === 'number' ? val * w : { yaw: val.yaw * w, droop: val.droop * w };
    return { ...restState(B, m), t };
  };
  return { duration, poseAt };
}
