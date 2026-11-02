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
 *   eggField(eggs, { seam })   → { field(p), nearest(p), weights(p) }: the superposition (the nearest three folded by a polynomial
 *                     smooth-min) and the skin's WEIGHTS from it: a point belongs to the bones of the eggs it is made of,
 *                     each by how near it is against the nearest, over the softness of their join; at most four bones
 *   eggSkin(eggs, { cell, faces, zones })   → a layer-1 mesh part (closed), each point bound by its weights (`st0.<id>`),
 *                     the coat's ZONES cut into it along their exact edges (feature-coat.js cutSkin), with its points and
 *                     faces as arrays (V, F) for the coat's layers; kept by key (a few seconds a body)
 *   FEATURE_BUILDS      the raccoon's build (the grammar's: feature-grammar.js featureBuild makes every animal's)
 *   featureShapes(build) → { L, moved }   the build's shapes laid out in metres, every one attached (feature-attach.js)
 *   featurePlan(sheet, { title?, reactions? }) → { plan, H, height, bake? }   the creature plan: the skin, the face's
 *                     parts (feature-face.js: globes, lids and brows about each globe's centre), the mascot's rig and
 *                     clips (mascot-form.js rigOf); the sheet's `tune` (feature-tune.js) moves the build, sets the skin's
 *                     density by its detail tier and, for the gen7 tier, the light baked into its corners (`bake`)
 *
 * Pure and deterministic: fixed loops, ties by index; no dice, no clock.
 */
import { netSkin, soundMesh, simplifyMesh, fieldNormals, closeHoles } from '../polygonizer/skin-net.js';
import { smin, sdRoundCone } from '../polygonizer/vajra.js';
import { PLAN_SCHEMA, expandPlan } from '../polygonizer/station-loft-plan.js';
import { validateRig, rigNodesAt } from '../polygonizer/station-loft-rig.js';
import { LIMITS } from '../polygonizer/figure-vajra.js';
import { featureFace } from './feature-face.js';
import { cutSkin, coatLayers, stroke, band, cells, markField } from './feature-coat.js';
import { measuresOf, rigOf, coatPalette } from './mascot-form.js';
import { featureBuild } from './feature-grammar.js';
import { resolveTune, detailBake } from './feature-tune.js';
import { tuftColour } from './feature-tufts.js';
import { attachAll } from './feature-attach.js';
import { foursClips, FEATURE_GALLOP, FEATURE_GAIT } from './feature-function.js';
import { FEATURE_TROT, trotMeasures, trotSignals, trotVault } from './feature-trot.js';
import { plumageOf, wingTones } from './feature-birds.js';
import { speciesParams } from '../fauna/species.js';
import { animalCard } from './mascot-animals.js';
import { EXPRESSION_IDS } from './mascot-face.js';

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

/** the skin: its net's cell and its faces after simplifying; the weights' floor, the bones a point may name, the tail's
 *  collar (the share of the blend's width between a tail's shapes and the body's), the hip's (between a thigh's shapes and
 *  the pelvis's: the haunch swings with its leg, so a short hind leg shows stretched out behind a round rump), a FIRM skin's (a striped coat's: the
 *  share of the blend's width between any two bones, so the skin under the stripes stretches only near the joints and
 *  the stripes keep their shape on the run), a stripe's point's weights sharpened (`stripe`: each to that power, the
 *  bone it rides most taking it over: a stripe follows its bones and the coat between takes the stretch), the eggs the
 *  field folds. And the whole figure's TRIANGLE BUDGET: a default game model's (skin, coat, face together) */
export const FEATURE_TRIANGLES = 18000;
export const FEATURE_SKIN = Object.freeze({ cell: 0.0075, faces: 8500, floor: 0.02, bones: 4, near: 3, collar: 0.33, hip: 0.4, firm: 0.5, stripe: 4 });

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

export function eggField(eggs, { near = FEATURE_SKIN.near, bones = FEATURE_SKIN.bones, floor = FEATURE_SKIN.floor, seam = 0, firm = 1 } = {}) {
  // (the SEAM: a pair where one rides the head and the other does not blends no softer than `seam`, so the head stands
  // off the body with a crease under the jaw; the head's own and the body's own blend as their joins say)
  const onHead = eggs.map((E) => E.bone === 'head'), pairK = (i, j, k) => (seam > 0 && onHead[i] !== onHead[j] ? Math.min(k, seam) : k);
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
    for (const j of near >= 3 ? [b, c] : near === 2 ? [b] : []) { if (j < 0) continue; d = smin(d, D[j], pairK(a, j, Math.min(k, eggs[j].join))); k = Math.max(k, eggs[j].join); }
    return d;
  };
  const nearest = (p) => { measure(p); return order[0]; };
  // (THE TAIL'S COLLAR: between a tail's shape and the body's, the weights blend over `collar` of the usual width, so the
  // tail's skin rides its bones and the turn from the rump is taken in a short collar at its root: a tail's ring
  // pattern, riding its bone rigidly (feature-coat.js), moves with the skin under it)
  const onTail = eggs.map((E) => E.bone === 'tail' || E.bone === 'tailEnd'), onThigh = eggs.map((E) => /^thigh[LR]$/.test(E.bone ?? '')), onPelvis = eggs.map((E) => E.bone === 'pelvis');
  const hipPair = (i, j) => (onThigh[i] && onPelvis[j]) || (onPelvis[i] && onThigh[j]);
  const weights = (p) => {
    measure(p);
    const i0 = order[0], d0 = D[i0], by = {};
    for (let m = 0; m < n; m++) {
      const i = order[m], tau = 0.3 * Math.min(eggs[i].join, eggs[i0].join) * (onTail[i] !== onTail[i0] ? FEATURE_SKIN.collar : 1) * (hipPair(i, i0) ? FEATURE_SKIN.hip : 1) * (eggs[i].bone !== eggs[i0].bone ? firm : 1), x = (D[i] - d0) / tau;
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
export function eggSkin(eggs, { cell = FEATURE_SKIN.cell, faces = FEATURE_SKIN.faces, group = 'Body', zones = [], seam = 0, firm = 1 } = {}) {
  const key = JSON.stringify([eggs, cell, faces, group, zones, seam, firm]);
  if (SKINS.has(key)) return SKINS.get(key);
  const F = eggField(eggs, { seam, firm }), f = F.field, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const E of eggs) { const R = reachOf(E) + E.join; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], E.c[k] - R); hi[k] = Math.max(hi[k], E.c[k] + R); } }
  const box = { min: { x: lo[0], y: lo[1], z: lo[2] }, max: { x: hi[0], y: hi[1], z: hi[2] } };
  const net = netSkin(f, box, { cell, project: 2 });
  const grad = (q) => { const e = cell * 0.25, P = (x, y, z) => f({ x, y, z }); return [P(q[0] + e, q[1], q[2]) - P(q[0] - e, q[1], q[2]), P(q[0], q[1] + e, q[2]) - P(q[0], q[1] - e, q[2]), P(q[0], q[1], q[2] + e) - P(q[0], q[1], q[2] - e)]; };
  // (the net pinches where two sheets of the surface pass within a cell, a crease under the jaw, a wing on its flank:
  // soundMesh lets the pinch go, and the holes it leaves are fanned shut on the surface, twice over for a hole whose rim
  // touched itself the first time)
  let M = { V: net.V, F: soundMesh(net.V, net.F, { out: grad, min: 64 }) };
  for (let pass = 0; pass < 2; pass++) { M = closeHoles(M.V, M.F, f); M = { V: M.V, F: soundMesh(M.V, M.F, { out: grad, min: 64 }) }; }
  const S0 = simplifyMesh(M.V, M.F, { target: faces, turn: 0.35 });
  // (the coat's zones cut into it along their exact edges: feature-coat.js)
  const S = cutSkin(S0, zones, { field: f, shapes: eggs });
  const N = fieldNormals(S.V, f, 1e-5), points = {}, normals = {}, tris = {}, groups = {}, blend = {};
  S.V.forEach((p, v) => { points[`v${v}`] = p.map(r6); normals[`v${v}`] = N[v].map(r4); blend[`st0.v${v}`] = F.weights(p); });
  // (a RIGID zone's stripes (a zebra's, a tiger's): each point of a stripe, its edge with it, commits to the bones it
  // rides most (FEATURE_SKIN.stripe), so the stripes keep their shape on the run and the plain coat takes the stretch)
  for (const z of zones.filter((m) => m.rigid)) {
    const inside = markField(z, f, eggs);
    S.V.forEach((p, v) => {
      if (inside(p) > cell * 0.05) return;
      const e = Object.entries(blend[`st0.v${v}`]).map(([b, w]) => [b, Math.pow(w, FEATURE_SKIN.stripe)]), t = e.reduce((a, [, w]) => a + w, 0);
      const kept = e.map(([b, w]) => [b, w / t]).filter(([, w]) => w >= FEATURE_SKIN.floor), t2 = kept.reduce((a, [, w]) => a + w, 0);
      const W = kept.map(([b, w]) => [b, r4(w / t2)]); W[0][1] = r4(W[0][1] + 1 - W.reduce((a, [, w]) => a + w, 0));
      blend[`st0.v${v}`] = Object.fromEntries(W);
    });
  }
  S.F.forEach((t, fi) => { tris[`f${fi}`] = t.map((v) => `v${v}`); if (S.groups[fi] && S.groups[fi] !== group) groups[`f${fi}`] = S.groups[fi]; });
  const out = { mesh: { points, faces: tris, groups, normals }, blend, V: S.V, F: S.F };
  if (SKINS.size >= 8) SKINS.delete(SKINS.keys().next().value);
  SKINS.set(key, out);
  return out;
}

/** the builds come from the grammar (feature-grammar.js featureBuild: a species' card in, a build out); the raccoon's,
 *  for a law that wants one */
export const FEATURE_BUILDS = Object.freeze({ get procyonid() { return featureBuild(animalCard('raccoon')); } });

/** a build's relations at a height: the eggs mirrored and scaled to metres, the joints, the head and the muzzle */
function laidOut(build, height) {
  const h = height / build.heads, S = (p) => p.map((x) => r6(x * h));
  // (the HEAD'S LIFT: everything riding the head raised together, over the neck: its shapes and tufts, the face's marks,
  // the eyes' head, the mouth, the crown)
  const up = build.headLift ?? 0, U0 = (p) => [p[0], p[1], p[2] + up], SH = (p, bone) => S(bone === 'head' ? U0(p) : p);
  const eggs = [];
  for (const x of build.eggs) {
    const one = (name, c, u, bone, hint) => eggs.push(egg({ name, c: SH(c, bone), u, r: x.r.map((v) => v * h), e: x.e ?? 0, hint, bone, group: x.group ?? 'Body', join: x.join * h }));
    one(x.name, x.c, x.u, x.bone, x.hint);
    if (/R$/.test(x.name)) one(twin(x.name), mirrorX(x.c), mirrorX(x.u), twin(x.bone), x.hint ? mirrorX(x.hint) : undefined);
  }
  for (const x of build.tufts ?? []) {
    const one = (name, root, aim, bend, bone) => eggs.push(tuft({ name, root: SH(root, bone), aim, len: x.len * h, r: x.r * h, tip: x.tip, curl: x.curl, bend, bone, group: x.group ?? 'Body', join: x.join * h }));
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
  const marks = (build.marks ?? []).map((m) => ({ name: m.name, group: m.group, ...(m.cut ? { cut: true } : {}), ...(m.rigid ? { rigid: true } : {}), ...(m.levels !== undefined ? { levels: m.levels } : {}),
    ...(m.eggs ? { eggs: m.eggs } : {}),
    ...(m.regions ? { regions: m.regions.map((E) => egg({ c: S(E.c), u: E.u, r: E.r.map((v) => v * h), e: E.e ?? 0, hint: E.hint, bone: null, group: m.group, join: 0 })) } : {}),
    ...(m.strokes ? { strokes: m.strokes.flatMap((x) => { const one = (pts) => stroke({ points: pts.map((p) => SH(p, m.on)), r: x.r.map((v) => r6(v * h)) }); return x.both ? [one(x.points), one(x.points.map(mirrorX))] : [one(x.points)]; }) } : {}),
    ...(m.bands ? { bands: m.bands.map((B) => band({ c: S(B.c), axis: B.axis, w: B.w * h, R: B.R * h, teeth: B.teeth, depth: (B.depth ?? 0) * h, ...(B.arc ? { arc: B.arc } : {}), ...(B.bone ? { bone: B.bone } : {}) })) } : {}),
    ...(m.cells ? { cells: m.cells.map((C) => cells({ seeds: C.seeds.map(S), line: C.line * h, top: C.top * h })) } : {}) }));
  const ell = (E) => ({ C: S(U0(E.C)), rx: r4(E.rx * h), ry: r4(E.ry * h), rz: r4(E.rz * h) });
  const mouth = build.mouth && { nose: S(U0(build.mouth.nose)), centre: S(U0(build.mouth.centre)), corner: S(U0(build.mouth.corner)), pivot: S(U0(build.mouth.pivot)), rise: build.mouth.rise * h, sag: build.mouth.sag * h };
  return { h, eggs, marks, mouth, seam: (build.seam ?? 0) * h, digits: digits.map((d) => ({ i: d.i, base: S(d.base), mid: S(d.mid), tip: S(d.tip) })), ...(build.tail ? { tail: { root: S(build.tail.root), mid: S(build.tail.mid), tip: S(build.tail.tip), hub: S(build.tail.hub) } } : {}), eye: { ...build.eye, r: build.eye.r * h }, J: Object.fromEntries(Object.entries(build.joints).map(([k, p]) => [k, S(p)])), hipZ: r4(build.hipZ * h), neckZ: r4(build.neckZ * h), top: r4((build.top + up) * h), H: ell(build.head), muzzle: ell(build.muzzle) };
}

/** A build's shapes laid out in metres at the style's height, under THE ATTACHMENT RULE: every shape attached to the body
 *  or to something attached to it, a piece apart moved, whole, to the nearest attached shape (feature-attach.js).
 *  → { L (the laid-out build, its `eggs` the attached shapes), moved (what was moved, where, how far: none, nothing) } */
export function featureShapes(build) {
  const L0 = laidOut(build, FEATURE_HEIGHT), att = attachAll(L0.eggs, { seam: L0.seam });
  return { L: att.moved.length ? { ...L0, eggs: att.shapes } : L0, moved: att.moved };
}

/** clips with every arm direction (`armL`, `armR`: { x, y, z }) turned out until its outward share is at least `out` */
function splayed(clips, out) {
  if (!out) return clips;
  const fix = (a, sx) => { if (!a || typeof a !== 'object' || !['x', 'y', 'z'].every((k) => Number.isFinite(a[k]))) return a;
    const l = Math.hypot(a.x, a.y, a.z) || 1, x = (a.x * sx) / l; if (x >= out) return a;
    const rest = Math.hypot(a.y, a.z) / l || 1, k = Math.sqrt(1 - out * out) / rest; return { x: r4(sx * out), y: r4((a.y / l) * k), z: r4((a.z / l) * k) }; };
  const key = (K) => (K && typeof K === 'object' ? { ...K, ...(K.armL ? { armL: fix(K.armL, -1) } : {}), ...(K.armR ? { armR: fix(K.armR, 1) } : {}) } : K);
  return Object.fromEntries(Object.entries(clips).map(([n, c]) => [n, Array.isArray(c) ? c.map(key) : c && Array.isArray(c.keys) ? { ...c, keys: c.keys.map(key) } : c]));
}

/** the standing poses with their legs straight (in place): `STANDING` clips' every crouch, any clip's resting one */
const STANDING = new Set(['idle', 'blink', 'wave', ...EXPRESSION_IDS]), REST_CROUCH = 0.04;
function straightened(clips) {
  for (const [n, c] of Object.entries(clips)) {
    const keys = Array.isArray(c) ? c : c && Array.isArray(c.keys) ? c.keys : [];
    keys.forEach((k, i) => {
      if (!k || typeof k !== 'object') return;
      // (a standing pose's feet under its hips: a wide stance (a sturdy idle's) splays straight legs out)
      if (STANDING.has(n) && k.stance !== undefined) keys[i] = k = { ...k, stance: 1 };
      if (k.crouch !== undefined && (STANDING.has(n) || k.crouch === REST_CROUCH)) keys[i] = { ...k, crouch: 0 };
    });
  }
}

/** clips with every wing held folded: each arm's direction mostly the fold's (`fold`, the right's), the clip's own a
 *  share (`play`), its elbow straight, so a wing stirs with the acting and never swings out as an arm */
function folded(clips, fold, play = 0.2) {
  const fix = (a, sx) => { if (!a || typeof a !== 'object' || !['x', 'y', 'z'].every((k) => Number.isFinite(a[k]))) return a;
    const l = Math.hypot(a.x, a.y, a.z) || 1, d = [sx * fold[0] * (1 - play) + (a.x / l) * play, fold[1] * (1 - play) + (a.y / l) * play, fold[2] * (1 - play) + (a.z / l) * play];
    const m = Math.hypot(...d) || 1; return { x: r4(d[0] / m), y: r4(d[1] / m), z: r4(d[2] / m) }; };
  // (the elbow held straight: a bent one swings the forearm, and the feathers on it, forward like a hand)
  const key = (K) => (K && typeof K === 'object' ? { ...K, ...(K.armL ? { armL: fix(K.armL, -1), elbowL: 0 } : {}), ...(K.armR ? { armR: fix(K.armR, 1), elbowR: 0 } : {}) } : K);
  return Object.fromEntries(Object.entries(clips).map(([n, c]) => [n, Array.isArray(c) ? c.map(key) : c && Array.isArray(c.keys) ? { ...c, keys: c.keys.map(key) } : c]));
}

/** the coat's layers over a skin, kept by key */
const COATS = new Map();
function coatOf(skin, F, eggs, layers) {
  const key = JSON.stringify([skin.V.length, skin.F.length, eggs, layers]);
  if (!COATS.has(key)) { if (COATS.size >= 8) COATS.delete(COATS.keys().next().value); COATS.set(key, coatLayers({ V: skin.V, F: skin.F, field: F.field, shapes: eggs, weights: F.weights }, layers)); }
  return COATS.get(key);
}

/** the palette's feature groups: a bird's plumage (its crown, its neck band, its tail's tip, its wing bars, its legs) and
 *  its own belly's colour, over the coat's palette */
function featurePalette(pal, id, build) {
  // (a coat's patches in their own colour, the roster's: a giraffe's brown, never the near-black of a mask)
  const spot = build.marks?.some((m) => m.group === 'Spot') ? { Spot: speciesParams(id)?.colors?.ashAlt ?? pal.Patch } : {};
  // (a rodent's buck teeth in the roster's own tooth colour: a beaver's orange, a groundhog's cream)
  if (build.eggs.some((e) => e.group === 'Teeth')) spot.Teeth = speciesParams(id)?.colors?.teeth ?? '#f2ead8';
  // (a face worn from another species (feature-grammar.js SPECIES_KIT `face`): its nose and its pale muzzle, the roster's)
  const F = build.face ? speciesParams(build.face)?.colors : null;
  if (F?.nose) spot.Nose = F.nose;
  if (F?.ash) spot.Belly = F.ash;
  if (build.plan !== 'bird') return { ...pal, Sock: pal.Beak, Wing: pal.Body, Flight: pal.Body, ...spot };
  const P = plumageOf(id), C = speciesParams(id)?.colors ?? {}, own = build.belly !== 'none' && build.belly !== 'tuxedo' && C.belly;
  return { ...pal, ...wingTones(pal.Body, P), Sock: P.sock ?? pal.Beak, ...(P.crown ? { Crown: P.crown } : {}), ...(P.neck ? { Mane: P.neck } : {}), ...(P.bar ? { Bar: P.bar } : {}), ...(P.tip ? { Tip: P.tip } : {}), ...(own ? { Belly: C.belly } : {}) };
}

/** the share of the skin's faces kept under a coat cut into it (the cuts' splits fill the rest of the budget) */
export const FEATURE_CUT_SHARE = 0.85;

/** the head's lift over the neck (head units) past which the head turns at the top of the neck, not over its pinch */
export const FEATURE_NECK_PIVOT = 0.5;

/** the feature style's height: the mascot's scale (a sprout's), its head a third of it */
export const FEATURE_HEIGHT = 0.96;

export function featurePlan(sheet, { title = 'a feature animal', reactions = false, decor = {} } = {}) {
  const f = sheet.facets, A = sheet.animal ?? null, K = A?.kit ?? {}, { k } = measuresOf(sheet);
  if (!A) throw new Error('mascot: the feature style draws an animal (a species in the brief or `facets.animal`)');
  // (the operator's tune, feature-tune.js: absent, the build and the skin as designed)
  const tune = sheet.tune ? resolveTune(sheet.tune) : null;
  const build = featureBuild(A, { decor, ...(tune ? { tune } : {}) });
  // (a coat cut into the skin (stripes, a network of patches) adds the faces its edges split: the skin is simplified that
  // much further first, so the figure stays within its triangle budget)
  const cutCoat = build.marks.some((m) => m.cut), faces0 = tune ? tune.detail.faces : FEATURE_SKIN.faces;
  const net = tune || cutCoat ? { ...(tune ? { cell: tune.detail.cell } : {}), faces: cutCoat ? Math.round(faces0 * FEATURE_CUT_SHARE) : faces0 } : {};
  const { L, moved } = featureShapes(build), H = L.H, att = { moved };
  // (a zone is cut into the skin; a mark of strokes or bands is a layer over it, unless it is itself cut (a coat's stripes))
  const zones = L.marks.filter((m) => m.cut || (!m.strokes && !m.bands)), layers = L.marks.filter((m) => !m.cut && (m.strokes || m.bands));
  // (a striped coat's skin FIRM: FEATURE_SKIN.firm; the coat's layers weighted as the skin under them)
  const firm = L.marks.some((m) => m.rigid) ? FEATURE_SKIN.firm : 1;
  const skin = eggSkin(L.eggs, { zones, seam: L.seam, ...net, ...(firm !== 1 ? { firm } : {}) }), F = eggField(L.eggs, { seam: L.seam, ...(firm !== 1 ? { firm } : {}) });
  const coat = coatOf(skin, F, L.eggs, layers);
  // the face: globes seated on the skin, lids as shells about them, the brows on the eye, the mouth in the muzzle
  // (the lids in the head's own colour: a bird whose head is a crown of its own (an eagle's white, a mallard's green)
  // would otherwise wear the body's on its lids, dark bags under its eyes)
  const crowned = build.plan === 'bird' && build.marks.some((m) => m.name === 'crown');
  const face = featureFace({ field: F.field, H, eye: L.eye, rest: f.expression, mouth: L.mouth,
    groups: { lid: ['mask', 'patches'].includes(K.pattern) ? 'Patch' : crowned ? 'Crown' : 'Body', lip: 'Belly', brow: 'Belly' } });
  const segments = [
    { name: 'skin', kind: 'mesh', group: 'Body', mesh: skin.mesh, bind: { bone: 'pelvis', blend: L.tail ? rumped(skin, L.tail) : skin.blend } },
    ...coat,
    ...face.segments,
  ];
  const faceNames = face.segments.flatMap((s) => (s.mirror === 'name' ? [s.name, twin(s.name)] : [s.name]));
  // (a head raised well clear of its body on a neck (a giraffe's, a horse's) turns at the top of that neck, so the neck's
  // bone spans it: FEATURE_NECK_PIVOT head units of lift and more)
  const longNeck = (build.headLift ?? 0) > FEATURE_NECK_PIVOT, headBaseZ = longNeck ? r4(H.C[2] - H.rz * 0.9) : undefined;
  const { rig, clips: clips0 } = rigOf(f, { J: L.J, H, hipZ: L.hipZ, neckZ: L.neckZ, top: L.top, orb: false, k, face, reactions, headParts: faceNames, upper: [], ...(longNeck ? { headBaseZ } : {}) });
  // (the mascot's clips hang the arms close to the body; round this belly they would sink into it: each arm is splayed
  // out to clear it, its direction's outward share at least the build's)
  // (a bird's wings are held folded instead)
  const clips = build.fold ? folded(clips0, build.fold) : splayed(clips0, build.splay ?? 0);
  // (STANDING, the legs straight: the standing poses (the idle, the blink, the wave, the faces) bend no knee, and a motion
  // clip starts and ends on a straight stand; its own crouches (a hop's, a squat's) kept)
  straightened(clips);
  // (a quadruped's clips on all fours, its legs in their natural bend: feature-function.js)
  Object.assign(clips, foursClips(build.fours, { walk: clips.walk, ready: clips.idle?.[0], dog: build.dog, run: clips.run }));
  // the fingers' bones: two links a finger from its knuckle (each tail riding its bone's parent, as the knuckles do)
  for (const d of L.digits) for (const [S0, m] of [['R', (p) => p], ['L', mirrorX]]) {
    const n = (x) => `digit${d.i}${x}${S0}`;
    rig.joints[n('Base')] = { at: m(d.base).map(r4), rides: `hand${S0}` }; rig.joints[n('Mid')] = { at: m(d.mid).map(r4), rides: `hand${S0}` }; rig.joints[n('Tip')] = { at: m(d.tip).map(r4), rides: n('a') };
    rig.bones.push({ id: n('a'), head: n('Base'), tail: n('Mid') }, { id: n('b'), head: n('Mid'), tail: n('Tip') });
  }
  // (the tail's own bone, turned from its root on all fours: carried)
  // (two bones: the tail's from its root to its middle, the tail's end from there to its tip, each turned by its chain)
  if (L.tail) {
    for (const [n, p] of [['rumpHub', L.tail.hub], ['tailRoot', L.tail.root], ['tailMid', L.tail.mid], ['tailTip', L.tail.tip]]) rig.joints[n] = { at: p.map(r4), rides: 'pelvis' };
    rig.bones.push({ id: 'rump', head: 'rumpHub', tail: 'tailRoot' }, { id: 'tail', head: 'tailRoot', tail: 'tailMid' }, { id: 'tailEnd', head: 'tailMid', tail: 'tailTip' });
    // (`rump` first: the whole tail turned about the pelvis ball's middle, its base kept to the rump however far the hips
    // tip; then the tail from its root and its end from its middle)
    rig.chains = { ...(rig.chains ?? {}), rump: { axis: 'x', sign: 1, links: [{ pivot: 'rumpHub', joints: ['tailRoot', 'tailMid', 'tailTip'] }] },
      tail: { axis: 'x', sign: 1, links: [{ pivot: 'tailRoot', joints: ['tailMid', 'tailTip'] }] },
      tailEnd: { axis: 'x', sign: 1, links: [{ pivot: 'tailMid', joints: ['tailTip'] }] } };
  }
  const joints = { ...L.J };
  for (const s of segments) { for (const [n, p] of Object.entries(s.joints || {})) joints[n] = p; delete s.joints; }
  const plan = {
    schema: PLAN_SCHEMA, frame: { up: '+z', front: '+y', note: `metres; ${title}, soles on z = 0` },
    symmetry: { plane: 'x=0', policy: 'the skin given whole; the face\'s side parts authored on the right, mirrored by name' },
    style: { slots: 'ring20', limbSlots: 'ring12', e: 2 },
    joints, segments, dials: {}, rig, clips, paint: [],
    mascot: { energy: f.energy, form: f.form, height: L.top, headR: r4(Math.max(H.rx, H.ry)), style: 'feature', ...(build.tune ? { tune: build.tune } : {}), ...(att.moved.length ? { attached: att.moved } : {}) },
    palette: tune?.tuft ? (() => { const pal = featurePalette(coatPalette(sheet, k, A, f), A.id, build); return { EarInner: '#c9a19b', ...pal, Tuft: tuftColour(tune.tuft, pal) }; })()
      : { EarInner: '#c9a19b', ...featurePalette(coatPalette(sheet, k, A, f), A.id, build) },
  };
  // (the forepaws planted on the floor, solved on the rig itself)
  if (build.fours) { landed(plan); looking(plan); planted(plan); if (L.tail) carried(plan, build.tail.carriage); trotted(plan); }
  // (an animal that goes on all fours RUNS on them: its `run` is the gallop; upright it only walks, slowly)
  if (plan.clips.gallop) plan.clips.run = plan.clips.gallop;
  return { plan, H, height: L.top, ...(tune?.detail.bake ? { bake: detailBake(build.plan) } : {}) };
}

/** THE GALLOP'S MOST FORWARD LEAN placed (its keys on the forepaws alone: the vault and the landing,
 *  FEATURE_GALLOP.vault, .land): the landing lowered as far as its bent forelegs need to reach the floor, and in both the
 *  hind legs stretched out behind, each foot's toe base set `land.reach` of the leg's length from its hip, `land.drop`
 *  degrees under level (never nearer the floor than the vault's clearance), so a short leg shows past a round rump;
 *  solved on the rig */
function landed(plan) {
  const keys = plan.clips.gallop;
  if (!Array.isArray(keys)) return;
  const R = validateRig(expandPlan(plan).rig), h = plan.mascot.height, P = FEATURE_PAWS, Ld = FEATURE_GALLOP.land, J = R.joints;
  const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), a = (Ld.drop * Math.PI) / 180;
  const legOf = (S) => len(J[`hip${S}`], J[`knee${S}`]) + len(J[`knee${S}`], J[`ankle${S}`]) + len(J[`ankle${S}`], J[`toeBase${S}`]);
  keys.forEach((k, i) => {
    if (k?.support !== 'none') return;
    // (the landing lowered until its bent foreleg, nearly upright, reaches the floor)
    let k1 = k;
    if (typeof k.elbowR === 'number') {
      const n0 = rigNodesAt(R, k).nodes, reach = len(n0.shoulderR, n0.knucklesR), sink = Math.max(0, n0.shoulderR[2] - P.floor * h - 0.97 * reach);
      if (sink) k1 = { ...k, sink: r4(sink) };
    }
    // (the hind feet stretched out behind: their toe bases' targets)
    const n1 = rigNodesAt(R, k1).nodes;
    const foot = (S) => { const hp = n1[`hip${S}`], d = Ld.reach * legOf(S); return [r4(hp[0]), r4(hp[1] - d * Math.cos(a)), r4(Math.max(FEATURE_GALLOP.vault.clear * h, hp[2] - d * Math.sin(a)))]; };
    keys[i] = { ...k1, feet: { R: foot('R'), L: foot('L') } };
  });
}

/** THE HEAD LOOKING AHEAD on all fours: each key of the pose, the walk and the gallop turns the head up from a trunk
 *  pitched forward until its crown tips `tilt` degrees ahead of upright (the face ahead, a little down, as a running
 *  animal holds it), the head taking `share` of the turn and the neck the rest (a neck pulled far back tucks the head
 *  into the shoulders), each within its range (figure-vajra.js LIMITS, × the key's `unbound`), solved on the rig. The
 *  downward dog keeps its own (the head lifted from a chest pitched further down) */
export const FEATURE_LOOK = Object.freeze({ tilt: 15, share: 0.65, clips: ['fours', 'prowl', 'gallop'] });
function looking(plan) {
  const R = validateRig(expandPlan(plan).rig);
  for (const name of FEATURE_LOOK.clips) {
    const keys = plan.clips[name];
    if (!Array.isArray(keys)) continue;
    keys.forEach((k, i) => { if (k?.armR) keys[i] = lookAhead(R, k); });
  }
}
/** a key on all fours with its head turned up from the trunk until the crown tips FEATURE_LOOK.tilt ahead of upright */
function lookAhead(R, k) {
  const Lk = FEATURE_LOOK, U = k.unbound ?? 1, hm = LIMITS.head * U, nm = LIMITS.neck * U;
  const tipOf = (q) => { const n = rigNodesAt(R, q).nodes, c = [0, 1, 2].map((i) => n.headTop[i] - n.headBase[i]); return (Math.atan2(c[1], c[2]) * 180) / Math.PI; };
  const with_ = (T) => { const head = Math.min(hm, T * Lk.share), neck = Math.min(nm, T - head); return { ...k, head: { pitch: r4(head) }, neck: { pitch: r4(neck) } }; };
  // (the crown's tip falls as the turn grows: bisect the turn for the tilt)
  let lo = 0, hi = hm + nm;
  if (tipOf(with_(lo)) <= Lk.tilt) return with_(0);
  for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; (tipOf(with_(m)) > Lk.tilt ? (lo = m) : (hi = m)); }
  return with_(hi);
}

/** THE TAIL CARRIED as its animal carries it, on all fours: the pelvis tips forward and swings a tail designed for the
 *  standing animal up toward the sky, so each key on all fours (the walk on them, the downward dog) turns the tail's bone
 *  from its root until its line from root to tip rises at the species' carriage (fauna roster: feature-function.js
 *  speciesTail; absent, `FEATURE_CARRIAGE.none`), a share (`keep`) of the way back toward where the mascot's own tail
 *  would point: a compromise between the regular animal and the mascot. Galloping, every tail is held back for balance,
 *  near level (`run`, whatever the walking carriage: a cat's up at a walk, back at a run), never dragged (lifted until
 *  its middle and its tip clear the floor by `clear` of the height, room for a brush's thickness), its base kept LOW ON THE RUMP
 *  (FEATURE_TAIL_RUMP under its rearmost point: the whole tail turned about the pelvis ball's middle by the `rump` chain,
 *  however far the hips tip), RAISED in the leap (`leap`
 *  degrees, the gallop's keys on the forepaws alone: the hind legs stretched out under it show) and STRAIGHTENED (the tail's
 *  far half turned from its middle in line with the near half: a curled tip laid out behind). Standing, as designed */
/** THE RUMP'S PATCH: the skin of the pelvis ball about a tail's root rides the `rump` bone (from the ball's middle to the
 *  root, turned with the tail by the `rump` chain), wholly within `inner` degrees of the root about the ball's middle and
 *  less to none by `outer`: a ball turned about its middle maps onto itself, so the tail's junction slides round the
 *  rump with it, never stretched across it as a web */
export const FEATURE_RUMP = Object.freeze({ inner: 20, outer: 70 });
function rumped(skin, T) {
  const ax = [T.root[0] - T.hub[0], T.root[1] - T.hub[1], T.root[2] - T.hub[2]], al = Math.hypot(...ax) || 1;
  const c0 = Math.cos((FEATURE_RUMP.inner * Math.PI) / 180), c1 = Math.cos((FEATURE_RUMP.outer * Math.PI) / 180), out = {};
  skin.V.forEach((p, v) => {
    const key = `st0.v${v}`, w = skin.blend[key], pel = w.pelvis ?? 0;
    if (!pel) { out[key] = w; return; }
    const d = [p[0] - T.hub[0], p[1] - T.hub[1], p[2] - T.hub[2]], c = (d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2]) / ((Math.hypot(...d) || 1) * al);
    const t = Math.max(0, Math.min(1, (c - c1) / (c0 - c1))), f = t * t * (3 - 2 * t);
    if (f <= 0) { out[key] = w; return; }
    const n = { ...w, pelvis: pel * (1 - f), rump: (w.rump ?? 0) + pel * f };
    if (n.pelvis < FEATURE_SKIN.floor) { n.rump += n.pelvis; delete n.pelvis; }
    // (at most the bones a point may name: the least folded into the most)
    const e = Object.entries(n).sort((a, b) => b[1] - a[1]), kept = e.slice(0, FEATURE_SKIN.bones), lost = e.slice(FEATURE_SKIN.bones).reduce((a, [, x]) => a + x, 0);
    kept[0][1] += lost; const W = kept.map(([b, x]) => [b, r4(x)]); W[0][1] = r4(W[0][1] + 1 - W.reduce((a, [, x]) => a + x, 0));
    out[key] = Object.fromEntries(W);
  });
  return out;
}

/** where a tail leaves the rump on all fours: degrees under its rearmost point, about the pelvis ball's middle */
export const FEATURE_TAIL_RUMP = -25;
export const FEATURE_CARRIAGE = Object.freeze({ none: -15, keep: 0.25, most: 60, run: Object.freeze({ least: -25, most: 10 }), leap: 30, clear: 0.12 });
function carried(plan, carriage) {
  const h = plan.mascot.height, R = validateRig(expandPlan(plan).rig), C = FEATURE_CARRIAGE, real = Math.max(-C.most, Math.min(C.most, carriage ?? C.none));
  const riseOf = (a, b) => (Math.atan2(b[2] - a[2], -(b[1] - a[1])) * 180) / Math.PI;
  const rise = (k) => { const n = rigNodesAt(R, k).nodes; return riseOf(n.tailRoot, n.tailTip); };
  // (the far half's turn that lines it up with the near half: a straight tail; the root's chain carries both halves, so
  // the bend between them is the far chain's alone)
  const bendOf = (k) => { const n = rigNodesAt(R, k).nodes; return riseOf(n.tailMid, n.tailTip) - riseOf(n.tailRoot, n.tailMid); };
  const straight = (k) => { const b0 = bendOf({ ...k, tail: 0, tailEnd: 0 }), per = (bendOf({ ...k, tail: 0, tailEnd: 10 }) - b0) / 10; return Math.abs(per) > 1e-6 ? r4(-b0 / per) : 0; };
  // (THE RUMP: on all fours, walking, galloping and in the dog the tail's root sits FEATURE_TAIL_RUMP degrees under the
  // rump's rearmost point (about the pelvis ball's middle), however far the hips tip: the tail leaves the rump's lower
  // half, a figure eight with the body, never a keel run on from the back)
  const about = (n) => (Math.atan2(n.tailRoot[2] - n.rumpHub[2], -(n.tailRoot[1] - n.rumpHub[1])) * 180) / Math.PI;
  const rumpAt = FEATURE_TAIL_RUMP;
  for (const name of Object.keys(FEATURE_PAWS.out)) {
    const keys = plan.clips[name];
    if (!Array.isArray(keys)) continue;
    keys.forEach((k0, i) => {
      if (!k0?.armR) return;
      let k = k0;
      {
        const a0 = about(rigNodesAt(R, { ...k, rump: 0 }).nodes), per = (about(rigNodesAt(R, { ...k, rump: 10 }).nodes) - a0) / 10;
        if (Math.abs(per) > 1e-6 && Math.abs(a0 - rumpAt) > 0.5) k = { ...k, rump: r4((rumpAt - a0) / per) };
      }
      const run = name === 'gallop', end = run ? straight(k) : 0, k1 = end ? { ...k, tailEnd: end } : k;
      const e0 = rise({ ...k1, tail: 0 }), per = (rise({ ...k1, tail: 10 }) - e0) / 10;
      const want = run && k.support === 'none' ? C.leap : run ? Math.max(C.run.least, Math.min(C.run.most, real)) : real + C.keep * (e0 - real);
      if (Math.abs(per) > 1e-6) {
        // (never dragged: a tail carried low is lifted, a few degrees at a time, until its tip clears the floor)
        let turn = (want - e0) / per;
        const tipZ = (t) => { const n = rigNodesAt(R, { ...k1, tail: t }).nodes; return Math.min(n.tailTip[2], n.tailMid[2]); };
        for (let it = 0; it < 12 && tipZ(turn) < C.clear * h; it++) turn += 5 / per;
        keys[i] = { ...k1, tail: r4(turn) };
      }
    });
  }
}

/** THE TROT ON ALL FOURS (feature-trot.js), posed on the rig from the settled all-fours pose (its waist, look, carried
 *  tail): the trunk tipped forward until a standing foreleg rakes ahead (the legs apart from the side) and holding that
 *  lean; the hind feet's targets and each forepaw solved to its point on the ONE ground every planted foot slides back
 *  on (the elbow by the law of cosines on the upper arm and the forearm, the aim corrected until the posed paw is
 *  there); the body vaulting over the standing foreleg and bouncing, the trunk twisted between its girdles, the neck
 *  nodding and the tail swishing after the bounce. Keyed at the packer's samples (FEATURE_TROT.keys). Its measures ride
 *  `mascot.trot` (the cycle's seconds and the ground speed a game plays it at). An animal whose legs reach no stance does
 *  not trot. */
function trotted(plan, T = FEATURE_TROT) {
  const base = plan.clips.fours?.[1];
  if (!base?.armR) return;
  const R = validateRig(expandPlan(plan).rig), J = R.joints, h = plan.mascot.height;
  const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), hip0 = rigNodesAt(R, base).nodes;
  // (the trot crouches a little, `crouch` of the hip's height: what the stance is measured at, the body's highest)
  const hip = hip0.hipR[2] - hip0.toeBaseR[2], crouch = T.crouch * hip, up = len(J.shoulderR, J.elbowR), fore = len(J.elbowR, J.knucklesR);
  // (THE CARRIAGE: the trunk tipped forward over the hips until a standing foreleg, a COLUMN `column` of its arm, rakes
  // `rake` degrees ahead of its shoulder to the floor: the chest out over the forepaws, the forelegs clear of the hind
  // legs from the side; the head turned again to look ahead)
  const floorF = hip0.knucklesR[2], Dc = T.column * (up + fore), rk = (T.rake * Math.PI) / 180;
  const heightAt = (hg) => rigNodesAt(R, { ...base, hinge: hg, sink: r4(crouch) }).nodes.shoulderR[2] - floorF;
  let lo0 = base.hinge - 30, hi0 = base.hinge + 15;
  for (let it = 0; it < 24; it++) { const m = (lo0 + hi0) / 2; (heightAt(m) > Dc * Math.cos(rk) ? (lo0 = m) : (hi0 = m)); }
  const carriage = lookAhead(R, { ...base, hinge: r4((lo0 + hi0) / 2) }), n0 = rigNodesAt(R, { ...carriage, sink: r4(crouch) }).nodes;
  // (each stance where its leg reaches it (the horse study's footfall): the hind's ankle `back` of the hip's height
  // behind it (the hind legs driving from behind, apart from the forelegs), how far fore and aft its ankle stays within
  // `reach` of the femur and tibia; the forepaw where the column rakes to, as far fore and aft as the shoulder vaulting
  // over it falls no more than `vault` of the arm; across, where the all-fours pose stands them)
  const thigh = len(J.hipR, J.kneeR) + len(J.kneeR, J.ankleR), meta = sub(n0.ankleR, n0.toeBaseR), floorH = hip0.toeBaseR[2];
  const dx = hip0.knucklesR[0] - n0.shoulderR[0], arc = Math.sqrt(Math.max(1e-9, Dc * Dc - dx * dx));
  const ahead = arc * Math.sin(rk), standF = (d) => Math.sqrt(Math.max(0, arc * arc - d * d));
  const at = { H: (side) => [hip0[`toeBase${side}`][0], n0[`hip${side}`][1] - meta[1] - T.back * hip, floorH], F: (side) => [hip0[`knuckles${side}`][0], n0[`shoulder${side}`][1] + ahead, floorF] };
  const spanOf = (from, to, L) => { const d = sub(to, from), A = Math.sqrt(Math.max(0, (T.reach * L) ** 2 - d[0] ** 2 - d[2] ** 2)); return Math.max(0, A - Math.abs(d[1])); };
  const spanH = spanOf(n0.hipR, add(at.H('R'), meta), thigh), spanF = Math.max(0, standF(standF(ahead) - T.vault * (up + fore)) - ahead);
  const M = trotMeasures({ hip, spanH, spanF }, T);
  if (M.stance < 0.02 * h) return;
  const s = M.scale * T.show, lift = { fore: Math.min(T.lift.fore * s, 0.35 * hip), hind: Math.min(T.lift.hind * s, 0.25 * hip) };
  const S = trotSignals(M, lift, T), K = T.keys, heaves = Array.from({ length: K }, (_, i) => S.heave(i / K)), top = Math.max(...heaves);
  const ID = { R: { hind: 'RH', fore: 'RF' }, L: { hind: 'LH', fore: 'LF' } };
  // (each key's body at a height `drop` under the carriage (+ down), its legs on their marks)
  const keyAt = (i, drop) => {
    const t = i / K, tw = S.twist(t), k = { ...carriage, ...(drop >= 0 ? { sink: r4(drop) } : { lift: r4(-drop) }), spine: { ...(base.spine ?? {}), twist: [tw >= 0 ? 'left' : 'right', r4(T.twist * Math.abs(tw))] },
      neck: { ...(carriage.neck ?? {}), pitch: r4((carriage.neck?.pitch ?? 0) - S.nod(t)) }, ...(typeof base.tail === 'number' ? { tail: r4(base.tail + S.swish(t)) } : {}), feet: {} };
    for (const side of ['R', 'L']) { const [dy, dz] = S.feet(ID[side].hind, t), p = at.H(side); k.feet[side] = [r4(p[0]), r4(p[1] + dy), r4(p[2] + dz)]; }
    return k;
  };
  const pawAt = (i, side) => { const [dy, dz] = S.feet(ID[side].fore, i / K), p0 = at.F(side); return [p0[0], p0[1] + dy, p0[2] + dz]; };
  // (each forepaw to its point on the ground: the elbow first, then the aim corrected until the posed paw is there)
  const pawed = (k0, i) => {
    let k = k0;
    for (const side of ['R', 'L']) {
      const want = pawAt(i, side), arm = `arm${side}`;
      for (let pass = 0; pass < 8; pass++) {
        const n = rigNodesAt(R, k).nodes, sh = n[`shoulder${side}`], D = Math.min(up + fore, len(sh, want));
        const bend = (Math.acos(Math.max(-1, Math.min(1, (D * D - up * up - fore * fore) / (2 * up * fore)))) * 180) / Math.PI;
        const got = unit(sub(n[`knuckles${side}`], sh)), aim = unit(sub(want, sh)), a = unit(add([k[arm].x, k[arm].y, k[arm].z], sub(aim, got)));
        k = { ...k, [`elbow${side}`]: r4(bend), [arm]: { x: r4(a[0]), y: r4(a[1]), z: r4(a[2]) } };
      }
    }
    return k;
  };
  // (THE VAULT, solved on the rig: the trunk holds its lean, never rocking, and the body as a whole rides over the
  // standing foreleg (both girdles stand together in a trot): the height at which that foreleg is its column, its arm
  // posed; with no forepaw down, eased across; the whole smoothed to the stride's low harmonics, the bounce added, and
  // the elbow giving what is left)
  const stands = (i) => ['R', 'L'].find((S1) => S.force(ID[S1].fore, i / K) > 0);
  const vault = Array.from({ length: K }, (_, i) => {
    const side = stands(i);
    if (!side) return null;
    const miss = (d) => len(rigNodesAt(R, pawed(keyAt(i, d), i)).nodes[`shoulder${side}`], pawAt(i, side)) - Dc;
    let lo = -0.3 * hip, hi = 0.5 * hip;   // (lower the body, shorter the arm)
    for (let it = 0; it < 18; it++) { const m = (lo + hi) / 2; (miss(m) > 0 ? (lo = m) : (hi = m)); }
    return (lo + hi) / 2;
  });
  const smooth = trotVault((t) => vault[Math.round(t * K) % K] ?? null, T.harmonics);
  const keys = Array.from({ length: K }, (_, i) => pawed(keyAt(i, smooth(i / K) + (top - heaves[i])), i));
  plan.clips.trot = keys;
  plan.mascot.trot = { seconds: M.seconds, speed: M.speed, stride: M.stride, duty: M.duty, ...(M.cut ? { cut: M.cut } : {}) };
}

/** THE FOREPAWS PLANTED: a clip's arm aim is read partly in the bent trunk's frame (figure-vajra.js swivels the arm from
 *  where the trunk carried it), so an aim written as a world direction lands the paw behind and above the floor, and
 *  splayed, once the trunk bends. Each key on all fours is solved on the rig: from where the posed shoulder stands the
 *  paw reaches the floor ahead, as far as the arm reaches (`FEATURE_PAWS.floor` of the height off it), the arm straight
 *  FORWARD in the downward dog (no share to the side) and a little out round the belly on all fours, a walk's and a
 *  gallop's swing kept; the aim corrected until the posed arm points there (`passes`) */
export const FEATURE_PAWS = Object.freeze({ floor: 0.02, out: { fours: 0.15, prowl: 0.15, downDog: 0, gallop: 0.05 }, passes: 6 });
function planted(plan) {
  const R = validateRig(expandPlan(plan).rig), h = plan.mascot.height, P = FEATURE_PAWS, fourY = plan.clips.fours?.[1]?.armR?.y ?? 0;
  const u = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const dir = (a, b) => u([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  for (const [name, out] of Object.entries(P.out)) {
    const keys = plan.clips[name];
    if (!Array.isArray(keys)) continue;
    // (a moving clip's own swing kept: the prowl's about the fours', the gallop's ahead of its planted paw)
    const base = name === 'gallop' ? Math.min(...keys.map((k) => k?.armR?.y ?? 0)) : fourY, moving = name === 'prowl' || name === 'gallop';
    // (the gallop's reach share per key, and whether the paw is swinging forward (in the air) or back (on the floor))
    const reachOf = (k) => Math.max(0, Math.min(1, ((k?.armR?.y ?? 0) - base) / FEATURE_GALLOP.swing)), ts = keys.map(reachOf);
    keys.forEach((k0, i) => {
      if (!k0?.armR || !k0?.armL) return;
      let k = k0;
      for (const [S, sx] of [['R', 1], ['L', -1]]) {
        const arm = `arm${S}`, swing = moving ? (k0.armR.y ?? 0) - base : 0;
        // (the gallop's paw on the floor at a share of its full reach, `under` at the gather to all of it at the
        // extension, the elbow folded so the leg spans it: the law of cosines on the upper arm and the forearm)
        let span = null;
        const gait = FEATURE_GAIT[name], hindAt = (j) => keys[j]?.feet?.[S];
        if (gait && keys.every((_, j) => Array.isArray(hindAt(j)))) {
          // (A GAIT: the foreleg plays its own side's hind foot's cycle `shift` later: where that foot is fore and aft its
          // paw is (from `under` of its reach to all of it), and as that foot is lifted so is the paw)
          const n = keys.length, j = (((i - Math.round(gait.shift * n)) % n) + n) % n, ys = keys.map((_, q) => hindAt(q)[1]), zs = keys.map((_, q) => hindAt(q)[2]);
          const u = (hindAt(j)[1] - Math.min(...ys)) / (Math.max(...ys) - Math.min(...ys) || 1), up0 = (hindAt(j)[2] - Math.min(...zs)) / (Math.max(...zs) - Math.min(...zs) || 1);
          const n0 = rigNodesAt(R, { ...k, [`elbow${S}`]: 0 }).nodes, sh = n0[`shoulder${S}`], up = len(sh, n0[`elbow${S}`]), fore = len(n0[`elbow${S}`], n0[`knuckles${S}`]);
          const dz0 = Math.max(0, sh[2] - P.floor * h), full = Math.sqrt(Math.max(0, (up + fore) ** 2 - dz0 * dz0)), dz = dz0 - gait.lift * (up + fore) * up0;
          const fwdA = full * (gait.under + (1 - gait.under) * u), D = Math.min(up + fore, Math.hypot(dz, fwdA) * Math.hypot(1, out));
          const bend = (Math.acos(Math.max(-1, Math.min(1, (D * D - up * up - fore * fore) / (2 * up * fore)))) * 180) / Math.PI;
          k = { ...k, [`elbow${S}`]: r4(bend) }; span = { dz, fwd: fwdA };
        } else if (name === 'gallop' && typeof k0[`elbow${S}`] === 'number' && k0.support === 'none') {
          // (the landing's elbow is its own: the paw set on the floor ahead as far as the bent foreleg reaches)
          const n0 = rigNodesAt(R, k).nodes, sh = n0[`shoulder${S}`], L0 = len(sh, n0[`knuckles${S}`]), dz = Math.max(0, sh[2] - P.floor * h);
          span = { dz, fwd: Math.sqrt(Math.max(0.0001, L0 * L0 - dz * dz)) };
        } else if (name === 'gallop') {
          const n0 = rigNodesAt(R, { ...k, [`elbow${S}`]: 0 }).nodes, sh = n0[`shoulder${S}`], up = len(sh, n0[`elbow${S}`]), fore = len(n0[`elbow${S}`], n0[`knuckles${S}`]);
          const dz0 = Math.max(0, sh[2] - P.floor * h), full = Math.sqrt(Math.max(0, (up + fore) ** 2 - dz0 * dz0)), t = ts[i];
          // (swinging forward, the paw is lifted most at mid-swing; at full reach it strikes; swept back, it is on the floor)
          const swingingOn = ts[(i + 1) % ts.length] > t + 1e-6, dz = dz0 - (swingingOn ? FEATURE_GALLOP.lift * (up + fore) * Math.sin(Math.PI * t) : 0);
          const fwdA = full * (FEATURE_GALLOP.under + (1 - FEATURE_GALLOP.under) * t), D = Math.min(up + fore, Math.hypot(dz, fwdA) * Math.hypot(1, out));
          const bend = (Math.acos(Math.max(-1, Math.min(1, (D * D - up * up - fore * fore) / (2 * up * fore)))) * 180) / Math.PI;
          k = { ...k, [`elbow${S}`]: r4(bend) }; span = { dz, fwd: fwdA };
        }
        let a = [k[arm].x, k[arm].y, k[arm].z];
        for (let pass = 0; pass < P.passes; pass++) {
          const n = rigNodesAt(R, k).nodes, sh = n[`shoulder${S}`], kn = n[`knuckles${S}`], L = len(sh, kn);
          const d = Math.max(0.05, Math.min(1, (sh[2] - P.floor * h) / L));
          // (the share to the side a share of the span's own length: never mixed with its metres)
          const want = span ? u([sx * out * Math.hypot(span.fwd, span.dz), span.fwd, -span.dz]) : u([sx * out, Math.sqrt(1 - d * d) + swing, -d]), got = dir(sh, kn);
          a = u([a[0] + want[0] - got[0], a[1] + want[1] - got[1], a[2] + want[2] - got[2]]);
          k = { ...k, [arm]: { x: r4(a[0]), y: r4(a[1]), z: r4(a[2]) } };
        }
      }
      keys[i] = k;
    });
  }
}
