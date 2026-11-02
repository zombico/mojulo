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
 *   functional(S, limbs, { arms, legs }) → the silhouette fitted to its function: the hind legs sized by the species'
 *                             ratio, the body's depth (front to back, never its width: the front view keeps its round
 *                             read) eased, then the legs lengthened, until the trunk clears the floor hinged level over
 *                             the hips; the arms lengthened until the forepaws reach it from there; with the pose it
 *                             reaches. `arms` and `legs` are a tune's asks (feature-tune.js: multipliers on what the fit
 *                             makes): honoured as far as the floor allows, `held` naming each the function kept longer;
 *                             a tuned `girth` (a deeper trunk, standing higher) lets the legs and the arms grow as far
 *   foursClips(F, { walk }) → the clips that play it: `fours` (dropping onto all fours, held) and `prowl` (the walk on
 *                             all fours: the hind legs' own walk, the trunk hinged, the arms swinging against the legs)
 *
 * Head units (h), z up from the soles, y front. Pure: data and arithmetic.
 */
import { speciesParams } from '../fauna/species.js';
import { SPINE_CAP, LIMITS } from '../polygonizer/figure-vajra.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dist = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : NaN);

/** THE FUNCTION'S NUMBERS: the hinges tried (the hips' forward tip, most first: the fit is made for the first), the
 *  PUSH-UP on all fours (the spine's `curl`, bending forward at the hips, the waist and the neck's root as the rig's spine
 *  does, figure-vajra.js SPINE_CAP, and the core bent at the `waist` (degrees): the rib ball comes down low in front of
 *  hips tipped less, so the tail rides lower and the head lifts from the chest), the hind legs' deepest
 *  crouch and their NATURAL one (on all fours a quadruped's hind legs are never straight: they keep their bend), how far a belly may brush the floor (h), the shoulders' lowest share of the arm's reach (the elbows bend no
 *  further), the body's depth's easing step and least, the legs' and the arms' most, and where a species' hind legs
 *  count as big */
export const FEATURE_FOURS = Object.freeze({
  hinges: [70, 66, 62, 58, 54, 50, 46, 42], curl: 0.5, waist: 15, neck: 30, crouch: 0.8, natural: 0.3, brush: 0.04, bend: 0.55,
  depth: { step: 0.02, least: 0.82 }, rise: { most: 0.9 }, arms: { most: 1.6 },
  big: 1.75,
});

/** THE DOWNWARD DOG (the play bow, the stretch): the hind legs STRAIGHT, the hips high where they stand, the trunk tipped
 *  forward over them (`hinges`, most first) and bent DOWN at the waist (`curl`, `waist`: the rib ball under the pelvis
 *  ball), the chest low over the floor, the forepaws out in front on it, the head lifted to look ahead. Every animal that
 *  goes on all fours takes it (the test of the two-ball trunk): the rib ball at least `bow` under the pelvis ball, the
 *  fit lengthening the legs by `step` until it is (a big rib ball on short legs: a gorilla's) */
export const FEATURE_DOG = Object.freeze({ hinges: [80, 75, 70, 65, 60, 55, 50], curl: 1, waist: 25, bow: 0.05, step: 0.02 });

/** a species' TAIL CARRIAGE off the roster: the elevation (degrees, + up, behind the animal) of the line from its tail's
 *  first station to its last (`tail` [x, y, z, r] or `tailStations` [x, y, z, r] / [y, z, r]), null where it has none */
export function speciesTail(id) {
  let p; try { p = speciesParams(id); } catch { return null; }
  const st = Array.isArray(p.tail) && p.tail.length > 1 ? p.tail : Array.isArray(p.tailStations) && p.tailStations.length > 1 ? p.tailStations : null;
  if (!st) return null;
  const yz = (e) => (Array.isArray(e[2]) ? [e[0], e[1]] : [e[1], e[2]]), a = yz(st[0]), b = yz(st.at(-1));
  if (![...a, ...b].every(Number.isFinite)) return null;
  return Math.round((Math.atan2(b[1] - a[1], -(b[0] - a[0])) * 180) / Math.PI);
}

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
const trunkOf = (S) => [...S.body.filter((e) => !/R$/.test(e.name)), ...(S.neckEgg ? [{ ...S.neckEgg, u: S.neckEgg.u ?? [0, 0.1, 1], bone: 'neck' }] : [])];

/** THE BENT TRUNK, as the rig poses it (mascot-form.js rigOf: the waist, `navel`, halfway from the hips to the neck's
 *  root; figure-vajra.js: the hinge tips everything over the hips, the spine's curl bends it further at the hips, the
 *  waist and the neck's root): a point of the trunk on its segment (0 the pelvis's, 1 the ribs' over the waist, 2 the
 *  shoulders' and the neck's over its root) posed, the hips' hub at the origin, and that segment's pitch; `waist` the
 *  core's bend at the navel (degrees, + forward: figure-posing.js `waist`) */
function bentTrunk(S, hinge, curl, waist = 0) {
  const hz = S.hip[2], navel = [0, 0, (hz + S.neckZ) / 2 - hz], neck = [0, 0, S.neckZ - hz];
  const C = SPINE_CAP, a = [hinge + C.pelvisHub.flex * curl, 0, 0];
  a[1] = a[0] + C.navel.flex * curl + waist; a[2] = a[1] + C.neckHub.flex * curl;
  const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]], sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const nav = pitch(navel, a[0]), nk = add(nav, pitch(sub(neck, navel), a[1]));
  const at = (p, seg) => (seg === 0 ? pitch(p, a[0]) : seg === 1 ? add(nav, pitch(sub(p, navel), a[1])) : add(nk, pitch(sub(p, neck), a[2])));
  return { at, pitchOf: (seg) => a[seg] };
}
/** a trunk mass's segment: by the bone it rides */
const segOf = (e) => (e.bone === 'torso' ? 1 : e.bone === 'neck' || e.bone === 'head' ? 2 : 0);

/** the bent trunk's lowest point and the shoulder's height, about the hips' hub */
function bentLow(S, hinge, curl, waist = 0) {
  const B = bentTrunk(S, hinge, curl, waist), rel = (p) => [p[0], p[1], p[2] - S.hip[2]];
  let low = Infinity;
  for (const e of trunkOf(S)) {
    const g = segOf(e), [U, V, W] = frameOf(e).map((v) => pitch(v, B.pitchOf(g))), cz = B.at(rel(e.c), g)[2];
    low = Math.min(low, cz - Math.hypot(e.r[0] * U[2], e.r[1] * V[2], e.r[2] * W[2]));
  }
  return { low, sh: B.at(rel(S.arm.sh), 2)[2] };
}

export function foursOf(S, { arms = 1 } = {}) {
  const F = FEATURE_FOURS, reach = (S.arm.len[0] + S.arm.len[1]) * arms + 0.12, toeZ = 0.05;
  for (const hinge of F.hinges) for (let c = F.natural; c <= F.crouch + 1e-9; c += 0.05) {
    const z0 = S.hip[2] - c * 0.45 * (S.hip[2] - toeZ), H = bentLow(S, hinge, F.curl, F.waist), sh = z0 + H.sh;
    if (sh > reach || sh < F.bend * reach) continue;
    return { hinge, curl: F.curl, waist: F.waist, crouch: r4(c), shoulder: r4(sh), reach: r4(reach), clearance: r4(z0 + H.low) };
  }
  return null;
}

/** the downward dog a silhouette reaches (FEATURE_DOG): the hips at their standing height, the trunk tipped and bent as
 *  far as the floor allows; the rib ball's middle against the pelvis ball's (`bow`: positive, the chest lower, the
 *  trunk sloping down from the hips), the shoulder against the arm's reach, the trunk's lowest point (`clearance`) */
export function dogOf(S, { arms = 1, reaching = true } = {}) {
  const F = FEATURE_FOURS, D = FEATURE_DOG, reach = (S.arm.len[0] + S.arm.len[1]) * arms + 0.12, hz = S.hip[2];
  const chest = S.body.find((e) => e.name === 'chest'), pelvis = S.body.find((e) => e.name === 'belly');
  if (!chest || !pelvis) return null;
  for (const hinge of D.hinges) {
    const H = bentLow(S, hinge, D.curl, D.waist), sh = hz + H.sh;
    if (hz + H.low < -F.brush || (reaching && sh > reach)) continue;
    const B = bentTrunk(S, hinge, D.curl, D.waist), zOf = (e) => hz + B.at([e.c[0], e.c[1], e.c[2] - hz], segOf(e))[2];
    return { hinge, curl: D.curl, waist: D.waist, shoulder: r4(sh), reach: r4(reach), clearance: r4(hz + H.low), bow: r4(zOf(pelvis) - zOf(chest)) };
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

/** the trunk's lowest point and the shoulder's height against the hip hub, bent on all fours at hinge `deg` (no crouch) */
const hinged = (S, deg) => bentLow(S, deg, FEATURE_FOURS.curl, FEATURE_FOURS.waist);

export function functional(S, limbs = {}, { arms: A = 1, legs: Lg = 1, girth: G = 1 } = {}) {
  const F = FEATURE_FOURS, q = limbs.ratio ?? 1.4, deg = F.hinges[0], held = [];
  // (the species' proportions first: big hind legs grow their haunches and feet and stand a little taller; long arms
  // (the fore longer than the hind: an ape's) lengthen the arms)
  const big = Math.max(0, q - F.big), fit = { rise: clamp(0.25 * big, 0, 0.3), depth: 1, arms: clamp(1 / q, 1, 1.35) * A, hind: clamp(1 + 0.4 * big, 1, 1.5), foot: clamp((limbs.foot ?? 0.33) / 0.33, 1, 1.8) };
  // the trunk clears the floor hinged level over the hips: the body's depth eased first, then the legs lengthened to
  // the hip height it needs
  // (the hips on all fours stand lower than standing by the hind legs' natural bend: the hub the trunk turns about)
  const d = F.natural * 0.45, hubOf = (h) => h - d * (h - 0.05), hipFor = (hub) => (hub - 0.05 * d) / (1 - d);
  let T = refit(S, fit), H = hinged(T, deg);
  while (-H.low - F.brush > hubOf(T.hip[2]) && fit.depth - F.depth.step >= F.depth.least - 1e-9) { fit.depth -= F.depth.step; T = refit(S, fit); H = hinged(T, deg); }
  fit.rise = clamp(fit.rise + Math.max(0, hipFor(-H.low - F.brush) - T.hip[2]), 0, F.rise.most * Math.max(1, G));
  // (a tune's legs: the hips at that share of the height the fit made them, never lower than the floor needs)
  if (Lg !== 1) { const want = (S.hip[2] + fit.rise) * Lg - S.hip[2]; if (want < fit.rise) held.push('legs'); fit.rise = Math.max(fit.rise, want); }
  T = refit(S, fit);
  // (and the downward dog bows: the legs lengthened until the rib ball goes under the pelvis ball, as far as they may)
  const D = FEATURE_DOG, most = F.rise.most * Math.max(1, G);
  for (let d = dogOf(T, { reaching: false }); (!d || d.bow < D.bow) && fit.rise + D.step <= most + 1e-9; d = dogOf(T, { reaching: false })) { fit.rise += D.step; T = refit(S, fit); }
  H = hinged(T, deg);
  // (the arms fitted last, from the hips the floor and the dog made)
  // the arms long enough for the forepaws to reach the floor from there: a level back over straight hind legs, or, on
  // big hind legs, the hind legs folded under it as far as the trunk still clears the floor (a rabbit's, a kangaroo's)
  const hub = big > 0 ? Math.max(-H.low - F.brush, T.hip[2] - F.crouch * 0.45 * (T.hip[2] - 0.05)) : hubOf(T.hip[2]), L = S.arm.len[0] + S.arm.len[1];
  // (long enough for the downward dog's forepaws too)
  const dog = dogOf(T, { reaching: false }), need = Math.max((hub + H.sh + 0.01 - 0.12) / L, dog ? (dog.shoulder + 0.01 - 0.12) / L : 0);
  if (A < 1 && need > fit.arms) held.push('arms');
  fit.arms = clamp(Math.max(fit.arms, need), Math.min(1, A), F.arms.most * Math.max(1, A, G));
  T = refit(S, fit);
  return { S: T, fit: Object.fromEntries(Object.entries(fit).map(([k, v]) => [k, r4(v)])), fours: foursOf(T), dog: dogOf(T), ...(held.length ? { held } : {}) };
}

/** the clips on all fours. `walk` the biped's walk (mascot-gait.js gaitClips) the prowl's hind legs take; `ready` the
 *  standing key it drops from */
export function foursClips(F, { walk = [], ready = {}, dog = null } = {}) {
  if (!F) return {};
  // (each arm reaches down to the floor: straight down where the shoulder is as high as the arm is long, angled forward
  // where it is longer (an ape's), so the forepaw rests on the floor rather than through it)
  const drop = clamp(F.shoulder / F.reach, 0.3, 1), fwd = Math.sqrt(Math.max(0, 1 - drop * drop));
  const down = (sx, swing = 0) => { const d = unit([0.3 * sx, fwd + swing, -drop]); return { x: r4(d[0]), y: r4(d[1]), z: r4(d[2]) }; };
  // (the push-up: the spine curled as the fit bent it, the head lifted from the chest to look ahead)
  // (the head out in front of the chest, turned up to look ahead: the neck a little back (`FEATURE_FOURS.neck`), the
  // head as far as it goes, figure-vajra.js LIMITS.head; the downward dog's neck back as far as it goes, the head between
  // the arms)
  const head = { pitch: LIMITS.head }, neck = { pitch: FEATURE_FOURS.neck }, spine = { curl: F.curl ?? FEATURE_FOURS.curl };
  const waist = F.waist ?? 0, on = { ...ready, hinge: F.hinge, waist, crouch: F.crouch, spine, armL: down(-1), armR: down(1), elbowL: 'slight', elbowR: 'slight', neck, head };
  // (the downward dog: the hind legs straight, the trunk tipped and bent at the waist, the forepaws out on the floor
  // from shoulders that low, the head lifted)
  const bow = dog ? (() => { const d = clamp(dog.shoulder / dog.reach, 0.05, 1), f = Math.sqrt(Math.max(0, 1 - d * d)), aim = (sx) => { const v = unit([0.2 * sx, f, -d]); return { x: r4(v[0]), y: r4(v[1]), z: r4(v[2]) }; };
    const k = { ...ready, hinge: dog.hinge, waist: dog.waist, crouch: 0, spine: { curl: dog.curl }, armL: aim(-1), armR: aim(1), elbowL: 'straight', elbowR: 'straight', neck: { pitch: LIMITS.neck }, head };
    return { downDog: [ready, k, k] }; })() : {};
  return {
    ...bow,
    fours: [ready, on, on],
    prowl: walk.map((k) => {
      const sw = (a) => clamp(((a?.y ?? 0.18) - 0.18) * 1.6, -0.6, 0.6);
      return { ...k, hinge: F.hinge, waist, crouch: F.crouch, spine: { ...(k.spine ?? {}), ...spine }, armR: down(1, sw(k.armR)), armL: down(-1, sw(k.armL)), elbowL: 'slight', elbowR: 'slight', neck, head };
    }),
  };
}
