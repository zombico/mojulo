/**
 * THE FEATURE BODY: a mascot in the `feature` style (feature animation's animals: docs/mascot.md) drawn as ONE SKIN OF
 * EGGS, the 1028 relational route made whole-body. Relations in head units place points in the animal's frame; an egg sits
 * on each, riding a rig bone; the eggs blend smoothly into one closed skin, netted along its surface (skin-net.js), its
 * normals from the field, so a smooth finish shades as one rounded form with fillets where masses meet.
 *
 *   egg({ c, u, r, e, hint, bone, group, join })   an egg: centre c, axis u (toward its THIN end), radii r [along u, across,
 *                     deep], its eggliness e (0 an ellipsoid … 1: the share by which its fat half is shorter and its thin
 *                     half longer and narrowing), the across axis taken from `hint`, the bone it rides, the colour group
 *                     its surface takes where it is the nearest egg, and `join` the softness with which it melts into its
 *                     neighbours (a fillet's width, metres: the softer of a pair's two joins)
 *   tuft({ root, aim, len, r, tip, curl, bend, bone, group, join })   a TUFT, the fur's pointed detail on the round eggs
 *                     (the principle: round blobs, pointy fur details): a lock as the realistic hair draws one, a rounded
 *                     body tapering to a rounded point along a spine that bends `curl` degrees from its aim toward `bend`,
 *                     its root radius r, its tip's share of it; it melts into the skin at its root only, so its point stays
 *   cone({ a, b, ra, rb, bone, group, join })   one round cone on a bone: a streamlined limb is two, shoulder to elbow to
 *                     wrist, their radii meeting at the elbow (no egg's bulge there); a finger is two, knuckle to tip
 *   eggDistance(E, p)   an approximate signed distance (negative inside), an egg's or a tuft's
 *   eggField(eggs)      → { field(p), nearest(p), weights(p) }: the superposition (the nearest three folded by a polynomial
 *                     smooth-min) and the skin's WEIGHTS from it: a point belongs to the bones of the eggs it is made of,
 *                     each by how near it is against the nearest, over the softness of their join; at most four bones
 *   eggSkin(eggs, { cell, faces, zones })   → a layer-1 mesh part (closed), each point bound by its weights (`st0.<id>`),
 *                     the coat's ZONES cut into it along their exact edges (feature-coat.js cutSkin), with its points and
 *                     faces as arrays (V, F) for the coat's layers; kept by key (a few seconds a body)
 *   FEATURE_BUILDS      the builds by family: relations in head units (h) → the eggs (the right side and the midline;
 *                     the left mirrored), the rig's joints, the head's ellipsoid (the face is placed on it) and the muzzle
 *   featurePlan(sheet, { title?, reactions? }) → { plan, H, height }   the creature plan: the skin, the face's parts
 *                     (feature-face.js: globes, lids and brows about each globe's centre), the mascot's rig and clips
 *                     (mascot-form.js rigOf)
 *
 * Pure and deterministic: fixed loops, ties by index; no dice, no clock.
 */
import { netSkin, soundMesh, simplifyMesh, fieldNormals } from '../polygonizer/skin-net.js';
import { smin, sdRoundCone } from '../polygonizer/vajra.js';
import { PLAN_SCHEMA } from '../polygonizer/station-loft-plan.js';
import { featureFace } from './feature-face.js';
import { cutSkin, coatLayers, stroke, band } from './feature-coat.js';
import { measuresOf, rigOf, coatPalette } from './mascot-form.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mirrorX = (p) => [-p[0], p[1], p[2]];
const twin = (s) => (typeof s === 'string' ? s.replace(/R$/, 'L') : s);

/** the skin: its net's cell and its faces after simplifying, as shares of the figure's height; the weights' floor */
export const FEATURE_SKIN = Object.freeze({ cell: 0.0075, faces: 14000, floor: 0.02, bones: 4, near: 3 });

export function egg({ c, u, r, e = 0, hint = [1, 0, 0], bone, group = 'Body', join, name }) {
  const U = unit(u), h0 = Math.abs(dot(unit(hint), U)) > 0.95 ? [0, 1, 0] : hint, Vv = unit(sub(h0, mul(U, dot(h0, U)))), W = cross(U, Vv);
  return Object.freeze({ name, c, u: U, v: Vv, w: W, r, e, bone, group, join });
}

const P3 = (p) => ({ x: p[0], y: p[1], z: p[2] });
export function tuft({ root, aim, len, r, tip = 0.22, curl = 0, bend = [0, 0, -1], bone, group = 'Body', join, name }) {
  const A = unit(aim), B0 = sub(bend, mul(A, dot(bend, A))), Bn = Math.hypot(...B0) > 1e-9 ? unit(B0) : [0, 0, 0], N = 3, segs = [];
  const dirAt = (t) => unit(add(mul(A, Math.cos((curl * t * Math.PI) / 180)), mul(Bn, Math.sin((curl * t * Math.PI) / 180))));
  const rAt = (t) => r * (1 - (1 - tip) * Math.pow(t, 0.85));
  let p = root;
  for (let i = 0; i < N; i++) { const q = add(p, mul(dirAt((i + 0.5) / N), len / N)); segs.push([P3(p), P3(q), rAt(i / N), rAt((i + 1) / N)]); p = q; }
  const c = mul(add(root, p), 0.5);
  return Object.freeze({ name, kind: 'tuft', segs, c, R: len / 2 + r, Rin: rAt(0.5) * 0.5, bone, group, join });
}

/** a CONE: one round cone from a to b (radii ra, rb) riding a bone: a streamlined limb's link, a finger's */
export function cone({ a, b, ra, rb, bone, group = 'Body', join, name }) {
  return Object.freeze({ name, kind: 'tuft', segs: [[P3(a), P3(b), ra, rb]], c: mul(add(a, b), 0.5), R: Math.hypot(...sub(b, a)) / 2 + Math.max(ra, rb), Rin: Math.min(ra, rb) * 0.9, bone, group, join });
}

/** how far an egg or a tuft reaches from its middle (an upper bound), and a ball about its middle inside it */
const reachOf = (E) => (E.kind === 'tuft' ? E.R : Math.max(...E.r) * (1 + E.e / 2));
const coreOf = (E) => (E.kind === 'tuft' ? E.Rin : Math.min(...E.r) * (1 - E.e / 2) * (1 - 0.35 * E.e));

export function eggDistance(E, p) {
  if (E.kind === 'tuft') { const q = P3(p); let d = Infinity; for (const [a, b, ra, rb] of E.segs) d = Math.min(d, sdRoundCone(q, a, b, ra, rb)); return d; }
  const d = sub(p, E.c), a = dot(d, E.u), b = dot(d, E.v), w = dot(d, E.w);
  const ra = E.r[0] * (a > 0 ? 1 + E.e / 2 : 1 - E.e / 2), t = a > 0 ? Math.min(1, a / ra) : 0, s = 1 - 0.35 * E.e * t;
  const rb = E.r[1] * s, rc = E.r[2] * s;
  const k0 = Math.hypot(a / ra, b / rb, w / rc), k1 = Math.hypot(a / (ra * ra), b / (rb * rb), w / (rc * rc));
  return k1 > 1e-12 ? (k0 * (k0 - 1)) / k1 : -Math.min(ra, rb, rc);
}

export function eggField(eggs, { near = FEATURE_SKIN.near, bones = FEATURE_SKIN.bones, floor = FEATURE_SKIN.floor } = {}) {
  const n = eggs.length, D = new Float64Array(n), order = Array.from({ length: n }, (_, i) => i);
  const measure = (p) => { for (let i = 0; i < n; i++) D[i] = eggDistance(eggs[i], p); order.sort((i, j) => D[i] - D[j] || i - j); };
  // (the field reads the nearest three alone, picked without sorting, an egg measured only when its bounding ball could
  // put it among them: it is sampled hundreds of thousands of times)
  const Rmax = eggs.map(reachOf), Rmin = eggs.map(coreOf);
  const C = new Float64Array(n);
  const field = (q) => {
    const p = [q.x, q.y, q.z];
    let u0 = Infinity, u1 = Infinity, u2 = Infinity;
    for (let i = 0; i < n; i++) {
      const c = eggs[i].c, dc = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]), ub = dc - Rmin[i];
      C[i] = dc - Rmax[i];
      if (ub < u0) { u2 = u1; u1 = u0; u0 = ub; } else if (ub < u1) { u2 = u1; u1 = ub; } else if (ub < u2) u2 = ub;
    }
    let a = -1, b = -1, c = -1;
    for (let i = 0; i < n; i++) {
      if (C[i] > u2) continue;
      const d = (D[i] = eggDistance(eggs[i], p));
      if (a < 0 || d < D[a]) { c = b; b = a; a = i; } else if (b < 0 || d < D[b]) { c = b; b = i; } else if (c < 0 || d < D[c]) c = i;
    }
    let d = D[a], k = eggs[a].join;
    for (const j of near >= 3 ? [b, c] : near === 2 ? [b] : []) { if (j < 0) continue; d = smin(d, D[j], Math.min(k, eggs[j].join)); k = Math.max(k, eggs[j].join); }
    return d;
  };
  const nearest = (p) => { measure(p); return order[0]; };
  const weights = (p) => {
    measure(p);
    const i0 = order[0], d0 = D[i0], by = {};
    for (let m = 0; m < n; m++) {
      const i = order[m], tau = 0.3 * Math.min(eggs[i].join, eggs[i0].join), x = (D[i] - d0) / tau;
      if (x > 6) break;
      by[eggs[i].bone] = (by[eggs[i].bone] ?? 0) + Math.exp(-x);
    }
    const kept = Object.entries(by).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, bones);
    let sum = kept.reduce((s, [, w]) => s + w, 0);
    const out = kept.map(([b, w]) => [b, w / sum]).filter(([, w]) => w >= floor);
    sum = out.reduce((s, [, w]) => s + w, 0);
    const W = out.map(([b, w]) => [b, r4(w / sum)]), rest = r4(1 - W.reduce((s, [, w]) => s + w, 0));
    W[0][1] = r4(W[0][1] + rest);
    return Object.fromEntries(W);
  };
  return { field, nearest, weights };
}

const SKINS = new Map();
export function eggSkin(eggs, { cell = FEATURE_SKIN.cell, faces = FEATURE_SKIN.faces, group = 'Body', zones = [] } = {}) {
  const key = JSON.stringify([eggs, cell, faces, group, zones]);
  if (SKINS.has(key)) return SKINS.get(key);
  const F = eggField(eggs), f = F.field, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const E of eggs) { const R = reachOf(E) + E.join; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], E.c[k] - R); hi[k] = Math.max(hi[k], E.c[k] + R); } }
  const box = { min: { x: lo[0], y: lo[1], z: lo[2] }, max: { x: hi[0], y: hi[1], z: hi[2] } };
  const net = netSkin(f, box, { cell, project: 2 });
  const grad = (q) => { const e = cell * 0.25, P = (x, y, z) => f({ x, y, z }); return [P(q[0] + e, q[1], q[2]) - P(q[0] - e, q[1], q[2]), P(q[0], q[1] + e, q[2]) - P(q[0], q[1] - e, q[2]), P(q[0], q[1], q[2] + e) - P(q[0], q[1], q[2] - e)]; };
  const F0 = soundMesh(net.V, net.F, { out: grad, min: 64 });
  const S0 = simplifyMesh(net.V, F0, { target: faces, turn: 0.35 });
  // (the coat's zones cut into it along their exact edges: feature-coat.js)
  const S = cutSkin(S0, zones, { field: f, shapes: eggs });
  const N = fieldNormals(S.V, f, 1e-5), points = {}, normals = {}, tris = {}, groups = {}, blend = {};
  S.V.forEach((p, v) => { points[`v${v}`] = p.map(r6); normals[`v${v}`] = N[v].map(r4); blend[`st0.v${v}`] = F.weights(p); });
  S.F.forEach((t, fi) => { tris[`f${fi}`] = t.map((v) => `v${v}`); if (S.groups[fi] && S.groups[fi] !== group) groups[`f${fi}`] = S.groups[fi]; });
  const out = { mesh: { points, faces: tris, groups, normals }, blend, V: S.V, F: S.F };
  if (SKINS.size >= 8) SKINS.delete(SKINS.keys().next().value);
  SKINS.set(key, out);
  return out;
}

/**
 * THE BUILDS. Relations in head units (h, the head's height, crown to chin; z up from the soles, y to the front, the right
 * side +x), read off the operator's reference for the raccoon (cartoon realism: the animal's own body, one pear-shaped
 * mass, the head sunk into it with no neck, big haunches, short limbs, the forelimbs resting out from the body so the skin
 * does not web them to it; the clips pose them).
 *   heads   the figure's height to the crown in heads
 *   eggs    { name, c, u, r, e?, hint?, bone, group?, join } (r and join in h; a name ending R is mirrored to its L twin)
 *   joints  the rig's (mascot-form.js rigOf), right side: hip knee ankle toeBase toeTip shoulder elbow wrist knuckles
 *   hipZ, neckZ, top   the pelvis's hub, the torso's top, the crown
 *   head    the egg the face is placed on (the cranium: its centre and radii as an ellipsoid), muzzle the mouth's
 */
const ARM = unit([0.74, 0.1, -0.66]), SPREAD = unit(cross(ARM, [0, 1, 0]));
const at = (p, d, s) => add(p, mul(d, s));
export const FEATURE_BUILDS = Object.freeze({
  procyonid: (() => {
    const sh = [0.66, 0.04, 2.02], el = at(sh, ARM, 0.5), wr = at(el, ARM, 0.44), kn = at(wr, ARM, 0.24);
    return Object.freeze({
      heads: 3.3,
      eggs: [
        // the head: a wedge (the cranium's fat end down into the jowls), the cheek ruffs flaring out at the face's widest
        // (the head wider than the body), the muzzle short and pale, its nose ball, the ears
        { name: 'cranium', c: [0, 0.02, 2.8], u: [0, -0.12, 1], r: [0.55, 0.72, 0.6], e: 0.3, bone: 'head', join: 0.18 },
        { name: 'ruffR', c: [0.5, 0.08, 2.5], u: [0.78, 0.05, -0.62], r: [0.34, 0.3, 0.26], e: 0.85, hint: [0, 1, 0], bone: 'head', join: 0.2 },
        { name: 'jowlR', c: [0.34, 0.24, 2.44], u: [0.6, 0.3, -0.75], r: [0.24, 0.22, 0.2], e: 0.5, hint: [0, 1, 0], bone: 'head', group: 'Belly', join: 0.14 },
        { name: 'muzzle', c: [0, 0.48, 2.54], u: [0, 1, -0.12], r: [0.3, 0.22, 0.18], e: 0.45, bone: 'head', group: 'Belly', join: 0.12 },
        { name: 'chin', c: [0, 0.36, 2.37], u: [0, 1, 0], r: [0.15, 0.16, 0.12], bone: 'head', group: 'Belly', join: 0.1 },
        { name: 'nose', c: [0, 0.79, 2.58], u: [0, 1, 0.2], r: [0.09, 0.11, 0.08], bone: 'head', group: 'Nose', join: 0.03 },
        { name: 'earR', c: [0.46, -0.1, 3.24], u: [0.38, -0.1, 1], r: [0.27, 0.21, 0.08], e: 0.75, hint: [1, 0, 0], bone: 'head', join: 0.08 },
        // the body: the chest under the head and the belly low and forward (one pear), the pale front, the haunches
        { name: 'chest', c: [0, 0.03, 1.86], u: [0, 0, 1], r: [0.62, 0.72, 0.64], e: 0.25, bone: 'torso', join: 0.32 },
        { name: 'belly', c: [0, 0.08, 1.02], u: [0, 0, 1], r: [0.84, 0.86, 0.82], e: 0.3, bone: 'pelvis', join: 0.32 },
        { name: 'front', c: [0, 0.3, 1.3], u: [0, 0, 1], r: [0.72, 0.6, 0.58], e: 0.2, bone: 'pelvis', group: 'Belly', join: 0.3 },
        { name: 'haunchR', c: [0.48, -0.06, 0.64], u: [0, 0, 1], r: [0.42, 0.38, 0.46], e: 0.2, bone: 'thighR', join: 0.24 },
        { name: 'shinR', c: [0.46, 0.03, 0.28], u: [0, 0, 1], r: [0.2, 0.17, 0.18], bone: 'shinR', join: 0.12 },
        { name: 'footR', c: [0.46, 0.17, 0.09], u: [0, 1, 0], r: [0.27, 0.19, 0.09], e: 0.25, hint: [1, 0, 0], bone: 'metaR', group: 'Patch', join: 0.08 },
        // the palm: a flat egg, the hand's paddle facing front (the fingers fan across it: `digits`)
        { name: 'pawR', c: at(wr, ARM, 0.09), u: ARM, r: [0.12, 0.12, 0.065], e: 0.15, hint: SPREAD, bone: 'handR', group: 'Patch', join: 0.04 },
        // the tail: out from the lower back, rising, thick (the brush), its eggs overlapping so it reads as one
        { name: 'tail0', c: [0, -0.86, 0.74], u: [0, -1, 0.3], r: [0.34, 0.3, 0.3], bone: 'pelvis', join: 0.26 },
        { name: 'tail1', c: [0, -1.26, 0.92], u: [0, -0.9, 0.45], r: [0.38, 0.38, 0.36], bone: 'pelvis', join: 0.26 },
        { name: 'tail2', c: [0, -1.6, 1.2], u: [0, -0.6, 0.8], r: [0.38, 0.38, 0.36], bone: 'pelvis', join: 0.26 },
        { name: 'tail3', c: [0, -1.76, 1.6], u: [0, -0.15, 1], r: [0.34, 0.32, 0.3], e: 0.55, bone: 'pelvis', join: 0.26 },
      ],
      // the fur's pointed details on the round masses (round blobs, pointy fur): the cheeks end in a fan of locks out,
      // down and back; the chest's pale fur points down over the belly; the tail's brush ends in a point
      tufts: [
        { name: 'cheekAR', root: [0.66, 0.04, 2.5], aim: [0.92, -0.1, -0.38], len: 0.44, r: 0.17, curl: 22, bend: [0, -0.3, -1], bone: 'head', join: 0.07 },
        { name: 'cheekBR', root: [0.6, 0.0, 2.36], aim: [0.62, -0.15, -0.78], len: 0.38, r: 0.15, curl: 18, bend: [0, -1, -0.4], bone: 'head', join: 0.07 },
        { name: 'cheekCR', root: [0.64, 0.06, 2.64], aim: [0.97, -0.15, 0.1], len: 0.34, r: 0.14, curl: 28, bend: [0, -0.4, -1], bone: 'head', join: 0.07 },
        { name: 'chestTuftR', root: [0.22, 0.58, 2.0], aim: [0.3, 0.45, -1], len: 0.3, r: 0.13, curl: 15, bend: [0, -1, 0], bone: 'torso', group: 'Belly', join: 0.06 },
        { name: 'chestTuft', root: [0, 0.62, 1.96], aim: [0, 0.5, -1], len: 0.34, r: 0.14, curl: 15, bend: [0, -1, 0], bone: 'torso', group: 'Belly', join: 0.06 },
        // the dome's spikes: the cheeks' rhythm again, smaller, and NOT mirrored: three locks of falling length, their roots
        // staggered so each overlaps the next, all swept one way (to the right and a little forward, their tips curling
        // down), a combed swoosh
        { name: 'crownA', root: [-0.14, 0.16, 3.3], aim: [0.42, 0.28, 1], len: 0.4, r: 0.12, curl: 24, bend: [1, 0.1, -0.4], bone: 'head', join: 0.05 },
        { name: 'crownB', root: [-0.01, 0.06, 3.34], aim: [0.5, 0.2, 1], len: 0.33, r: 0.11, curl: 22, bend: [1, 0.1, -0.4], bone: 'head', join: 0.05 },
        { name: 'crownC', root: [0.12, -0.04, 3.32], aim: [0.6, 0.12, 1], len: 0.26, r: 0.095, curl: 20, bend: [1, 0.1, -0.4], bone: 'head', join: 0.05 },
        { name: 'tailTip', root: [0, -1.8, 1.82], aim: [0, -0.35, 1], len: 0.3, r: 0.17, curl: 30, bend: [0, -1, 0], bone: 'pelvis', join: 0.1 },
      ],
      // the forelimbs, streamlined: two cones each, shoulder to elbow to wrist, resting out from the body
      limbs: [
        { name: 'upperArmR', a: sh, b: el, ra: 0.16, rb: 0.125, bone: 'upperArmR', join: 0.07 },
        { name: 'foreArmR', a: el, b: wr, ra: 0.125, rb: 0.1, bone: 'foreArmR', join: 0.05 },
      ],
      // the raccoon's hands: five long fingers fanned across the palm (the thumb shortest and set back, on the upper
      // edge), each two links on two bones from its knuckle; rounded tips, not points (fingers are not fur)
      digits: { from: wr, along: ARM, across: SPREAD, at: [0.13, 0.15, 0.16, 0.15, 0.1], offset: [-0.085, -0.04, 0.005, 0.05, 0.09],
        fan: [-48, -22, 2, 26, 56], len: [0.12, 0.15, 0.16, 0.14, 0.1], r: [0.036, 0.031, 0.022], join: 0.01 },
      // THE COAT (feature-coat.js): harmonious shapes, not ink blots, in few strokes. ZONES (territories of the eggs) cut
      // into the skin: the pale muzzle, the nose, the pale belly and chest, the dark paws and feet, the tail's dark tip.
      // LAYERS over it: the mask sweeping out and down to a point aimed as the cheek's lock is, the forehead's stripe
      // tapering to the crown, the inner ears, the tail's notched rings. (The pale brows are the face's own, attached to
      // the eye: feature-face.js.) A stroke `both` is drawn on each side.
      marks: [
        { name: 'muzzle', group: 'Belly', eggs: ['muzzle', 'chin', 'jowlR', 'jowlL'] },
        { name: 'nose', group: 'Nose', eggs: ['nose'] },
        { name: 'belly', group: 'Belly', eggs: ['front', 'chestTuft', 'chestTuftR', 'chestTuftL'] },
        { name: 'paws', group: 'Patch', eggs: ['pawR', 'pawL', 'footR', 'footL', ...[1, 2, 3, 4, 5].flatMap((i) => ['a', 'b'].flatMap((l) => [`digit${i}${l}R`, `digit${i}${l}L`]))] },
        { name: 'tailTip', group: 'Patch', eggs: ['tailTip'] },
        { name: 'mask', group: 'Patch', strokes: [{ both: true, points: [[0.04, 0.68, 2.8], [0.3, 0.56, 2.79], [0.5, 0.38, 2.62], [0.66, 0.22, 2.44]], r: [0.1, 0.19, 0.13, 0.025] }] },
        { name: 'stripe', group: 'Patch', strokes: [{ points: [[0, 0.7, 2.92], [0, 0.55, 3.18], [0, 0.2, 3.36]], r: [0.05, 0.08, 0.02] }] },
        { name: 'ears', group: 'EarInner', strokes: [{ both: true, points: [[0.44, 0.0, 3.08], [0.5, -0.02, 3.3], [0.55, -0.05, 3.48]], r: [0.1, 0.08, 0.02] }] },
        { name: 'rings', group: 'Patch', bands: [
          { c: [0, -1.18, 0.88], axis: [0, -0.9, 0.45], w: 0.07, R: 0.5, teeth: 9, depth: 0.03 },
          { c: [0, -1.56, 1.14], axis: [0, -0.6, 0.8], w: 0.07, R: 0.5, teeth: 9, depth: 0.03 },
          { c: [0, -1.76, 1.52], axis: [0, -0.2, 1], w: 0.06, R: 0.45, teeth: 9, depth: 0.03 },
        ] },
      ],
      eye: { az: 24, el: 0, r: 0.15, proud: 0.42 },
      // the mouth on the muzzle: the nose's foot, the line's middle and right corner, the pivot it opens about; a full
      // smile raises a corner `rise`, the line sags `sag` between
      mouth: { nose: [0, 0.82, 2.48], centre: [0, 0.77, 2.41], corner: [0.17, 0.63, 2.42], pivot: [0, 0.42, 2.52], rise: 0.05, sag: 0.012 },
      joints: { hip: [0.46, 0, 0.76], knee: [0.47, 0.06, 0.42], ankle: [0.47, -0.02, 0.15], toeBase: [0.47, 0.25, 0.06], toeTip: [0.47, 0.42, 0.04], shoulder: sh, elbow: el, wrist: wr, knuckles: kn },
      hipZ: 0.76, neckZ: 2.3, top: 3.42,
      head: { C: [0, 0.02, 2.8], rx: 0.72, ry: 0.6, rz: 0.55 },
      muzzle: { C: [0, 0.54, 2.52], rx: 0.22, ry: 0.3, rz: 0.18 },
    });
  })(),
});

/** a build's relations at a height: the eggs mirrored and scaled to metres, the joints, the head and the muzzle */
function laidOut(build, height) {
  const h = height / build.heads, S = (p) => p.map((x) => r6(x * h));
  const eggs = [];
  for (const x of build.eggs) {
    const one = (name, c, u, bone, hint) => eggs.push(egg({ name, c: S(c), u, r: x.r.map((v) => v * h), e: x.e ?? 0, hint, bone, group: x.group ?? 'Body', join: x.join * h }));
    one(x.name, x.c, x.u, x.bone, x.hint);
    if (/R$/.test(x.name)) one(twin(x.name), mirrorX(x.c), mirrorX(x.u), twin(x.bone), x.hint ? mirrorX(x.hint) : undefined);
  }
  for (const x of build.tufts ?? []) {
    const one = (name, root, aim, bend, bone) => eggs.push(tuft({ name, root: S(root), aim, len: x.len * h, r: x.r * h, tip: x.tip, curl: x.curl, bend, bone, group: x.group ?? 'Body', join: x.join * h }));
    one(x.name, x.root, x.aim, x.bend, x.bone);
    if (/R$/.test(x.name)) one(twin(x.name), mirrorX(x.root), mirrorX(x.aim), x.bend ? mirrorX(x.bend) : undefined, twin(x.bone));
  }
  for (const x of build.limbs ?? []) {
    const one = (name, a, b, bone) => eggs.push(cone({ name, a: S(a), b: S(b), ra: x.ra * h, rb: x.rb * h, bone, group: x.group ?? 'Body', join: x.join * h }));
    one(x.name, x.a, x.b, x.bone);
    if (/R$/.test(x.name)) one(twin(x.name), mirrorX(x.a), mirrorX(x.b), twin(x.bone));
  }
  // the fingers: each a base on the palm's end, fanned from the arm across the palm, two links (the right's; mirrored)
  const digits = [];
  if (build.digits) {
    const D = build.digits;
    D.at.forEach((d0, i) => {
      const fan = (D.fan[i] * Math.PI) / 180, dir = unit(add(mul(D.along, Math.cos(fan)), mul(D.across, Math.sin(fan))));
      const base = add(add(D.from, mul(D.along, d0)), mul(D.across, D.offset[i])), mid = add(base, mul(dir, D.len[i] * 0.55)), tip = add(base, mul(dir, D.len[i]));
      digits.push({ i: i + 1, base, mid, tip });
      for (const [S0, m] of [['R', (p) => p], ['L', mirrorX]]) {
        eggs.push(cone({ name: `digit${i + 1}a${S0}`, a: S(m(base)), b: S(m(mid)), ra: D.r[0] * h, rb: D.r[1] * h, bone: `digit${i + 1}a${S0}`, group: 'Patch', join: D.join * h }));
        eggs.push(cone({ name: `digit${i + 1}b${S0}`, a: S(m(mid)), b: S(m(tip)), ra: D.r[1] * h, rb: D.r[2] * h, bone: `digit${i + 1}b${S0}`, group: 'Patch', join: D.join * h }));
      }
    });
  }
  // (the coat's marks in metres: a stroke drawn `both` mirrored to the left)
  const marks = (build.marks ?? []).map((m) => ({ name: m.name, group: m.group,
    ...(m.eggs ? { eggs: m.eggs } : {}),
    ...(m.strokes ? { strokes: m.strokes.flatMap((x) => { const one = (pts) => stroke({ points: pts.map(S), r: x.r.map((v) => r6(v * h)) }); return x.both ? [one(x.points), one(x.points.map(mirrorX))] : [one(x.points)]; }) } : {}),
    ...(m.bands ? { bands: m.bands.map((B) => band({ c: S(B.c), axis: B.axis, w: B.w * h, R: B.R * h, teeth: B.teeth, depth: (B.depth ?? 0) * h })) } : {}) }));
  const ell = (E) => ({ C: S(E.C), rx: r4(E.rx * h), ry: r4(E.ry * h), rz: r4(E.rz * h) });
  const mouth = build.mouth && { nose: S(build.mouth.nose), centre: S(build.mouth.centre), corner: S(build.mouth.corner), pivot: S(build.mouth.pivot), rise: build.mouth.rise * h, sag: build.mouth.sag * h };
  return { h, eggs, marks, mouth, digits: digits.map((d) => ({ i: d.i, base: S(d.base), mid: S(d.mid), tip: S(d.tip) })), eye: { ...build.eye, r: build.eye.r * h }, J: Object.fromEntries(Object.entries(build.joints).map(([k, p]) => [k, S(p)])), hipZ: r4(build.hipZ * h), neckZ: r4(build.neckZ * h), top: r4(build.top * h), H: ell(build.head), muzzle: ell(build.muzzle) };
}

/** the coat's layers over a skin, kept by key */
const COATS = new Map();
function coatOf(skin, F, eggs, layers) {
  const key = JSON.stringify([skin.V.length, skin.F.length, eggs, layers]);
  if (!COATS.has(key)) { if (COATS.size >= 8) COATS.delete(COATS.keys().next().value); COATS.set(key, coatLayers({ V: skin.V, F: skin.F, field: F.field, shapes: eggs, weights: F.weights }, layers)); }
  return COATS.get(key);
}

/** the feature style's height: the mascot's scale (a sprout's), its head a third of it */
export const FEATURE_HEIGHT = 0.96;

export function featurePlan(sheet, { title = 'a feature animal', reactions = false } = {}) {
  const f = sheet.facets, A = sheet.animal ?? null, K = A?.kit ?? {}, { k } = measuresOf(sheet);
  if (!A) throw new Error('mascot: the feature style draws an animal (a species in the brief or `facets.animal`)');
  const build = FEATURE_BUILDS[A.family] ?? FEATURE_BUILDS.procyonid;
  const L = laidOut(build, FEATURE_HEIGHT), H = L.H;
  const zones = L.marks.filter((m) => !m.strokes && !m.bands), layers = L.marks.filter((m) => m.strokes || m.bands);
  const skin = eggSkin(L.eggs, { zones }), F = eggField(L.eggs);
  const coat = coatOf(skin, F, L.eggs, layers);
  // the face: globes seated on the skin, lids as shells about them, the brows on the eye, the mouth in the muzzle
  const face = featureFace({ field: F.field, H, eye: L.eye, rest: f.expression, mouth: L.mouth,
    groups: { lid: K.pattern === 'mask' ? 'Patch' : 'Body', lip: 'Belly', brow: 'Belly' } });
  const segments = [
    { name: 'skin', kind: 'mesh', group: 'Body', mesh: skin.mesh, bind: { bone: 'pelvis', blend: skin.blend } },
    ...coat,
    ...face.segments,
  ];
  const faceNames = face.segments.flatMap((s) => (s.mirror === 'name' ? [s.name, twin(s.name)] : [s.name]));
  const { rig, clips } = rigOf(f, { J: L.J, H, hipZ: L.hipZ, neckZ: L.neckZ, top: L.top, orb: false, k, face, reactions, headParts: faceNames, upper: [] });
  // the fingers' bones: two links a finger from its knuckle (each tail riding its bone's parent, as the knuckles do)
  for (const d of L.digits) for (const [S0, m] of [['R', (p) => p], ['L', mirrorX]]) {
    const n = (x) => `digit${d.i}${x}${S0}`;
    rig.joints[n('Base')] = { at: m(d.base).map(r4), rides: `hand${S0}` }; rig.joints[n('Mid')] = { at: m(d.mid).map(r4), rides: `hand${S0}` }; rig.joints[n('Tip')] = { at: m(d.tip).map(r4), rides: n('a') };
    rig.bones.push({ id: n('a'), head: n('Base'), tail: n('Mid') }, { id: n('b'), head: n('Mid'), tail: n('Tip') });
  }
  const joints = { ...L.J };
  for (const s of segments) { for (const [n, p] of Object.entries(s.joints || {})) joints[n] = p; delete s.joints; }
  const plan = {
    schema: PLAN_SCHEMA, frame: { up: '+z', front: '+y', note: `metres; ${title}, soles on z = 0` },
    symmetry: { plane: 'x=0', policy: 'the skin given whole; the face\'s side parts authored on the right, mirrored by name' },
    style: { slots: 'ring20', limbSlots: 'ring12', e: 2 },
    joints, segments, dials: {}, rig, clips, paint: [],
    mascot: { energy: f.energy, form: f.form, height: L.top, headR: r4(Math.max(H.rx, H.ry)), style: 'feature' },
    palette: { EarInner: '#c9a19b', ...coatPalette(sheet, k, A, f) },
  };
  return { plan, H, height: L.top };
}
