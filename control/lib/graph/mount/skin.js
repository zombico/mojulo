/**
 * skin — a mount's body carried by its skeleton: every bone's frame at the stand and in a pose, the mesh deformed by
 * linear blend skinning (each vertex by its four weights, body.js), and the measures a skinned body is held to.
 *
 * A BONE'S FRAME: its direction (head → tail), and a side axis: a leg bone's is its leg's plane's normal (the leg is
 * solved in that plane, so the frame turns exactly as the leg does); the trunk's, neck's, head's and tail's the body's
 * own side axis as the pose rolls and pitches it. The side made square to the direction, the third axis their cross.
 * A bone's transform from the stand to the pose: R = F_pose · F_standᵀ about its head.
 *
 *   boneFrames(B, frame) → { [bone]: { h, R: [d, s, w] } }
 *   skinPose(B, mesh, frame, rest = boneFrames(B, stand)) → posed vertices
 *   skinMeasures(mesh, posed) → { stretch: { p05, p50, p95, min, max }, volume: posed / rest }
 */
import { bodyPoint } from './pose.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

/** the leg a bone belongs to (its plane), or null for the trunk, neck, head and tail */
export function legOf(bone) {
  const m = /^(scapula|humerus|radius|cannonF|pasternF|hoofF)([RL])$/.exec(bone);
  if (m) return `${m[2]}F`;
  const n = /^(femur|tibia|cannonH|pasternH|hoofH)([RL])$/.exec(bone);
  return n ? `${n[2]}H` : null;
}

export function boneFrames(B, frame) {
  const bd = { psi: 0, sway: 0, rollF: 0, rollH: 0, pitch: 0, ...frame.body };
  // the body's side axis where a bone sits along the trunk (the trunk twists between its girdles); for the neck, head
  // and tail, at their roots
  const T = B.trunk, yMid = (id) => (/^(neck|head|jaw|ear|bit)/.test(id) ? T.neck[0][0] : /^tail/.test(id) ? T.tailRoot[0] : null);
  const sideAt = (y, pelvic) => unit(sub(bodyPoint(B, bd, [1, y, T.com[1]], pelvic), bodyPoint(B, bd, [0, y, T.com[1]], pelvic)));
  const out = {};
  for (const [id, b] of Object.entries(frame.bones)) {
    const d = unit(sub(b.tail, b.head));
    const rest = frame.restY?.[id];
    let s = sideAt(yMid(id) ?? rest ?? (b.head[1] + b.tail[1]) / 2, /^(spine0|tail)/.test(id));
    const leg = legOf(id);
    if (leg && frame.legs?.[leg]?.plane) {
      const pl = frame.legs[leg].plane, ew = [(pl.G[0] - pl.xh) / pl.D, 0, pl.G[2] / pl.D];
      s = unit(cross([0, 1, 0], ew));                                    // the leg's plane's normal, pointing out right
      if (s[0] < 0) s = mul(s, -1);
    }
    let sq = sub(s, mul(d, dot(s, d)));
    if (Math.hypot(...sq) < 1e-6) sq = sub([0, 0, 1], mul(d, d[2]));    // a bone along the side axis: square to up
    sq = unit(sq);
    out[id] = { h: b.head, R: [d, sq, cross(d, sq)] };
  }
  return out;
}

/** the mesh deformed into a pose: v' = Σ w (F_pose F_restᵀ (v − h_rest) + h_pose) */
export function skinPose(mesh, rest, pose) {
  return mesh.vertices.map((v, i) => {
    let x = 0, y = 0, z = 0;
    for (const [bone, w] of mesh.weights[i]) {
      const r = rest[bone], p = pose[bone];
      if (!r || !p) continue;
      const q = sub(v, r.h), l = [dot(q, r.R[0]), dot(q, r.R[1]), dot(q, r.R[2])];      // in the rest frame
      const g = add(add(add(mul(p.R[0], l[0]), mul(p.R[1], l[1])), mul(p.R[2], l[2])), p.h);
      x += w * g[0]; y += w * g[1]; z += w * g[2];
    }
    return [x, y, z];
  });
}

/** the volume a closed quad mesh bounds (the divergence theorem over its triangles) */
export function meshVolume(vertices, quads) {
  let V = 0;
  for (const q of quads) for (const [a, b, c] of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) V += dot(vertices[a], cross(vertices[b], vertices[c])) / 6;
  return V;
}

/** how the skinned mesh stretches against its rest: every quad edge's length ratio, and the volume kept */
export function skinMeasures(mesh, posed) {
  // (an edge far shorter than the mesh's typical one, two surface-net vertices all but met, is left out: its ratio is noise)
  const edges = [], seen = new Set();
  for (const q of mesh.quads) for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], key = a < b ? a * 1e7 + b : b * 1e7 + a;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push([a, b, Math.hypot(...sub(mesh.vertices[a], mesh.vertices[b]))]);
  }
  const typical = edges.map((e) => e[2]).sort((x, y) => x - y)[Math.floor(edges.length / 2)];
  const ratios = edges.filter((e) => e[2] > 0.3 * typical).map(([a, b, l0]) => Math.hypot(...sub(posed[a], posed[b])) / l0);
  ratios.sort((x, y) => x - y);
  const at = (f) => ratios[Math.min(ratios.length - 1, Math.floor(f * ratios.length))];
  return {
    stretch: { p01: at(0.01), p05: at(0.05), p50: at(0.5), p95: at(0.95), p99: at(0.99), min: ratios[0], max: ratios[ratios.length - 1] },
    volume: meshVolume(posed, mesh.quads) / meshVolume(mesh.vertices, mesh.quads),
  };
}
