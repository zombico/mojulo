/**
 * hair-bake — the hair's swing baked onto joints, so an engine plays it as it plays the body: each guide strand
 * (hair.js) becomes a short chain of joints laid along it (two for a mane's or the forelock's short lock, three for a
 * tail's long one), its cards skinned along the chain, and the simulation's strands at every key of a clip become the
 * chain's keys.
 *
 * A JOINT runs from one strand point to a later one (its head on the strand: the simulated point itself, its direction
 * toward the next joint's head). Its rotation from the stand is its root bone's (the bone the guide grows from: the
 * card's twist rides the body) followed by the shortest turn that carries that bone's carried rest direction onto the
 * simulated one. A card's vertex at strand point i rides the joint whose span it starts, wholly: each joint's head is
 * its simulated point, the points between ride its chord (blending two joints' rigid motions would cut the corners).
 *
 * THE KEYS of a clip: a cycle's swing is run as a closed loop on the clip's own keys (the strands close on themselves:
 * its last key wraps onto its first); a one-shot's starts in motion: settled on its entry pose, swung through its
 * entry gait for WARM seconds (the pose before its start, `before(t)` for t < 0), then run through it, its keys on the
 * clip's own times. So a transition picks up the hair as the gait it leaves had it swinging.
 *
 *   HAIR_CHAINS                     the joints' bounds along a strand, per kind (point indices)
 *   hairRig(B)                      → { guides, rest (strands), joints: [{ id, gi, a, b, bone, head, dir }], skin(at) }
 *   bakeHairClip(B, rig, clip, K)   → strands at the clip's K keys (clip: mountClips' { at, before, s, once })
 *   hairJointKeys(rig, strands, F, rest) → per joint { R (rest → pose, row-major), h }
 */
import { simulateHair, hairGuides } from './hair.js';
import { standPose } from './gait.js';
import { boneFrames } from './skin.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));

/** where along a strand (its point indices, 0 the root) the joints run: [b0, b1, …] makes joints b0→b1, b1→b2, … */
export const HAIR_CHAINS = Object.freeze({ mane: [0, 4, 7], forelock: [0, 4, 7], tail: [0, 3, 5, 7] });
export const WARM = 2;                                            // seconds of the entry gait before a one-shot

/** a bone's rotation from the stand into a pose, row-major (rest vector v → Σ_k (R_k·v) P_k) */
const turnOf = (r, p) => [0, 1, 2].map((a) => [0, 1, 2].map((b) => p.R[0][a] * r.R[0][b] + p.R[1][a] * r.R[1][b] + p.R[2][a] * r.R[2][b]));
const mv = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
const mm = (A, Bm) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => A[i][0] * Bm[0][j] + A[i][1] * Bm[1][j] + A[i][2] * Bm[2][j]));
/** the shortest rotation carrying unit a onto unit b (row-major) */
function between(a, b) {
  const v = cross(a, b), c = dot(a, b), s2 = dot(v, v);
  if (s2 < 1e-18) return c > 0 ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : (() => { const p = unit(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0])); return [0, 1, 2].map((i) => [0, 1, 2].map((j) => 2 * p[i] * p[j] - (i === j ? 1 : 0))); })();
  const K = [[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]], f = 1 / (1 + c);
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) + K[i][j] + f * (K[i][0] * K[0][j] + K[i][1] * K[1][j] + K[i][2] * K[2][j])));
}

/** the hair's rig: its guides, their strands hung at the stand, the joints along them, a card vertex's skin */
export function hairRig(B) {
  const stand = standPose(B), sim = simulateHair(B, () => stand, { t0: 0, t1: 0.5, fps: 10 }), rest = sim.strands[sim.strands.length - 1];
  const guides = sim.guides, joints = [], first = [];
  guides.forEach((g, gi) => {
    first.push(joints.length);
    const bnd = HAIR_CHAINS[g.kind];
    for (let j = 0; j + 1 < bnd.length; j++) {
      const a = bnd[j], b = Math.min(g.n - 1, bnd[j + 1]);
      joints.push({ id: `hair:${g.id}:${j}`, gi, j, a, b, bone: g.bone, head: rest[gi][a], tail: rest[gi][b], dir: unit(sub(rest[gi][b], rest[gi][a])) });
    }
  });
  // a card vertex at strand point i of guide gi: wholly on the joint whose span it starts (each joint's head lands on its
  // simulated point exactly, the points between on its chord; blending two joints would cut the strand's corners)
  const skin = ([gi, i]) => {
    const bnd = HAIR_CHAINS[guides[gi].kind];
    let j = 0;
    while (j + 2 < bnd.length && i >= bnd[j + 1]) j++;
    return [[first[gi] + j, 1]];
  };
  return { guides, rest, joints, skin, first };
}

/**
 * The strands at a clip's K keys (a cycle's at k·s/K, k < K; a one-shot's at k·s/(K−1), k ≤ K−1). `clip`: mountClips'
 * sampler ({ at(t), before?(t), s, once }).
 */
export function bakeHairClip(B, rig, clip, K) {
  if (!clip.once) {
    const sim = simulateHair(B, (t) => clip.at(t), { t0: 0, t1: clip.s, fps: K / clip.s, loop: true, warm: Math.max(1, Math.ceil(3 / clip.s)) });
    return sim.strands.slice(0, K);
  }
  const h = clip.s / (K - 1), m = Math.ceil(WARM / h), before = clip.before ?? (() => clip.at(0));
  const sim = simulateHair(B, (t) => (t < 0 ? before(t) : clip.at(Math.min(clip.s, t))), { t0: -m * h, t1: clip.s, fps: 1 / h, settle: 1.5 });
  return sim.strands.slice(m, m + K);
}

/** each joint's rotation from the stand and its head, from a key's strands and the body's frames there */
export function hairJointKeys(rig, strands, F, rest) {
  return rig.joints.map((J) => {
    const Rb = turnOf(rest[J.bone], F[J.bone]), carried = mv(Rb, J.dir), st = strands[J.gi], d = unit(sub(st[J.b], st[J.a]));
    return { R: mm(between(carried, d), Rb), h: st[J.a] };
  });
}

/** the stand's frames (for callers that have none at hand) */
export const restFrames = (B) => boneFrames(B, standPose(B));
export { hairGuides };
