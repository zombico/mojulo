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
import { featureBuild } from './feature-grammar.js';
import { animalCard } from './mascot-animals.js';

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

/** the skin: its net's cell and its faces after simplifying; the weights' floor, the bones a point may name, the eggs the
 *  field folds. And the whole figure's TRIANGLE BUDGET: a default game model's (skin, coat, face together) */
export const FEATURE_TRIANGLES = 18000;
export const FEATURE_SKIN = Object.freeze({ cell: 0.0075, faces: 8500, floor: 0.02, bones: 4, near: 3 });

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

export function eggField(eggs, { near = FEATURE_SKIN.near, bones = FEATURE_SKIN.bones, floor = FEATURE_SKIN.floor, seam = 0 } = {}) {
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
export function eggSkin(eggs, { cell = FEATURE_SKIN.cell, faces = FEATURE_SKIN.faces, group = 'Body', zones = [], seam = 0 } = {}) {
  const key = JSON.stringify([eggs, cell, faces, group, zones, seam]);
  if (SKINS.has(key)) return SKINS.get(key);
  const F = eggField(eggs, { seam }), f = F.field, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
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
  const marks = (build.marks ?? []).map((m) => ({ name: m.name, group: m.group, ...(m.levels !== undefined ? { levels: m.levels } : {}),
    ...(m.eggs ? { eggs: m.eggs } : {}),
    ...(m.regions ? { regions: m.regions.map((E) => egg({ c: S(E.c), u: E.u, r: E.r.map((v) => v * h), e: E.e ?? 0, hint: E.hint, bone: null, group: m.group, join: 0 })) } : {}),
    ...(m.strokes ? { strokes: m.strokes.flatMap((x) => { const one = (pts) => stroke({ points: pts.map((p) => SH(p, m.on)), r: x.r.map((v) => r6(v * h)) }); return x.both ? [one(x.points), one(x.points.map(mirrorX))] : [one(x.points)]; }) } : {}),
    ...(m.bands ? { bands: m.bands.map((B) => band({ c: S(B.c), axis: B.axis, w: B.w * h, R: B.R * h, teeth: B.teeth, depth: (B.depth ?? 0) * h })) } : {}) }));
  const ell = (E) => ({ C: S(U0(E.C)), rx: r4(E.rx * h), ry: r4(E.ry * h), rz: r4(E.rz * h) });
  const mouth = build.mouth && { nose: S(U0(build.mouth.nose)), centre: S(U0(build.mouth.centre)), corner: S(U0(build.mouth.corner)), pivot: S(U0(build.mouth.pivot)), rise: build.mouth.rise * h, sag: build.mouth.sag * h };
  return { h, eggs, marks, mouth, seam: (build.seam ?? 0) * h, digits: digits.map((d) => ({ i: d.i, base: S(d.base), mid: S(d.mid), tip: S(d.tip) })), eye: { ...build.eye, r: build.eye.r * h }, J: Object.fromEntries(Object.entries(build.joints).map(([k, p]) => [k, S(p)])), hipZ: r4(build.hipZ * h), neckZ: r4(build.neckZ * h), top: r4((build.top + up) * h), H: ell(build.head), muzzle: ell(build.muzzle) };
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

/** clips with every wing held folded: each arm's direction mostly the fold's (`fold`, the right's), the clip's own a
 *  share (`play`), so a wing stirs with the acting and never swings out as an arm */
function folded(clips, fold, play = 0.2) {
  const fix = (a, sx) => { if (!a || typeof a !== 'object' || !['x', 'y', 'z'].every((k) => Number.isFinite(a[k]))) return a;
    const l = Math.hypot(a.x, a.y, a.z) || 1, d = [sx * fold[0] * (1 - play) + (a.x / l) * play, fold[1] * (1 - play) + (a.y / l) * play, fold[2] * (1 - play) + (a.z / l) * play];
    const m = Math.hypot(...d) || 1; return { x: r4(d[0] / m), y: r4(d[1] / m), z: r4(d[2] / m) }; };
  const key = (K) => (K && typeof K === 'object' ? { ...K, ...(K.armL ? { armL: fix(K.armL, -1) } : {}), ...(K.armR ? { armR: fix(K.armR, 1) } : {}) } : K);
  return Object.fromEntries(Object.entries(clips).map(([n, c]) => [n, Array.isArray(c) ? c.map(key) : c && Array.isArray(c.keys) ? { ...c, keys: c.keys.map(key) } : c]));
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

export function featurePlan(sheet, { title = 'a feature animal', reactions = false, decor = {} } = {}) {
  const f = sheet.facets, A = sheet.animal ?? null, K = A?.kit ?? {}, { k } = measuresOf(sheet);
  if (!A) throw new Error('mascot: the feature style draws an animal (a species in the brief or `facets.animal`)');
  const build = featureBuild(A, { decor });
  const L = laidOut(build, FEATURE_HEIGHT), H = L.H;
  const zones = L.marks.filter((m) => !m.strokes && !m.bands), layers = L.marks.filter((m) => m.strokes || m.bands);
  const skin = eggSkin(L.eggs, { zones, seam: L.seam }), F = eggField(L.eggs, { seam: L.seam });
  const coat = coatOf(skin, F, L.eggs, layers);
  // the face: globes seated on the skin, lids as shells about them, the brows on the eye, the mouth in the muzzle
  const face = featureFace({ field: F.field, H, eye: L.eye, rest: f.expression, mouth: L.mouth,
    groups: { lid: ['mask', 'patches'].includes(K.pattern) ? 'Patch' : 'Body', lip: 'Belly', brow: 'Belly' } });
  const segments = [
    { name: 'skin', kind: 'mesh', group: 'Body', mesh: skin.mesh, bind: { bone: 'pelvis', blend: skin.blend } },
    ...coat,
    ...face.segments,
  ];
  const faceNames = face.segments.flatMap((s) => (s.mirror === 'name' ? [s.name, twin(s.name)] : [s.name]));
  const { rig, clips: clips0 } = rigOf(f, { J: L.J, H, hipZ: L.hipZ, neckZ: L.neckZ, top: L.top, orb: false, k, face, reactions, headParts: faceNames, upper: [] });
  // (the mascot's clips hang the arms close to the body; round this belly they would sink into it: each arm is splayed
  // out to clear it, its direction's outward share at least the build's)
  // (a bird's wings are held folded instead)
  const clips = build.fold ? folded(clips0, build.fold) : splayed(clips0, build.splay ?? 0);
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
