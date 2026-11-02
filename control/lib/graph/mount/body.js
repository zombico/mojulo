/**
 * body — a mount's BODY: a form field of bone and muscle masses placed from its own solved standing skeleton, summed into
 * one skin, polygonized watertight, every vertex weighted to the bones by the same blend that formed it. The realistic
 * hero's method (polygonizer/body-relational: masses from the rig's joints, one field, one skin) on the horse's anatomy.
 *
 * THE MASSES (after the light horse's surface anatomy, BACK & CLAYTON 2013; the record of where the bone shows):
 *   trunk     the barrel (the ribcage), the girth's depth behind the elbow, the breast between the forelegs, the
 *             withers' ridge, the back and loin, the croup, the points of the hip, the quarters, the buttocks, the belly
 *   forehand  the scapula's muscles over the blade, the triceps filling the angle from the point of the shoulder down to
 *             the elbow, the elbow's point
 *   neck      deep at its base and thin at the throatlatch, the crest above (the mane's)
 *   head      the cranium, the round jowls (the masseter), the long flat face tapering to the muzzle, the soft muzzle with
 *             its nostrils cut in, the jaw's underline, the eyes set high on the side, the ears
 *   legs      the forearm's muscle tapering to the flat knee; the thigh and stifle, the gaskin, the hock and its point;
 *             below, the lean cannon (the tendons behind), the fetlock's knuckle, the pastern, the hoof flared to its
 *             flat sole
 *   tail      the dock, and the hair's mass (a stand-in for the hair cards)
 *
 * THE BLEND: the trunk and neck as one soft mass (log-sum-exp, wide), the head its own tighter one (its planes kept),
 * each leg its own tight one (its joints and tendons crisp), the legs and the details (ears, eyes, hair) joined to the trunk with a narrower blend; the hooves cut
 * flat at the ground, the nostrils cut into the muzzle.
 *
 * THE WEIGHTS: each mass belongs to a bone; a vertex's weight on a bone is the share of the blend its masses carry there
 * (the soft-min's own weights), the four strongest kept and normalized. The skin bends where its masses meet.
 *
 * The REGISTER: the stylized build's own proportions place its masses (a bigger head, shorter legs); its `soft` blends
 * rounder and reads simpler.
 *
 *   bodyPrims(B) → the masses: [{ kind: 'egg'|'cone', bone, group, set, … }]
 *   bodyField(B) → { field(p), prims, distances(p) }
 *   bodyMesh(B, { cells }) → { vertices, quads, normals, weights: [[bone, w] ×4], parts, bounds, stats }
 */
import { sdEgg, sdCone } from '../polygonizer/body-relational-field.js';
import { surfaceNetFaces } from '../polygonizer/field-mesh.js';
import { standPose } from './gait.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp3 = (a, b, t) => add(a, mul(sub(b, a), t));

/** the soft minimum (log-sum-exp) of distances, stable: −k·log Σ e^(−d/k) */
export function softMin(ds, k) {
  let m = Infinity;
  for (const d of ds) if (d < m) m = d;
  let s = 0;
  for (const d of ds) s += Math.exp(-(d - m) / k);
  return m - k * Math.log(s);
}
/** the smooth maximum of two (a cut: max(a, b) rounded by k) */
const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };

/** the blends: the trunk's soft, a leg's tight, the join between, the details' (scaled to the build; the register's) */
/**
 * The head's profile for a 0.6 m head (scaled to the build's): at each station along the head bone (0 the poll, 1 the
 * muzzle), the face's top line and the jaw's underline (m, + toward the face's front, off the bone) and the half width.
 * After the light horse's head: the flat forehead at the eyes, the straight nasal line, the deep round jowl a quarter of
 * the way down, the jaw's underline running forward to the chin, the muzzle deeper than it is wide.
 */
export const HEAD_PROFILE = Object.freeze([
  [0.00, 0.035, -0.100, 0.085],
  [0.08, 0.050, -0.205, 0.095],
  [0.16, 0.060, -0.255, 0.105],
  [0.26, 0.062, -0.275, 0.110],
  [0.36, 0.058, -0.240, 0.100],
  [0.46, 0.054, -0.190, 0.086],
  [0.56, 0.050, -0.148, 0.073],
  [0.66, 0.046, -0.132, 0.065],
  [0.76, 0.041, -0.120, 0.061],
  [0.84, 0.036, -0.114, 0.061],
  [0.91, 0.026, -0.115, 0.058],
  [0.96, 0.008, -0.105, 0.054],
  [1.00, -0.020, -0.090, 0.040],
].map(Object.freeze));
/** the neck: its crest's arch (m over the straight crest line), its half width at the base and at the throatlatch */
export const NECK_SHAPE = Object.freeze({ arch: 0.045, base: 0.15, throat: 0.08 });

export const BLEND = Object.freeze({ trunk: 0.05, head: 0.007, leg: 0.016, join: 0.03, detail: 0.012 });

/** an egg: centre c, axes (unit rows u, v, w), radii along them */
const egg = (c, u, v, r, extra) => { const w = cross(u, v); return { kind: 'egg', c, ax: [u, v, w], r, R: Math.max(...r), ...extra }; };
/** an egg along a segment a → b between fractions t0..t1, its long radius half that span (× stretch), `side` and
 * `across` its other two (side along `s`, across the third axis), shifted by `off` (world) */
const eggAlong = (a, b, t0, t1, side, across, s, extra, off = [0, 0, 0], stretch = 1) => {
  const d = unit(sub(b, a)), sv = unit(sub(s, mul(d, dot(s, d)))), c = add(lerp3(a, b, (t0 + t1) / 2), off);
  return egg(c, d, sv, [len(sub(b, a)) * (t1 - t0) / 2 * stretch, side, across], extra);
};
const cone = (a, b, r1, r2, extra) => ({ kind: 'cone', a, b, r1, r2, c: lerp3(a, b, 0.5), R: len(sub(b, a)) / 2 + Math.max(r1, r2), ...extra });

/** the neck's crest at the stand: crestAt(t) from just ahead of the withers (0) to the poll (1), ARCHED; crestUp its up */
export function neckCrest(B, S = standPose(B)) {
  const T = B.trunk, k = B.scale, h = B.head.length / 0.6, poll = S.points.neck[S.points.neck.length - 1];
  const crest0 = [0, T.withers[0] + 0.10 * k, T.withers[1] - 0.05 * k], crest1 = add(poll, [0, -0.02 * h, 0.05 * h]);
  const cd = unit(sub(crest1, crest0)), crestUp = [0, -cd[2], cd[1]];                // square to the crest, up and back
  const crestCtl = add(lerp3(crest0, crest1, 0.5), mul(crestUp, NECK_SHAPE.arch * k));
  const crestAt = (t) => add(add(mul(crest0, (1 - t) ** 2), mul(crestCtl, 2 * t * (1 - t))), mul(crest1, t * t));
  return { crestAt, crestUp, neckBone: (t) => `neck${Math.min(4, Math.floor(t * 5))}` };
}

export function bodyPrims(B, { hair = true } = {}) {
  const S = standPose(B), bn = S.bones, P = S.points, k = B.scale, T = B.trunk, h = B.head.length / 0.6;
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const W = (yz, x = 0) => [x, yz[0], yz[1]];
  const prims = [];
  const put = (p) => { prims.push(p); return p; };
  const trunk = (bone, group = 'body') => ({ bone, group, set: 'trunk' });

  // THE TRUNK
  const cz = T.com[1];
  put(egg(W([-0.05, cz + 0.06 * k]), Y, X, [0.58 * k, 0.27 * k, 0.29 * k], trunk('spine2')));                // the barrel
  put(egg(W([0.36, cz + 0.01 * k]), Y, X, [0.22 * k, 0.23 * k, 0.28 * k], trunk('spine3')));                 // the girth's depth
  put(egg(W([0.60, cz - 0.02 * k]), Y, X, [0.14 * k, 0.18 * k, 0.17 * k], trunk('spine3')));                 // the breast
  put(egg(W([T.withers[0] - 0.06, T.withers[1] - 0.13 * k]), Y, X, [0.27 * k, 0.11 * k, 0.13 * k], trunk('spine3')));   // the withers
  put(egg(W([-0.24, T.loin[1] - 0.14 * k]), Y, X, [0.34 * k, 0.24 * k, 0.14 * k], trunk('spine1')));         // the back and loin
  put(egg(W([T.croup[0] - 0.02, T.croup[1] - 0.18 * k]), Y, X, [0.29 * k, 0.25 * k, 0.18 * k], trunk('spine0')));       // the croup
  put(egg(W([-0.02, cz - 0.10 * k]), Y, X, [0.40 * k, 0.24 * k, 0.15 * k], trunk('spine2')));                // the belly
  for (const s of [1, -1]) {
    const side = s > 0 ? 'R' : 'L';
    put(egg(W([T.lumbosacral[0] - 0.06, T.lumbosacral[1] - 0.03 * k], s * 0.22 * k), Y, X, [0.08 * k, 0.07 * k, 0.07 * k], trunk('spine0')));   // the point of the hip
    put(egg(W([T.hip[0] - 0.05, T.hip[1] - 0.10 * k], s * 0.14 * k), Y, X, [0.27 * k, 0.12 * k, 0.28 * k], trunk('spine0')));   // the quarters
    put(eggAlong(W(T.buttock, s * 0.10 * k), W([T.buttock[0] + 0.14 * k, T.buttock[1] - 0.40 * k], s * 0.12 * k), 0, 1, 0.10 * k, 0.12 * k, X, { ...trunk(`femur${side}`), span: ['spine0', `tibia${side}`] }));   // the buttock: the hamstrings, the pelvis to the gaskin
    // THE FOREHAND: the scapula's muscles over the blade, the triceps in the angle behind the shoulder, the elbow's point
    const sc = bn[`scapula${side}`], hu = bn[`humerus${side}`];
    put(eggAlong(sc.head, sc.tail, 0, 1, 0.06 * k, 0.14 * k, X, trunk(`scapula${side}`), [s * 0.02 * k, 0, 0]));
    put(eggAlong(hu.head, hu.tail, -0.15, 1.0, 0.11 * k, 0.15 * k, X, { ...trunk(`humerus${side}`), span: [`scapula${side}`, `radius${side}`] }, [s * 0.01 * k, -0.07 * k, 0.02 * k]));   // the triceps: the blade to the elbow's point
    put(egg(add(hu.tail, [0, -0.06 * k, 0.02 * k]), Z, X, [0.06 * k, 0.05 * k, 0.05 * k], trunk(`humerus${side}`)));
    // THE THIGH and the stifle, part of the hindquarters' mass
    const fe = bn[`femur${side}`];
    put(eggAlong(fe.head, fe.tail, 0, 1.05, 0.13 * k, 0.17 * k, X, trunk(`femur${side}`), [s * 0.01 * k, 0.03 * k, 0]));
    put(egg(add(fe.tail, [s * 0.01 * k, 0.05 * k, 0]), Z, X, [0.07 * k, 0.065 * k, 0.07 * k], trunk(`femur${side}`)));
  }

  // THE NECK: its masses midway between its crest (from just ahead of the withers to the poll, ARCHED) and its
  // underline (from the breast's front to the throatlatch), deep at the base and thin at the throat; the mane on the crest
  const poll = P.neck[P.neck.length - 1];
  const { crestAt, crestUp } = neckCrest(B, S);
  // (the throatlatch: a narrow waist under and behind the poll, BEHIND the jaw's rear edge, so the jowl stands clear)
  const under0 = W([T.neck[0][0] + 0.15 * k, T.neck[0][1] - 0.06 * k]), under1 = add(poll, [0, -0.13 * h, -0.16 * h]);
  const NS = 7, neckBone = (t) => `neck${Math.min(4, Math.floor(t * 5))}`, poleBone = (t) => (t < 0 ? 'spine3' : t > 1 ? 'head' : neckBone(t));
  const ctr = (t) => mul(add(crestAt(t), lerp3(under0, under1, t)), 0.5);
  const depth = (t) => len(sub(crestAt(t), lerp3(under0, under1, t))) / 2;
  const width = (t) => (NECK_SHAPE.base + (NECK_SHAPE.throat - NECK_SHAPE.base) * t) * k;
  for (let i = 0; i < NS; i++) {
    const t0 = i / NS, t1 = (i + 1) / NS, tm = (t0 + t1) / 2;
    // (each a span between the bones at its two ends, the base's from the withers: the neck bends along its masses and
    // its crest stretches over the withers as it drops, where masses each riding one bone would part at the joints)
    const spanAt = (f0, f1) => ({ span: [poleBone(t0 + (t1 - t0) * f0), poleBone(t0 + (t1 - t0) * f1)] });
    put(eggAlong(ctr(t0), ctr(t1), -0.2, i === NS - 1 ? 1.0 : 1.2, width(tm), depth(tm) * 0.98, X, { ...trunk(neckBone(tm)), ...spanAt(-0.2, i === NS - 1 ? 1.0 : 1.2) }));
    put(eggAlong(crestAt(t0), crestAt(t1), -0.25, 1.25, 0.035 * k, 0.045 * k, X, { ...trunk(neckBone(tm), 'mane'), ...spanAt(-0.25, 1.25) }, mul(crestUp, -0.01 * k)));
  }

  // THE HEAD: a loft of cross-sections along the head bone (the poll to the muzzle), each between the face's top line
  // and the jaw's underline at its station and as wide as the head is there (HEAD_PROFILE, the record's proportions);
  // then the jowls, the brows over the eyes, the eyes, the nostrils' rims, the upper lip, the chin; the nostrils cut in.
  // `face` is the face's front (forward and up), square to the bone in the mid-plane.
  const hd = bn.head, H0 = hd.head, H1 = hd.tail, hl = len(sub(H1, H0)), hdir = unit(sub(H1, H0)), face = unit(cross(X, hdir));
  const hh = hl / 0.6, sty = B.register === 'stylized';
  const at = (f, u = 0, sd = 0) => add(add(add(H0, mul(hdir, f * hl)), mul(face, u * hh)), [sd * hh, 0, 0]);
  const head = (group = 'body', bone = 'head') => ({ bone, group, set: 'head' });
  const HP = HEAD_PROFILE;
  // (one egg CENTRED on each station at that station's section, long enough to overlap its neighbours: an egg between
  // two stations narrows toward its ends and undershoots the profile at both)
  for (let i = 0; i < HP.length; i++) {
    const [f, t, b, w] = HP[i], gap = Math.max(i > 0 ? f - HP[i - 1][0] : 0, i + 1 < HP.length ? HP[i + 1][0] - f : 0);
    const wide = sty && f < 0.45 ? w * 1.08 : w;                                  // the stylized forehead broader
    put(egg(at(f, (t + b) / 2), hdir, X, [gap * hl * 1.6, wide * hh, ((t - b) / 2) * hh], head(i >= HP.length - 3 ? 'muzzle' : 'body')));
  }
  for (const s of [1, -1]) {
    put(egg(at(0.23, -0.145, s * 0.064), hdir, X, [0.11 * hh, 0.055 * hh, 0.115 * hh], head('body', 'jaw')));    // the jowl: deep and round
    put(egg(at(0.29, 0.032, s * 0.076), hdir, X, [0.05 * hh, 0.024 * hh, 0.022 * hh], head()));                  // the brow: a ridge, not a knob
    put(egg(at(0.945, -0.035, s * 0.046), hdir, X, [0.03 * hh, 0.012 * hh, 0.026 * hh], head('muzzle')));       // the nostril's rim
  }
  put(egg(at(0.975, -0.066), hdir, X, [0.03 * hh, 0.042 * hh, 0.022 * hh], head('muzzle')));                    // the upper lip
  put(egg(at(0.885, -0.11), hdir, X, [0.04 * hh, 0.03 * hh, 0.025 * hh], head('muzzle', 'jaw')));              // the chin
  const detail = (bone, group) => ({ bone, group, set: 'detail' });
  const eyeR = sty ? 1.5 : 1;
  for (const s of [1, -1]) {
    put(egg(at(0.31, 0.018, s * (0.098 + (eyeR - 1) * 0.01)), hdir, X, [0.026 * hh * eyeR, 0.015 * hh * eyeR, 0.021 * hh * eyeR], detail('head', 'eye')));
    const ear = bn[s > 0 ? 'earR' : 'earL'];
    put(cone(ear.head, ear.tail, 0.04 * hh, 0.012 * hh, detail(s > 0 ? 'earR' : 'earL', 'ear')));
  }
  if (!hair) put(egg(at(0.06, 0.07), hdir, X, [0.08 * hh, 0.04 * hh, 0.03 * hh], detail('head', 'mane')));   // the forelock (stand-in)
  // the cuts: the nostrils (tall commas on the muzzle's front-sides). (The mouth's line is not cut: a slit thinner than
  // the grid pinches the skin to slivers; it is the coat's and the shading's to draw.)
  const nr = sty ? 0.8 : 1;
  const nostrils = [1, -1].map((s) => egg(at(0.97, -0.032, s * 0.034), hdir, X, [0.02 * hh * nr, 0.014 * hh * nr, 0.034 * hh * nr], {}));

  // THE LEGS: each its own tight mass
  const legSet = (id) => (bone, group = 'body') => ({ bone, group, set: id });
  const hooves = [];
  for (const s of [1, -1]) {
    const side = s > 0 ? 'R' : 'L';
    const F = legSet(`${side}F`), Hh = legSet(`${side}H`);
    const ra = bn[`radius${side}`], cf = bn[`cannonF${side}`], pf = bn[`pasternF${side}`], hf = bn[`hoofF${side}`];
    put(cone(ra.head, ra.tail, 0.07 * k, 0.042 * k, F(`radius${side}`)));                                   // the forearm
    put(eggAlong(ra.head, ra.tail, 0.0, 0.55, 0.065 * k, 0.07 * k, X, F(`radius${side}`), [0, 0.012 * k, 0]));   // its muscle
    put(egg(ra.tail, Z, X, [0.05 * k, 0.055 * k, 0.05 * k], F(`radius${side}`)));                              // the knee
    const tb = bn[`tibia${side}`], ch = bn[`cannonH${side}`], ph = bn[`pasternH${side}`], hh = bn[`hoofH${side}`];
    put(cone(tb.head, tb.tail, 0.085 * k, 0.05 * k, Hh(`tibia${side}`)));                                    // the gaskin
    put(eggAlong(tb.head, tb.tail, 0.05, 0.6, 0.06 * k, 0.075 * k, X, Hh(`tibia${side}`), [0, -0.03 * k, 0]));  // its muscle
    put(egg(tb.tail, Z, X, [0.06 * k, 0.055 * k, 0.062 * k], Hh(`tibia${side}`)));                             // the hock
    put(egg(add(tb.tail, [0, -0.065 * k, 0.05 * k]), Z, X, [0.04 * k, 0.03 * k, 0.03 * k], Hh(`tibia${side}`)));   // its point
    for (const [can, pas, hoof, L, lw] of [[cf, pf, hf, F, 'F'], [ch, ph, hh, Hh, 'H']]) {
      const cb = `cannon${lw}${side}`, pb = `pastern${lw}${side}`, hb = `hoof${lw}${side}`;
      put(eggAlong(can.head, can.tail, 0, 1, 0.034 * k, 0.042 * k, X, L(cb, 'points'), [0, -0.008 * k, 0], 1.08));   // the cannon
      put(egg(add(can.tail, [0, -0.01 * k, 0]), Z, X, [0.05 * k, 0.046 * k, 0.05 * k], L(cb, 'points')));             // the fetlock
      put(cone(pas.head, pas.tail, 0.036 * k, 0.034 * k, L(pb, 'points')));                                          // the pastern
      // the hoof: a cone flared from the coronet to the sole, along the pastern's line, cut flat at the ground
      const hs = B.hoof.toe - B.hoof.heel, axis = unit(sub(pas.tail, pas.head)), top = add(pas.tail, mul(axis, -0.03 * k));   // the coronet
      const bottom = add(top, mul(axis, (top[2] - 0.004) / Math.max(0.3, -axis[2])));
      hooves.push(put(cone(top, add(bottom, [0, 0.01 * k, 0]), 0.046 * hs / 0.13, 0.066 * hs / 0.13, { ...L(hb, 'hoof'), cutGround: true })));
    }
  }

  // THE TAIL: the dock
  for (let i = 0; i < 4; i++) { const t = bn[`tail${i}`]; put(cone(t.head, t.tail, (0.065 - 0.009 * i) * k, (0.056 - 0.009 * i) * k, trunk(`tail${i}`))); }
  // (the tail's hair is cards, hair.js; without them a stand-in mass)
  if (!hair) {
    put(cone(bn.tail1.head, bn.tailHair.tail, 0.04 * k, 0.03 * k, detail('tailHair', 'tail')));
    put(cone(bn.tail3.tail, bn.tailHair.tail, 0.06 * k, 0.035 * k, detail('tailHair', 'tail')));
  }

  return { prims, nostrils, stand: S };
}

/** the prim's distance at p (an array) */
function primDistance(q, p) {
  if (q.kind === 'egg') return sdEgg(p, q);
  const d = sdCone(p, q.a, q.b, q.r1, q.r2);
  return q.cutGround ? Math.max(d, -p[2]) : d;
}

export function bodyField(B, { register, only } = {}) {
  // `only` (a test on a mass): the field of those masses alone, blended the same way (a local field, for a strand)
  const all = bodyPrims(B), stand = all.stand, nostrils = only ? [] : all.nostrils, prims = only ? all.prims.filter(only) : all.prims;
  const soft = (register ?? B.register) === 'stylized' ? 1.6 : 1;
  const k = B.scale, kT = BLEND.trunk * k * soft, kH = BLEND.head * k * Math.sqrt(soft), kL = BLEND.leg * k * Math.sqrt(soft), kJ = BLEND.join * k * soft, kD = BLEND.detail * k;
  const sets = [...new Set(prims.map((q) => q.set))];
  const distances = (p) => prims.map((q) => {
    // far from a mass its distance is bounded below by the distance to its bounding sphere: enough for the blend
    const far = len(sub(p, q.c)) - q.R;
    return far > 0.25 ? far : primDistance(q, p);
  });
  // the blend of the masses' distances (at a point p, the nostrils cut at pn: the same point at the stand, the head's
  // rest-frame point in a pose)
  const compose = (ds, pn) => {
    const bySet = (set, kk) => softMin(prims.flatMap((q, i) => (q.set === set ? [ds[i]] : [])), kk);
    const legs = sets.filter((s2) => /^[RL][FH]$/.test(s2)).map((s2) => bySet(s2, kL));
    const groups = [bySet('trunk', kT), bySet('head', kH), ...legs].filter((x) => Number.isFinite(x));
    let d = groups.length ? softMin(groups, kJ) : Infinity;
    const det = prims.flatMap((q, i) => (q.set === 'detail' ? [ds[i]] : []));
    if (det.length) d = softMin([d, ...det].filter((x) => Number.isFinite(x)), kD);
    for (const n of nostrils) d = smax(d, -sdEgg(pn, n), 0.005 * k);
    return d;
  };
  const field = (p0) => {
    const p = Array.isArray(p0) ? p0 : [p0.x, p0.y, p0.z];
    return compose(distances(p), p);
  };
  // THE POSED FIELD: every mass carried rigidly by its bone from the stand (`rest`, boneFrames) into a pose (`pose`):
  // its distance at p is its distance at the stand from p taken back into its bone's rest frame; blended as at the
  // stand, so where a fold brings masses together the blend unions them and where it parts them the blend spans the gap
  const posed = (rest, pose) => {
    const back = {};
    for (const id of Object.keys(rest)) {
      const r = rest[id], f = pose[id];
      if (!f) continue;
      back[id] = (x) => { const q = sub(x, f.h), l = [dot(q, f.R[0]), dot(q, f.R[1]), dot(q, f.R[2])]; return add(add(add(mul(r.R[0], l[0]), mul(r.R[1], l[1])), mul(r.R[2], l[2])), r.h); };
    }
    const id3 = (x) => x, carry = prims.map((q) => back[q.bone] ?? id3);
    const fwd = (id, x) => { const r = rest[id], f = pose[id]; if (!r || !f) return x; const q = sub(x, r.h), l = [dot(q, r.R[0]), dot(q, r.R[1]), dot(q, r.R[2])]; return add(add(add(mul(f.R[0], l[0]), mul(f.R[1], l[1])), mul(f.R[2], l[2])), f.h); };
    const turnOf = (id, v) => { const r = rest[id], f = pose[id]; if (!r || !f) return v; const l = [dot(v, r.R[0]), dot(v, r.R[1]), dot(v, r.R[2])]; return add(add(mul(f.R[0], l[0]), mul(f.R[1], l[1])), mul(f.R[2], l[2])); };
    // a SPAN (a muscle from its origin on one bone to its insertion on another): its poles carried each by its own bone,
    // the egg rebuilt between them, its girth changed as its length is (its volume kept: it thins as it stretches)
    const spans = prims.map((q) => {
      if (!q.span) return null;
      const u = q.ax[0], r0 = q.r[0], a = fwd(q.span[0], sub(q.c, mul(u, r0))), b = fwd(q.span[1], add(q.c, mul(u, r0)));
      const u2 = unit(sub(b, a)), L = len(sub(b, a)) / 2, g = Math.sqrt(r0 / L), v0 = turnOf(q.span[0], q.ax[1]), v2 = unit(sub(v0, mul(u2, dot(v0, u2))));
      return { kind: 'egg', c: lerp3(a, b, 0.5), ax: [u2, v2, cross(u2, v2)], r: [L, q.r[1] * g, q.r[2] * g] };
    });
    const centres = prims.map((q, i) => spans[i]?.c ?? fwd(q.bone, q.c)), nose = back.head ?? id3;
    const dsAt = (p) => prims.map((q, i) => { const far = len(sub(p, centres[i])) - q.R * (spans[i] ? Math.max(1, spans[i].r[0] / q.r[0]) : 1); return far > 0.25 ? far : spans[i] ? sdEgg(p, spans[i]) : primDistance(q, carry[i](p)); });
    const fn = (p0) => { const p = Array.isArray(p0) ? p0 : [p0.x, p0.y, p0.z]; return compose(dsAt(p), nose(p)); };
    fn.spans = spans;                                                             // (the spans as rebuilt in the pose)
    return fn;
  };
  return { field, posed, prims, distances, stand, blend: { kT, kH, kL, kJ, kD } };
}

/** the body's bounds: the stand's extent, padded */
function boundsOf(stand, pad) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const b of Object.values(stand.bones)) for (const p of [b.head, b.tail]) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i]); mx[i] = Math.max(mx[i], p[i]); }
  mn[0] -= 0.35; mx[0] += 0.35;
  return { min: { x: mn[0] - pad, y: mn[1] - pad, z: Math.min(-0.02, mn[2] - pad) }, max: { x: mx[0] + pad, y: mx[1] + pad, z: mx[2] + pad } };
}

export function bodyMesh(B, { cells = 96, register } = {}) {
  const F = bodyField(B, { register });
  const bounds = boundsOf(F.stand, 0.12 * B.scale);
  const faces = surfaceNetFaces(F.field, bounds, { cells });
  // index the shared corners (surface nets reuses one corner object per cell)
  const index = new Map(), vertices = [], quads = [];
  for (const f of faces) quads.push(f.corners.map((c) => { if (!index.has(c)) { index.set(c, vertices.length); vertices.push([c.x, c.y, c.z]); } return index.get(c); }));
  // normals: the field's gradient at each vertex (exact: the field is analytic)
  const e = 1e-3, normals = vertices.map((v) => unit([
    F.field([v[0] + e, v[1], v[2]]) - F.field([v[0] - e, v[1], v[2]]),
    F.field([v[0], v[1] + e, v[2]]) - F.field([v[0], v[1] - e, v[2]]),
    F.field([v[0], v[1], v[2] + e]) - F.field([v[0], v[1], v[2] - e]),
  ]));
  // WEIGHTS from the blend, PARTS from the strongest mass. A vertex follows only the limbs of its own side (its
  // strongest mass's), or none (the axial bones): a vertex between the legs must not tear when they swing apart.
  // Then smoothed over the mesh (each vertex toward its neighbours' mix, a few rounds), so a weight changes across
  // the elbow's and the stifle's folds over a band of the skin rather than an edge; then the four strongest kept.
  const kw = 0.035 * B.scale, raw = [], parts = [], owns = [];
  const sideOf = (bone) => (/[RL]$/.test(bone) && !/^ear/.test(bone) ? bone.slice(-1) : null);
  // a limb bone weights only the skin within its reach of its own segment (the forearm never reaches the chest)
  const segs = Object.fromEntries(Object.entries(F.stand.bones).map(([id, b]) => [id, b]));
  const segDist = (v, b) => { const d = sub(b.tail, b.head), L2 = dot(d, d) || 1, t = Math.min(1, Math.max(0, dot(sub(v, b.head), d) / L2)); return len(sub(v, add(b.head, mul(d, t)))); };
  const REACH = { scapula: 0.22, humerus: 0.20, radius: 0.075, cannonF: 0.07, pasternF: 0.07, hoofF: 0.09, femur: 0.24, tibia: 0.095, cannonH: 0.07, pasternH: 0.07, hoofH: 0.09 };
  const reachOf = (bone) => { const m2 = /^(scapula|humerus|radius|cannonF|pasternF|hoofF|femur|tibia|cannonH|pasternH|hoofH)[RL]$/.exec(bone); return m2 ? REACH[m2[1]] * B.scale : Infinity; };
  // the reach's gate, soft: full within it, falling to nothing over half a reach beyond (a sharp gate is a seam)
  const gate = (v, bone) => { const R = reachOf(bone); if (R === Infinity) return 1; const x = (segDist(v, segs[bone]) - R) / (0.5 * R); if (x <= 0) return 1; if (x >= 1) return 0; const u = 1 - x; return u * u * (3 - 2 * u); };
  for (const v of vertices) {
    const ds = F.distances(v);
    let m = Infinity, best = 0;
    ds.forEach((d, i) => { if (d < m) { m = d; best = i; } });
    const own = sideOf(F.prims[best].bone) ?? (Math.abs(v[0]) < 0.06 * B.scale ? null : v[0] > 0 ? 'R' : 'L');
    const byBone = new Map();
    ds.forEach((d, i) => {
      const q = F.prims[i], w0 = Math.exp(-(d - m) / kw);
      // a span's share split along it: its origin's bone at one pole, its insertion's at the other (smoothly between)
      let shares = [[q.bone, 1]];
      if (q.span) { const t = Math.min(1, Math.max(0, (dot(sub(v, q.c), q.ax[0]) / q.r[0] + 1) / 2)), sm = t * t * (3 - 2 * t); shares = [[q.span[0], 1 - sm], [q.span[1], sm]]; }
      for (const [bone, sh] of shares) {
        const sd = sideOf(bone);
        if (sd && sd !== own) continue;                                             // never the other side's limbs
        const g = gate(v, bone);                                                    // nor a limb bone out of its reach
        if (g <= 0) continue;
        const w = w0 * sh * g;
        if (w > 1e-4) byBone.set(bone, (byBone.get(bone) || 0) + w);
      }
    });
    if (!byBone.size) byBone.set(F.prims[best].bone, 1);
    raw.push(byBone); owns.push(own);
    parts.push(F.prims[best].group);
  }
  const nbr = vertices.map(() => new Set());
  for (const q of quads) for (let i = 0; i < 4; i++) { nbr[q[i]].add(q[(i + 1) % 4]); nbr[q[(i + 1) % 4]].add(q[i]); }
  const norm = (mp) => { let t = 0; for (const w of mp.values()) t += w; const o = new Map(); for (const [b2, w] of mp) o.set(b2, w / t); return o; };
  let cur = raw.map(norm);
  for (let it = 0; it < 8; it++) {
    cur = cur.map((mp, i) => {
      const o = new Map(); for (const [b2, w] of mp) o.set(b2, 0.5 * w);
      const n = nbr[i].size;
      for (const j of nbr[i]) for (const [b2, w] of cur[j]) {
        const sd = sideOf(b2);
        if (sd && sd !== owns[i]) continue;                                         // the same gates as above
        const g = gate(vertices[i], b2);
        if (g > 0) o.set(b2, (o.get(b2) || 0) + 0.5 * w * g / n);
      }
      return norm(o);
    });
  }
  const weights = cur.map((mp) => {
    const top = [...mp.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 4);
    const sum = top.reduce((t, [, w]) => t + w, 0);
    return top.map(([bone, w]) => [bone, w / sum]);
  });
  // watertight: every edge shared by exactly two quads
  const edges = new Map();
  for (const q of quads) for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], key = a < b ? `${a}:${b}` : `${b}:${a}`; edges.set(key, (edges.get(key) || 0) + 1); }
  let open = 0, nonManifold = 0;
  for (const c of edges.values()) { if (c === 1) open++; else if (c > 2) nonManifold++; }
  return { vertices, quads, normals, weights, parts, bounds, stand: F.stand, prims: F.prims, stats: { vertices: vertices.length, quads: quads.length, triangles: quads.length * 2, open, nonManifold } };
}
