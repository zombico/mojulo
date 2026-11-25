/**
 * rig-gate — the machine gate on a rig made from a model mojulo did not make (rig-import.js's pack, by a file's own
 * skeleton or by autorig.js): its body posed through the bends a character makes (the arms raised and brought forward,
 * the elbows and the knees at a right angle, a hip flexed, the head turned, the trunk bent), each vertex carried by its
 * weights, and every triangle measured against its rest. A triangle stretched past half again its rest or crushed under
 * six tenths of it is TORN; the gate says the share torn in each pose and the bones its torn triangles hang on.
 *
 *   poseStretch(pack, { poses? }) → { poses: [{ name, torn, worst: [{ bone, torn }] }], torn, verdict }
 *     verdict   'pass' when no pose tears more than GATE.POSE of its triangles and all of them together no more than
 *               GATE.ALL; else 'advise' (a gate advises and stamps; it never refuses: docs/bicycles.md)
 *   GATE_POSES, GATE
 *
 * The machine gate only: what a person sees when it plays (a crease, a candy-wrapper wrist) is the eyes gate, and the
 * gate never says it passed. Pure: the same pack gives the same reading.
 */
import { humanoidParents } from '../figures/rig-tpose.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const f32 = (b64) => { const b = Buffer.from(b64, 'base64'); const out = new Float32Array(b.length / 4); for (let i = 0; i < out.length; i++) out[i] = b.readFloatLE(i * 4); return out; };
const u8 = (b64) => Uint8Array.from(Buffer.from(b64, 'base64'));

/** The bends, in the native frame (x the figure's right, y its face, z up): bone → [axis, degrees], a pose a row. */
export const GATE_POSES = Object.freeze([
  Object.freeze({ name: 'arms raised', turns: { upperArmL: [[0, 1, 0], 45], upperArmR: [[0, 1, 0], -45] } }),
  Object.freeze({ name: 'arms forward', turns: { upperArmL: [[0, 0, 1], -60], upperArmR: [[0, 0, 1], 60] } }),
  Object.freeze({ name: 'elbows bent', turns: { foreArmL: [[0, 0, 1], -90], foreArmR: [[0, 0, 1], 90] } }),
  Object.freeze({ name: 'knees bent', turns: { shankL: [[1, 0, 0], -90], shankR: [[1, 0, 0], -90] } }),
  Object.freeze({ name: 'hip flexed', turns: { thighL: [[1, 0, 0], 70] } }),
  Object.freeze({ name: 'head turned', turns: { head: [[0, 0, 1], 50] } }),
  Object.freeze({ name: 'trunk bent', turns: { torso: [[1, 0, 0], -30] } }),
]);
/** The gate's shares: torn triangles in any one pose, and over all of them. */
export const GATE = Object.freeze({ POSE: 0.05, ALL: 0.02, STRETCH: 1.5, CRUSH: 0.6 });

function rot(axis, deg) {
  const l = Math.hypot(...axis), [x, y, z] = axis.map((v) => v / l), t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}
const mm = (a, b) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Each bone's posed transform: p ↦ R (p − head) + head′, down the hierarchy. */
function posed(bones, parent, turns) {
  const X = new Array(bones.length);
  const done = (k) => {
    if (X[k]) return X[k];
    const local = turns[bones[k].id] ? rot(...turns[bones[k].id]) : I3;
    const p = parent[k];
    if (p < 0 || p === undefined) { X[k] = { R: local, at: bones[k].head }; return X[k]; }
    const P = done(p);
    const at = apply(P, bones[k].head, bones[p].head);
    X[k] = { R: mm(P.R, local), at, pivot: bones[k].head };
    return X[k];
  };
  // a transform maps a point by its rotation about its bone's rest head, onto that head's posed place
  function apply(T, q, pivot) { const d = mv(T.R, [q[0] - pivot[0], q[1] - pivot[1], q[2] - pivot[2]]); return [d[0] + T.at[0], d[1] + T.at[1], d[2] + T.at[2]]; }
  bones.forEach((_, k) => done(k));
  return (k, q) => apply(X[k], q, bones[k].head);
}

/** The pack posed through the gate's bends, each triangle measured (see the header). */
export function poseStretch(pack, { poses = GATE_POSES } = {}) {
  const bones = pack.bones, parent = humanoidParents(bones);
  const tris = [];
  for (const part of pack.parts) {
    if (!part) continue;
    const P = f32(part.pos), J = u8(part.jnt), W = f32(part.wgt);
    for (let v = 0; v + 2 < P.length / 3; v += 3) {
      const c = [0, 1, 2].map((k) => ({ p: [P[(v + k) * 3], P[(v + k) * 3 + 1], P[(v + k) * 3 + 2]], j: J.slice((v + k) * 4, (v + k) * 4 + 4), w: W.slice((v + k) * 4, (v + k) * 4 + 4) }));
      const e = [0, 1, 2].map((k) => Math.hypot(...[0, 1, 2].map((d) => c[k].p[d] - c[(k + 1) % 3].p[d])));
      if (Math.min(...e) < 1e-6) continue;
      tris.push({ c, e });
    }
  }
  const out = [];
  let tornAll = 0;
  for (const pose of poses) {
    const X = posed(bones, parent, pose.turns);
    const moveOf = (c) => { const q = [0, 0, 0]; for (let k = 0; k < 4; k++) { if (!(c.w[k] > 0)) continue; const m = X(c.j[k], c.p); q[0] += c.w[k] * m[0]; q[1] += c.w[k] * m[1]; q[2] += c.w[k] * m[2]; } return q; };
    let torn = 0;
    const byBone = new Map();
    for (const t of tris) {
      const q = t.c.map(moveOf);
      const r = [0, 1, 2].map((k) => Math.hypot(...[0, 1, 2].map((d) => q[k][d] - q[(k + 1) % 3][d])) / t.e[k]);
      if (Math.max(...r) > GATE.STRETCH || Math.min(...r) < GATE.CRUSH) {
        torn++;
        const b = t.c[0].j[0];
        byBone.set(b, (byBone.get(b) || 0) + 1);
      }
    }
    tornAll += torn;
    out.push({ name: pose.name, torn: r4(torn / (tris.length || 1)), worst: [...byBone].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3).map(([b, n]) => ({ bone: bones[b]?.id ?? String(b), torn: n })) });
  }
  const all = r4(tornAll / ((tris.length || 1) * poses.length));
  return { poses: out, torn: all, triangles: tris.length, verdict: all <= GATE.ALL && out.every((p) => p.torn <= GATE.POSE) ? 'pass' : 'advise' };
}
