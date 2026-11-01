/**
 * THE FEATURE STYLE'S FUNCTION: an animal made in the style moves as its animal does (docs/feature-style.md). A
 * quadruped stands up on its hind legs for the acting AND drops onto all fours to move, so its limbs keep the species'
 * own proportions (a rabbit's and a kangaroo's big hind legs, a gorilla's long arms) and its body fits over them.
 *
 *   speciesLimbs(id)        → { fore, hind, ratio, foot } off the fauna roster's skeleton (the limbs' chained lengths, the
 *                             hind against the fore, the hind foot against the hind leg), {} where the roster lacks them
 *   foursOf(S)              → the all-fours pose a silhouette reaches: the trunk hinged forward over the hips (`hinge`
 *                             degrees), the hind legs crouched (`crouch`), the shoulders over the forepaws, and how far
 *                             the trunk's lowest point stands off the floor (`clearance`, head units: negative is through it)
 *   functional(S, limbs)    → the silhouette fitted to its function: the hind legs sized by the species' ratio, the
 *                             body's depth (front to back, never its width: the front view keeps its round read) eased,
 *                             then the legs lengthened, until the trunk clears the floor hinged level over the hips; the
 *                             arms lengthened until the forepaws reach it from there; with the pose it reaches
 *   foursClips(F, { walk }) → the clips that play it: `fours` (dropping onto all fours, held) and `prowl` (the walk on
 *                             all fours: the hind legs' own walk, the trunk hinged, the arms swinging against the legs)
 *
 * Head units (h), z up from the soles, y front. Pure: data and arithmetic.
 */
import { speciesParams } from '../fauna/species.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dist = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : NaN);

/** THE FUNCTION'S NUMBERS: the hinges tried (most level first: the fit is made for the first), the hind legs' deepest
 *  crouch, how far a belly may brush the floor (h), the shoulders' lowest share of the arm's reach (the elbows bend no
 *  further), the body's depth's easing step and least, the legs' and the arms' most, and where a species' hind legs
 *  count as big */
export const FEATURE_FOURS = Object.freeze({
  hinges: [80, 75, 70, 65, 60, 55, 50, 45], crouch: 0.8, brush: 0.04, bend: 0.55,
  depth: { step: 0.02, least: 0.82 }, rise: { most: 0.9 }, arms: { most: 1.6 },
  big: 1.75,
});

/** the limbs' chained lengths off the roster's skeleton: the first joint of each link the skeleton names */
const FORE = [['shoulder'], ['elbow'], ['carpus', 'wrist'], ['forePaw', 'foreFetlock', 'finger1'], ['foreToe', 'foreHoof', 'foreCoronet']];
const HIND = [['hip'], ['stifle', 'knee'], ['hock', 'ankle'], ['hindPaw', 'hindFetlock', 'foot'], ['hindToe', 'hindHoof', 'hindCoronet', 'toeF']];
const chain = (J, links) => { const pts = links.map((names) => names.map((n) => J[n]).find(Boolean)).filter(Boolean); let s = 0; for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]); return pts.length > 2 ? s : null; };

export function speciesLimbs(id) {
  let p = null; try { p = speciesParams(id); } catch { return {}; }
  const J = p?.joints ?? {}, fore = chain(J, FORE.slice(0, 4)), hind = chain(J, HIND.slice(0, 4)), foot = dist(J.hindPaw ?? J.foot, J.hindToe ?? J.toeF);
  if (!fore || !hind) return {};
  return { fore: r4(fore), hind: r4(hind), ratio: r4(hind / fore), ...(Number.isFinite(foot) ? { foot: r4(foot / hind) } : {}) };
}

/** an egg's frame as feature-body.js egg() makes it: its axis, its across (from the hint), the third */
function frameOf(e) {
  const U = unit(e.u), h = e.hint ?? [1, 0, 0], h0 = Math.abs(dot(unit(h), U)) > 0.95 ? [0, 1, 0] : h;
  const d = dot(h0, U), V = unit([h0[0] - U[0] * d, h0[1] - U[1] * d, h0[2] - U[2] * d]);
  return [U, V, cross(U, V)];
}
/** a vector pitched forward by `deg` about x (the head toward +y) */
const pitch = (v, deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c + v[2] * s, v[2] * c - v[1] * s]; };

/** the trunk's masses (they turn with the hinge; the haunches, the legs and the tail do not count: the haunches stay on
 *  the thighs, a tail swings up over the back) */
const trunkOf = (S) => [...S.body.filter((e) => !/R$/.test(e.name)), ...(S.neckEgg ? [{ ...S.neckEgg, u: S.neckEgg.u ?? [0, 0.1, 1] }] : [])];

export function foursOf(S, { arms = 1 } = {}) {
  const F = FEATURE_FOURS, hub = [0, 0, S.hip[2]], reach = (S.arm.len[0] + S.arm.len[1]) * arms + 0.12, trunk = trunkOf(S);
  const toeZ = 0.05, rel = (p) => [p[0] - hub[0], p[1] - hub[1], p[2] - hub[2]];
  for (const hinge of F.hinges) for (let c = 0; c <= F.crouch + 1e-9; c += 0.05) {
    const drop = c * 0.45 * (S.hip[2] - toeZ), z0 = S.hip[2] - drop, sh = z0 + pitch(rel(S.arm.sh), hinge)[2];
    if (sh > reach || sh < F.bend * reach) continue;
    let low = Infinity;
    for (const e of trunk) {
      const [U, V, W] = frameOf(e).map((a) => pitch(a, hinge)), cz = z0 + pitch(rel(e.c), hinge)[2];
      low = Math.min(low, cz - Math.hypot(e.r[0] * U[2], e.r[1] * V[2], e.r[2] * W[2]));
    }
    return { hinge, crouch: r4(c), shoulder: r4(sh), reach: r4(reach), clearance: r4(low) };
  }
  return null;
}

/** the silhouette with everything above the hips raised `rise` (the legs that much longer), the body's depth eased by
 *  `depth` (front to back only), the arms lengthened by `arms`, the hind legs' masses grown by `hind` and the feet by
 *  `foot` */
export function refit(S, { rise = 0, depth = 1, arms = 1, hind = 1, foot = 1 } = {}) {
  const up = (p) => [p[0], p[1], p[2] + rise], deep = (e) => ({ ...e, c: up(e.c), r: [e.r[0], e.r[1], e.r[2] * depth] });
  const body = S.body.map((e) => (/R$/.test(e.name) ? { ...e, c: up(e.c), r: e.r.map((x) => x * hind) } : deep(e)));
  const belly = Object.fromEntries(Object.entries(S.belly).map(([k, e]) => [k, deep(e)]));
  const legs = rise > 0 || S.legs === 'cones' ? 'cones' : 'hidden';
  return { ...S, heads: S.heads + rise, legScale: hind, hz: S.hz + rise, neckZ: S.neckZ + rise, body, belly, legs,
    ...(S.neckEgg ? { neckEgg: { ...S.neckEgg, c: up(S.neckEgg.c) } } : {}),
    hip: up(S.hip), ...(S.knee ? { knee: [S.knee[0], S.knee[1], S.knee[2] + rise / 2] } : {}), footLen: foot,
    arm: { ...S.arm, sh: up(S.arm.sh), len: S.arm.len.map((x) => x * arms) }, tail: up(S.tail), back: S.back.map(([z, y]) => [z + rise, y]) };
}

/** the trunk's lowest point and the shoulder's height against the hip hub, hinged `deg` forward (no crouch) */
function hinged(S, deg) {
  const hub = S.hip[2], rel = (p) => [p[0], p[1], p[2] - hub];
  let low = Infinity;
  for (const e of trunkOf(S)) {
    const [U, V, W] = frameOf(e).map((a) => pitch(a, deg));
    low = Math.min(low, pitch(rel(e.c), deg)[2] - Math.hypot(e.r[0] * U[2], e.r[1] * V[2], e.r[2] * W[2]));
  }
  return { low, sh: pitch(rel(S.arm.sh), deg)[2] };
}

export function functional(S, limbs = {}) {
  const F = FEATURE_FOURS, q = limbs.ratio ?? 1.4, deg = F.hinges[0];
  // (the species' proportions first: big hind legs grow their haunches and feet and stand a little taller; long arms
  // (the fore longer than the hind: an ape's) lengthen the arms)
  const big = Math.max(0, q - F.big), fit = { rise: clamp(0.25 * big, 0, 0.3), depth: 1, arms: clamp(1 / q, 1, 1.35), hind: clamp(1 + 0.4 * big, 1, 1.5), foot: clamp((limbs.foot ?? 0.33) / 0.33, 1, 1.8) };
  // the trunk clears the floor hinged level over the hips: the body's depth eased first, then the legs lengthened to
  // the hip height it needs
  let T = refit(S, fit), H = hinged(T, deg);
  while (-H.low - F.brush > T.hip[2] && fit.depth - F.depth.step >= F.depth.least - 1e-9) { fit.depth -= F.depth.step; T = refit(S, fit); H = hinged(T, deg); }
  fit.rise = clamp(fit.rise + Math.max(0, -H.low - F.brush - T.hip[2]), 0, F.rise.most);
  T = refit(S, fit); H = hinged(T, deg);
  // the arms long enough for the forepaws to reach the floor from there: a level back over straight hind legs, or, on
  // big hind legs, the hind legs folded under it as far as the trunk still clears the floor (a rabbit's, a kangaroo's)
  const hub = big > 0 ? Math.max(-H.low - F.brush, T.hip[2] - F.crouch * 0.45 * (T.hip[2] - 0.05)) : T.hip[2], L = S.arm.len[0] + S.arm.len[1];
  fit.arms = clamp(Math.max(fit.arms, (hub + H.sh + 0.01 - 0.12) / L), 1, F.arms.most);
  T = refit(S, fit);
  return { S: T, fit: Object.fromEntries(Object.entries(fit).map(([k, v]) => [k, r4(v)])), fours: foursOf(T) };
}

/** the clips on all fours. `walk` the biped's walk (mascot-gait.js gaitClips) the prowl's hind legs take; `ready` the
 *  standing key it drops from */
export function foursClips(F, { walk = [], ready = {} } = {}) {
  if (!F) return {};
  // (each arm reaches down to the floor: straight down where the shoulder is as high as the arm is long, angled forward
  // where it is longer (an ape's), so the forepaw rests on the floor rather than through it)
  const drop = clamp(F.shoulder / F.reach, 0.3, 1), fwd = Math.sqrt(Math.max(0, 1 - drop * drop));
  const down = (sx, swing = 0) => { const d = unit([0.3 * sx, fwd + swing, -drop]); return { x: r4(d[0]), y: r4(d[1]), z: r4(d[2]) }; };
  // (the head held up to look ahead: the neck turned back as far as it goes and the chest arched up a little)
  const head = { x: 0, y: -1, z: 0.2 }, spine = { arch: 0.4 };
  const on = { ...ready, hinge: F.hinge, crouch: F.crouch, spine, armL: down(-1), armR: down(1), elbowL: 'slight', elbowR: 'slight', head };
  return {
    fours: [ready, on, on],
    prowl: walk.map((k) => {
      const sw = (a) => clamp(((a?.y ?? 0.18) - 0.18) * 1.6, -0.6, 0.6);
      return { ...k, hinge: F.hinge, crouch: F.crouch, spine: { ...(k.spine ?? {}), arch: 0.4 }, armR: down(1, sw(k.armR)), armL: down(-1, sw(k.armL)), elbowL: 'slight', elbowR: 'slight', head };
    }),
  };
}
