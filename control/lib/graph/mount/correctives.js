/**
 * correctives — the skin at the folds. Linear blend skinning (skin.js) averages the bones' transforms, so where a joint
 * bends far (the armpit, the stifle, the throat) the skin collapses on the inside of the bend and the masses pass
 * through each other. Two answers, one the truth and one what ships:
 *
 * THE ORACLE (implicit skinning, after VAILLANT et al. 2013): the body's masses carried rigidly by their bones into the
 * pose and blended as at the stand (body.js, `posed`) are the skin the pose should have: where a fold brings masses
 * together the blend unions them, where it parts them the blend spans the gap. The LBS skin is drawn onto it: each
 * vertex along the posed field's gradient to the value it had at the stand, then relaxed within its tangent plane
 * (toward its neighbours, its rest offset from them kept) and drawn on again. A vertex already on its surface (most of a rigid part) is left where LBS put it.
 *
 * WHAT SHIPS (pose-space deformation, after LEWIS et al. 2000): an engine skins by LBS, so the oracle is baked into
 * corrective shapes. A DRIVER is one joint's bend (a child bone's direction in its parent's frame, about the parent's
 * side axis); its KEYS are the oracle's correction with that joint ALONE bent (its subtree turned on the stand's
 * frames) to the angles the clips reach, halfway and fully each way. A key is stored in BIND space (the blended
 * transform's inverse applied: a glTF morph target, added before skinning), sparse. In a pose each driver's angle weights
 * its keys piecewise linearly (clamped at the last key), and the weighted keys are added before skinning.
 *
 *   DRIVERS   [{ id, parent, child }]
 *   jointAngle(rest, pose, driver) → radians (0 at the stand)
 *   bendJoint(rest, driver, angle) → the stand's frames with the driver's joint alone bent
 *   implicitSkin(ctx, pose, lbs?) → the oracle's vertices in the pose
 *   correctiveKeys(ctx, { drivers, corpus, fractions }) → { drivers: [{ ...driver, keys: [{ angle, deltas }] }] }
 *   fitCorrectives(ctx, set, poses, { lambda }) → the keys refit over many poses at once (least squares, per vertex)
 *   correctiveWeights(set, rest, pose) → [{ driver, key, w }]
 *   applyCorrectives(ctx, set, pose) → the corrected vertices (LBS with the keys added in bind space)
 *   skinContext(B, mesh) → { B, mesh, F, rest, iso, nbr }
 *   correctiveCorpus(B, { phases }) → [{ label, frames }] (every gait round its cycle, the jump, grazing, resting a hind)
 *   foldMeasures(ctx, pose, x, oracle) → { off: { p95, max } (from the oracle, at the folds), volume, inverted }
 *   correctiveGates(ctx, set, poses) → { checks: [{ name, pass, saw, want }], rows } on poses the fit never saw
 */
import { MOUNT_BONES } from './pose.js';
import { standPose, gaitCycle } from './gait.js';
import { jumpClip } from './jump.js';
import { restState } from './idle.js';
import { boneFrames, skinPose } from './skin.js';
import { bodyField } from './body.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

/** the folds' joints: per side the withers (the blade on the trunk), shoulder, elbow, knee, hip, stifle, hock; the
 * neck's base and the poll */
export const DRIVERS = Object.freeze([
  ...['R', 'L'].flatMap((s) => [
    { id: `withers${s}`, parent: 'spine3', child: `scapula${s}` }, { id: `shoulder${s}`, parent: `scapula${s}`, child: `humerus${s}` },
    { id: `elbow${s}`, parent: `humerus${s}`, child: `radius${s}` }, { id: `carpus${s}`, parent: `radius${s}`, child: `cannonF${s}` },
    { id: `hip${s}`, parent: 'spine0', child: `femur${s}` }, { id: `stifle${s}`, parent: `femur${s}`, child: `tibia${s}` },
    { id: `hock${s}`, parent: `tibia${s}`, child: `cannonH${s}` },
  ]),
  { id: 'neckBase', parent: 'spine3', child: 'neck0' }, { id: 'poll', parent: 'neck4', child: 'head' },
].map(Object.freeze));

const CHILDREN = (() => { const c = {}; for (const b of MOUNT_BONES) if (b.parent) (c[b.parent] ??= []).push(b.id); return c; })();
const subtree = (id) => { const out = [id]; for (let i = 0; i < out.length; i++) out.push(...(CHILDREN[out[i]] ?? [])); return out; };

/** the child's direction in its parent's frame, as an angle in the parent's (dir, up) plane: φ = atan2(l·dir, l·up) */
const phiOf = (frames, d) => {
  const p = frames[d.parent], c = frames[d.child];
  const l = [dot(c.R[0], p.R[0]), dot(c.R[0], p.R[1]), dot(c.R[0], p.R[2])];
  return Math.atan2(l[0], l[2]);
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function jointAngle(rest, pose, d) { return wrap(phiOf(pose, d) - phiOf(rest, d)); }

/** Rodrigues: v turned by θ about the unit axis a (θ > 0 raises φ above: a × v leads) */
const turn = (v, a, c, s) => add(add(mul(v, c), mul(cross(a, v), s)), mul(a, dot(a, v) * (1 - c)));

export function bendJoint(rest, d, angle) {
  const a = rest[d.parent].R[1], pivot = rest[d.child].h, c = Math.cos(angle), s = Math.sin(angle), out = { ...rest };
  for (const id of subtree(d.child)) {
    const r = rest[id];
    if (!r) continue;
    out[id] = { h: add(pivot, turn(sub(r.h, pivot), a, c, s)), R: r.R.map((row) => turn(row, a, c, s)) };
  }
  return out;
}

/** the context a body's skin is solved in: its field, the stand's frames, each vertex's value at the stand, the mesh's
 * neighbours */
export function skinContext(B, mesh) {
  const F = bodyField(B), rest = boneFrames(B, standPose(B));
  const iso = mesh.vertices.map((v) => F.field(v));
  const nbr = mesh.vertices.map(() => new Set());
  for (const q of mesh.quads) for (let i = 0; i < 4; i++) { nbr[q[i]].add(q[(i + 1) % 4]); nbr[q[(i + 1) % 4]].add(q[i]); }
  const nb = nbr.map((s) => [...s]);
  // each vertex's offset from its neighbours' centre at the stand (the shape a relaxation keeps)
  const umbrella = mesh.vertices.map((v, i) => { const m = [0, 0, 0]; for (const j of nb[i]) { m[0] += mesh.vertices[j][0]; m[1] += mesh.vertices[j][1]; m[2] += mesh.vertices[j][2]; } return sub(v, mul(m, 1 / (nb[i].length || 1))); });
  return { B, mesh, F, rest, iso, nbr: nb, umbrella };
}

export const IMPLICIT = Object.freeze({ tol: 2e-4, steps: 8, rounds: 4, smooth: 0.5, maxStep: 0.02, contact: 55 });

/**
 * The oracle: the LBS skin drawn onto the posed field. `only` (a set of vertex indices) limits the work to a region
 * (a bent joint's); the rest stay where LBS put them.
 */
export function implicitSkin(ctx, pose, lbs = skinPose(ctx.mesh, ctx.rest, pose), { only = null } = {}) {
  const { iso, nbr, B } = ctx, f = ctx.F.posed(ctx.rest, pose), k = B.scale, n = lbs.length;
  const e = 1e-4, grad = (p, f0) => [(f(add(p, [e, 0, 0])) - f0) / e, (f(add(p, [0, e, 0])) - f0) / e, (f(add(p, [0, 0, e])) - f0) / e];
  const cosContact = Math.cos(IMPLICIT.contact * Math.PI / 180);
  const x = lbs.map((p) => p.slice()), moved = new Uint8Array(n);
  const project = (i) => {
    let p = x[i], gPrev = null;
    for (let s = 0; s < IMPLICIT.steps; s++) {
      const f0 = f(p), r = f0 - iso[i];
      if (Math.abs(r) < IMPLICIT.tol * k) break;
      const g = grad(p, f0), g2 = dot(g, g);
      if (!(g2 > 1e-12)) break;
      // where the gradient turns sharply the skin has met another part of itself (a contact): stop there
      if (gPrev && dot(g, gPrev) < cosContact * Math.sqrt(g2 * dot(gPrev, gPrev))) break;
      let st = mul(g, -r / g2);
      const sl = len(st), cap = IMPLICIT.maxStep * k;
      if (sl > cap) st = mul(st, cap / sl);
      p = add(p, st); gPrev = g; moved[i] = 1;
    }
    x[i] = p;
  };
  const idx = only ? [...only] : Array.from({ length: n }, (_, i) => i);
  for (const i of idx) project(i);
  // TANGENTIAL RELAXATION (Vaillant's): where projection crowded or crossed the vertices (two sides of a fold drawn onto
  // one surface), each slides within its tangent plane toward its neighbours' centre plus its own offset from them at
  // the stand (carried by its blended transform: the rest's shape kept, the crowding spread), then is drawn on again
  for (let r = 0; r < IMPLICIT.rounds; r++) {
    const act = idx.filter((i) => moved[i] || nbr[i].some((j) => moved[j]));
    const next = new Map();
    for (const i of act) {
      const m = [0, 0, 0];
      for (const j of nbr[i]) { m[0] += x[j][0]; m[1] += x[j][1]; m[2] += x[j][2]; }
      const nn = nbr[i].length || 1, M = blended(ctx.mesh, ctx.rest, pose, i);
      const target = add(mul(m, 1 / nn), mv(M, ctx.umbrella[i])), nrm = mv(M, ctx.mesh.normals[i]), nl = len(nrm) || 1;
      let mvv = sub(target, x[i]);
      mvv = sub(mvv, mul(nrm, dot(mvv, nrm) / (nl * nl)));                    // within the tangent plane
      next.set(i, add(x[i], mul(mvv, IMPLICIT.smooth)));
    }
    for (const [i, p] of next) x[i] = p;
    for (const i of act) project(i);
  }
  return x;
}

/** a vertex's blended rotation (LBS's linear part) in a pose, and its inverse */
const blended = (mesh, rest, pose, i) => {
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const [bone, w] of mesh.weights[i]) {
    const r = rest[bone], p = pose[bone];
    if (!r || !p) continue;
    // M_b = P_bᵀ R_b (the rows are the frames' axes): a rest vector v goes to Σ_k (R_b[k]·v) P_b[k]
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) M[a][b] += w * (p.R[0][a] * r.R[0][b] + p.R[1][a] * r.R[1][b] + p.R[2][a] * r.R[2][b]);
  }
  return M;
};
const inv3 = (M) => {
  const [a, b, c] = M[0], [d, e, f] = M[1], [g, h, i] = M[2];
  const A = e * i - f * h, Bc = -(d * i - f * g), C = d * h - e * g, det = a * A + b * Bc + c * C;
  if (Math.abs(det) < 1e-9) return null;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [Bc / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
};
const mv = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];

/** the vertices a joint's bend reaches: those weighted to its subtree or its parent, and their neighbours twice over */
function regionOf(ctx, d) {
  const bones = new Set([d.parent, ...subtree(d.child)]), out = new Set();
  ctx.mesh.weights.forEach((ws, i) => { if (ws.some(([b, w]) => bones.has(b) && w > 0.02)) out.add(i); });
  for (let r = 0; r < 3; r++) for (const i of [...out]) for (const j of ctx.nbr[i]) out.add(j);
  return out;
}

/**
 * The keys: for each driver, the angles its joint reaches over the corpus (a list of poses' frames), each way; a key
 * at each fraction of each extreme, the oracle's correction there in bind space, kept where it is more than a
 * millimetre's tenth.
 */
export function correctiveKeys(ctx, { drivers = DRIVERS, corpus, fractions = [0.5, 1], min = 1e-4 } = {}) {
  const { mesh, rest } = ctx, out = [];
  for (const d of drivers) {
    let lo = 0, hi = 0;
    for (const fr of corpus) { const a = jointAngle(rest, fr, d); lo = Math.min(lo, a); hi = Math.max(hi, a); }
    const angles = [...fractions.map((f) => lo * f).reverse(), ...fractions.map((f) => hi * f)].filter((a) => Math.abs(a) > 2 * Math.PI / 180);
    const region = regionOf(ctx, d), keys = [];
    for (const angle of angles) {
      const pose = bendJoint(rest, d, angle), lbs = skinPose(mesh, rest, pose), x = implicitSkin(ctx, pose, lbs, { only: region });
      const deltas = [];
      for (const i of region) {
        const dw = sub(x[i], lbs[i]);
        if (len(dw) < min * ctx.B.scale) continue;
        const Mi = inv3(blended(mesh, rest, pose, i));
        if (Mi) deltas.push([i, mv(Mi, dw)]);
      }
      keys.push({ angle, deltas });
    }
    out.push({ ...d, keys });
  }
  return { drivers: out };
}

/**
 * The keys REFIT over poses where several joints bend at once (the clips' own): keys made one joint at a time add up
 * wrong where joints bend together (the withers, the shoulder and the elbow all fold the armpit), so every vertex's keys
 * are solved together, by least squares, to bring LBS to the oracle over all the poses: Σ_p |M_p Σ_k w_pk δ_k − r_p|²
 * + λ Σ_k |δ_k − δ_k°|² (M_p the vertex's blended transform, w_pk the keys' weights in the pose, r_p the oracle's
 * correction there; the prior δ° the one-joint key, which holds a key the poses barely use). A vertex keeps the keys
 * its one-joint keys gave it (the sparsity a morph target ships with).
 */
export function fitCorrectives(ctx, set, poses, { lambda = 0.05, oracles = null } = {}) {
  const { mesh, rest } = ctx, keyList = [];
  set.drivers.forEach((d) => d.keys.forEach((kk, ki) => keyList.push({ d: d.id, ki, map: new Map(kk.deltas) })));
  const keyIdx = new Map(keyList.map((kk, j) => [`${kk.d}:${kk.ki}`, j]));
  const keysOf = mesh.vertices.map(() => []);
  keyList.forEach((kk, j) => { for (const i of kk.map.keys()) keysOf[i].push(j); });
  const verts = keysOf.flatMap((ks, i) => (ks.length ? [i] : []));
  // the normal equations, accumulated pose by pose (A: 3K × 3K, b: 3K, per vertex)
  const A = new Map(), bv = new Map();
  for (const i of verts) { const n = 3 * keysOf[i].length; A.set(i, new Float64Array(n * n)); bv.set(i, new Float64Array(n)); }
  poses.forEach((pose, pi) => {
    const W = new Map();
    for (const { driver, key, w } of correctiveWeights(set, rest, pose)) W.set(keyIdx.get(`${driver}:${key}`), w);
    if (!W.size) return;
    const lbs = skinPose(mesh, rest, pose), or = oracles?.[pi] ?? implicitSkin(ctx, pose, lbs);
    for (const i of verts) {
      const ks = keysOf[i], w = ks.map((j) => W.get(j) ?? 0);
      if (!w.some((x) => x)) continue;
      const M = blended(mesh, rest, pose, i), r = sub(or[i], lbs[i]), n = 3 * ks.length, Ai = A.get(i), bi = bv.get(i);
      // MᵀM and Mᵀr
      const MtM = [0, 1, 2].map((a) => [0, 1, 2].map((c) => M[0][a] * M[0][c] + M[1][a] * M[1][c] + M[2][a] * M[2][c]));
      const Mtr = [0, 1, 2].map((a) => M[0][a] * r[0] + M[1][a] * r[1] + M[2][a] * r[2]);
      for (let p = 0; p < ks.length; p++) {
        if (!w[p]) continue;
        for (let a = 0; a < 3; a++) bi[3 * p + a] += w[p] * Mtr[a];
        for (let q = 0; q < ks.length; q++) {
          if (!w[q]) continue;
          const ww = w[p] * w[q];
          for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) Ai[(3 * p + a) * n + 3 * q + c] += ww * MtM[a][c];
        }
      }
    }
  });
  // solve each vertex's system (the prior on its diagonal), Gaussian elimination with partial pivoting
  const fitted = keyList.map(() => []);
  for (const i of verts) {
    const ks = keysOf[i], n = 3 * ks.length, Ai = A.get(i), bi = bv.get(i);
    for (let p = 0; p < ks.length; p++) { const d0 = keyList[ks[p]].map.get(i); for (let a = 0; a < 3; a++) { Ai[(3 * p + a) * n + 3 * p + a] += lambda; bi[3 * p + a] += lambda * d0[a]; } }
    const x = solve(Ai, bi, n);
    if (!x) { ks.forEach((j) => fitted[j].push([i, keyList[j].map.get(i)])); continue; }
    ks.forEach((j, p) => fitted[j].push([i, [x[3 * p], x[3 * p + 1], x[3 * p + 2]]]));
  }
  let at = 0;
  return { drivers: set.drivers.map((d) => ({ ...d, keys: d.keys.map((kk) => ({ ...kk, deltas: fitted[at++] })) })), fit: { poses: poses.length, lambda } };
}

/** A x = b for a dense n × n A (row-major; overwritten), partial pivoting; null if singular */
function solve(A, b, n) {
  const x = Float64Array.from(b);
  for (let c = 0; c < n; c++) {
    let piv = c, best = Math.abs(A[c * n + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(A[r * n + c]); if (v > best) { best = v; piv = r; } }
    if (best < 1e-12) return null;
    if (piv !== c) { for (let j = 0; j < n; j++) { const t = A[c * n + j]; A[c * n + j] = A[piv * n + j]; A[piv * n + j] = t; } const t = x[c]; x[c] = x[piv]; x[piv] = t; }
    for (let r = c + 1; r < n; r++) {
      const f = A[r * n + c] / A[c * n + c];
      if (!f) continue;
      for (let j = c; j < n; j++) A[r * n + j] -= f * A[c * n + j];
      x[r] -= f * x[c];
    }
  }
  for (let c = n - 1; c >= 0; c--) { let s = x[c]; for (let j = c + 1; j < n; j++) s -= A[c * n + j] * x[j]; x[c] = s / A[c * n + c]; }
  return Array.from(x);
}

/** each key's weight in a pose: its driver's angle between its neighbouring keys (and the stand at 0), clamped at the last */
export function correctiveWeights(set, rest, pose) {
  const out = [];
  for (const d of set.drivers) {
    const a = jointAngle(rest, pose, d);
    const side = d.keys.filter((kk) => Math.sign(kk.angle) === Math.sign(a)).sort((p, q) => Math.abs(p.angle) - Math.abs(q.angle));
    if (!side.length || a === 0) continue;
    let prev = 0;
    for (let j = 0; j < side.length; j++) {
      const ak = side[j].angle, next = side[j + 1]?.angle;
      let w = 0;
      const t = Math.abs(a);
      if (t <= Math.abs(prev)) w = 0;
      else if (t <= Math.abs(ak)) w = (t - Math.abs(prev)) / (Math.abs(ak) - Math.abs(prev));
      else if (next === undefined) w = 1;
      else if (t < Math.abs(next)) w = (Math.abs(next) - t) / (Math.abs(next) - Math.abs(ak));
      if (w > 0) out.push({ driver: d.id, key: d.keys.indexOf(side[j]), w });
      prev = ak;
    }
  }
  return out;
}

/** LBS with the weighted keys added in bind space (exactly what an engine does with morph targets) */
export function applyCorrectives(ctx, set, pose, weights = correctiveWeights(set, ctx.rest, pose)) {
  const { mesh, rest } = ctx, bind = mesh.vertices.map((v) => v.slice()), byId = Object.fromEntries(set.drivers.map((d) => [d.id, d]));
  for (const { driver, key, w } of weights) for (const [i, dv] of byId[driver].keys[key].deltas) bind[i] = add(bind[i], mul(dv, w));
  return skinPose({ ...mesh, vertices: bind }, rest, pose);
}

/** the poses the clips make: each gait round its cycle, the jump through its flight, grazing, resting a hind */
export function correctiveCorpus(B, { phases = 8, jumpSamples = 12 } = {}) {
  const out = [];
  for (const g of ['walk', 'trot', 'canter', 'gallop']) {
    const c = gaitCycle(B, g);
    for (let i = 0; i < phases; i++) out.push({ label: `${g} ${(i / phases).toFixed(3)}`, frames: boneFrames(B, c.poseAt(i / phases)) });
  }
  const jp = jumpClip(B);
  for (let i = 0; i < jumpSamples; i++) { const t = jp.duration * (i + 0.5) / jumpSamples; out.push({ label: `jump ${t.toFixed(2)} s`, frames: boneFrames(B, jp.poseAt(t)) }); }
  out.push({ label: 'grazing', frames: boneFrames(B, restState(B, { graze: 1 })) });
  out.push({ label: 'resting a hind', frames: boneFrames(B, restState(B, { restHind: 'L', rest: 1 })) });
  return out;
}

/**
 * How far a skinned body x stands from the oracle at the folds (the vertices the oracle moved more than a millimetre:
 * elsewhere LBS is already the truth), its volume, and its quads turned inside out (a quad whose normal faces against
 * its rest normal carried by its corner's blended transform: the skin folded through itself).
 */
export function foldMeasures(ctx, pose, x, oracle, lbs = skinPose(ctx.mesh, ctx.rest, pose)) {
  const { mesh, rest } = ctx, folds = [];
  for (let i = 0; i < x.length; i++) if (len(sub(oracle[i], lbs[i])) > 1e-3 * ctx.B.scale) folds.push(len(sub(x[i], oracle[i])));
  folds.sort((a, b) => a - b);
  let inverted = 0;
  for (const q of mesh.quads) {
    const a = x[q[0]], b = x[q[1]], c = x[q[2]], d = x[q[3]], n = cross(sub(c, a), sub(d, b));
    const n0 = mv(blended(mesh, rest, pose, q[0]), mesh.normals[q[0]]);
    if (dot(n, n0) < 0) inverted++;
  }
  const vol = (P) => { let V = 0; for (const q of mesh.quads) for (const [i, j, kk] of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) V += dot(P[i], cross(P[j], P[kk])) / 6; return V; };
  return { folds: folds.length, off: { p95: folds.length ? folds[Math.floor(0.95 * (folds.length - 1))] : 0, max: folds.length ? folds[folds.length - 1] : 0 }, volume: vol(x) / vol(mesh.vertices), inverted };
}

/**
 * The machine gate on held-out poses (poses the fit never saw): the corrected skin nearer the oracle at the folds than
 * LBS (its median p95 at most half LBS's, its worst p95 below LBS's), its volume as near the stand's as LBS's on the
 * whole, and an absent corrective changing nothing. The worst vertex is reported, not gated: in a deep fold (the
 * armpit at the gallop's reach) the oracle itself sends a vertex to one side of the fold or the other from pose to
 * pose, and no shape can follow that; it lies inside the fold.
 */
export function correctiveGates(ctx, set, poses, { oracles = null } = {}) {
  const rows = poses.map((pose, pi) => {
    const lbs = skinPose(ctx.mesh, ctx.rest, pose), or = oracles?.[pi] ?? implicitSkin(ctx, pose, lbs);
    return { lbs: foldMeasures(ctx, pose, lbs, or, lbs), fit: foldMeasures(ctx, pose, applyCorrectives(ctx, set, pose), or, lbs) };
  });
  const med = (a) => { const s2 = [...a].sort((x, y) => x - y); return s2[s2.length >> 1]; }, mx = (a) => Math.max(...a);
  const p95 = (k) => rows.map((r) => r[k].off.p95), vol = (k) => rows.reduce((t, r) => t + Math.abs(1 - r[k].volume), 0) / rows.length;
  const cm = (x) => `${(x * 100).toFixed(1)} cm`;
  const none = applyCorrectives(ctx, { drivers: [] }, ctx.rest), base = skinPose(ctx.mesh, ctx.rest, ctx.rest);
  const same = none.every((p, i) => p[0] === base[i][0] && p[1] === base[i][1] && p[2] === base[i][2]);
  const checks = [
    { name: 'nearer the oracle', pass: med(p95('fit')) <= 0.5 * med(p95('lbs')), saw: `median p95 off ${cm(med(p95('fit')))} (LBS ${cm(med(p95('lbs')))})`, want: '≤ half LBS\'s' },
    { name: 'worst pose', pass: mx(p95('fit')) < mx(p95('lbs')), saw: `worst p95 off ${cm(mx(p95('fit')))} (LBS ${cm(mx(p95('lbs')))})`, want: 'below LBS\'s' },
    { name: 'volume', pass: vol('fit') <= vol('lbs') + 1e-3, saw: `mean volume error ${(vol('fit') * 100).toFixed(2)}% (LBS ${(vol('lbs') * 100).toFixed(2)}%)`, want: 'no worse than LBS' },
    { name: 'absent adds nothing', pass: same, saw: same ? 'identical' : 'differs', want: 'identical to LBS' },
  ];
  return { checks, rows, worst: { fit: mx(rows.map((r) => r.fit.off.max)), lbs: mx(rows.map((r) => r.lbs.off.max)) } };
}
