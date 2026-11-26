/**
 * con-operate — a construction shelf machine made to be OPERATED on a page: its joints under an operator's hands (an
 * excavator's swing, boom, arm and bucket), its parts each moving as the chain moves them, exactly, with nothing of the
 * chain run on the page.
 *
 * Each part rides one JOINT: the deepest whose turning moves it (a house and its cab the swing's; the boom the boom's;
 * the stick, its ram and its bucket's ram the stick's or the bucket's), and hangs from the part that the joint before
 * it moves (its PARENT: the house for the boom, the boom for the stick). Its placement under its parent is a function of
 * its own joint alone, a ram stretched between the two included, so it is sampled across that joint's range (every
 * `step` degrees; a swing that turns all the way round, the whole turn) as the affine that carries the part from where it
 * stands at rest, read off the part's own faces at each sample (least squares on its corners: a ram's stretch is an
 * affine as a turn is). On the page a part's matrix is its parent's times its own sample, lerped: what the chain would
 * have built, at any joint values. The geometry is the machine at rest, in its own frame (+y its nose, z up, on the
 * ground), each part's triangles and colours as the shelf lights them.
 *
 *   operatorRig(archetype, { step? }) → { archetype, joints: [{ name, lo, hi, rest, n, wrap? }], parts: [{ id, joint,
 *                                       parent, tris, pos: number[], col: number[], table: number[] }], tip: { part,
 *                                       at: [x, y, z] }, ms }
 *     joints  in the chain's order; `n` samples from `lo` to `hi` degrees (a whole turn `wrap`)
 *     parts   `joint` its joint's index (-1: on the base, never moving), `parent` a part's index (-1: the machine's own
 *             frame), `pos` its triangles at rest (9 floats a triangle), `col` their colours (linear 0..1, 9 a triangle),
 *             `table` its joint's samples, 12 floats each (a 3×4 affine, rows), from rest to its placement under its
 *             parent
 *     tip     the tool's working point (an excavator's bucket's teeth): the lowest point of its part at rest, which the
 *             page carries with the part to know where the bucket is
 *   OPERATED   the archetypes a page may operate, and what each tool's part is
 *
 * Memoized per archetype and step. Pure (the shelf's own dice: none).
 */
import { assembleMachine, machineCtx, posedJoints } from './index.js';
import { rangeOf } from './con-chain.js';
import { lowerAssemblerBuild } from '../worlds/workbench-assembler.js';

export const OPERATED = Object.freeze({ crawlerExcavator: Object.freeze({ tool: 'bucket' }), wheeledExcavator: Object.freeze({ tool: 'bucket' }), miniExcavator: Object.freeze({ tool: 'bucket' }) });
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;

// a face's fill as linear-ish 0..1 rgb (its lit colour, the shelf's)
const rgb = (hex) => { const h = typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#888888'; return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };

// the affine (3×4, rows) that carries points P to Q, least squares over their homogeneous coordinates
function fitAffine(P, Q) {
  const M = Array.from({ length: 4 }, () => new Float64Array(4)), B = Array.from({ length: 4 }, () => new Float64Array(3));
  for (let i = 0; i < P.length; i++) {
    const x = [P[i][0], P[i][1], P[i][2], 1];
    for (let a = 0; a < 4; a++) { for (let b = 0; b < 4; b++) M[a][b] += x[a] * x[b]; for (let c = 0; c < 3; c++) B[a][c] += x[a] * Q[i][c]; }
  }
  // (a whisker on the diagonal: a flat part, a plate, still has an answer, its normal kept)
  for (let a = 0; a < 3; a++) M[a][a] += 1e-9;
  const X = solve4(M, B);   // 4×3: Q = x · X
  return [X[0][0], X[1][0], X[2][0], X[3][0], X[0][1], X[1][1], X[2][1], X[3][1], X[0][2], X[1][2], X[2][2], X[3][2]];
}
function solve4(M, B) {
  const A = M.map((r, i) => [...r, ...B[i]]);
  for (let c = 0; c < 4; c++) {
    let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c] || 1e-12;
    for (let k = c; k < 7; k++) A[c][k] /= d;
    for (let r = 0; r < 4; r++) if (r !== c) { const f = A[r][c]; for (let k = c; k < 7; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map((r) => r.slice(4));
}
const mul = (A, B) => [0, 1, 2].flatMap((r) => [0, 1, 2, 3].map((c) => A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c] + (c === 3 ? A[r * 4 + 3] : 0)));
function invert(A) {
  // (a 3×4 affine's inverse: its 3×3 inverted, its translation carried back)
  const [a, b, c, , d, e, f, , g, h, i] = A, det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g) || 1e-12;
  const R = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  const t = [A[3], A[7], A[11]];
  return [R[0], R[1], R[2], -(R[0] * t[0] + R[1] * t[1] + R[2] * t[2]), R[3], R[4], R[5], -(R[3] * t[0] + R[4] * t[1] + R[5] * t[2]), R[6], R[7], R[8], -(R[6] * t[0] + R[7] * t[1] + R[8] * t[2])];
}
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

const MEMO = new Map();
export function operatorRig(archetype, { step = 4 } = {}) {
  const key = `${archetype}|${step}`;
  if (MEMO.has(key)) return MEMO.get(key);
  if (!OPERATED[archetype]) throw new Error(`con-operate: '${archetype}' is no machine a page operates (${Object.keys(OPERATED).join(', ')})`);
  const t0 = Date.now(), ctx = machineCtx(archetype), arch = ctx.arch, names = Object.keys(arch.joints), rest = posedJoints(archetype, 'rest');
  const build = (pose) => lowerAssemblerBuild(assembleMachine(archetype, { pose, laws: false }).manifest);
  const R0 = build(rest), ids = R0.placements.map((p) => p.id);
  // each part's corners (deduplicated, a few hundred at most: what a fit needs)
  const cornersOf = (B, id) => { const p = B.placements.find((x) => x.id === id), seen = new Set(), out = []; for (let f = p.faceStart; f < p.faceStart + p.faceCount; f++) for (const q of B.faces[f].corners) { const k = q.map((v) => v.toFixed(4)).join(); if (seen.has(k)) continue; seen.add(k); out.push(q); } return out.length > 600 ? out.filter((_, i) => i % Math.ceil(out.length / 600) === 0) : out; };
  const restCorners = Object.fromEntries(ids.map((id) => [id, cornersOf(R0, id)]));
  // which joint moves which part: the deepest, in the chain's order
  const sig = (B) => Object.fromEntries(B.placements.map((p) => [p.id, B.faces[p.faceStart].corners.flat().map((v) => v.toFixed(3)).join()]));
  const s0 = sig(R0), jointOf = Object.fromEntries(ids.map((id) => [id, -1]));
  names.forEach((name, k) => { const s = sig(build({ ...rest, [name]: rest[name] + 7 })); for (const id of ids) if (s[id] !== s0[id]) jointOf[id] = k; });
  // each joint's own part (what the next joint's parts hang from): the largest it moves (the boom, not its rams)
  const faces = Object.fromEntries(R0.placements.map((p) => [p.id, p.faceCount]));
  const bodyOf = names.map((_, k) => ids.filter((id) => jointOf[id] === k).reduce((m, id) => (!m || faces[id] > faces[m] ? id : m), null));
  const joints = names.map((name, k) => {
    const r = rangeOf(arch, name, ctx), wrap = !r, lo = wrap ? -180 : r[0], hi = wrap ? 180 : r[1], n = Math.max(2, Math.ceil((hi - lo) / step) + 1);
    return { name, lo: r4(lo), hi: r4(hi), rest: r4(rest[name]), n, ...(wrap ? { wrap: true } : {}), body: bodyOf[k] };
  });
  // the samples: each joint across its range, the rest at rest; each part's affine from rest, its parent's taken out
  const A = Object.fromEntries(ids.map((id) => [id, []]));
  joints.forEach((J, k) => {
    for (let s = 0; s < J.n; s++) {
      const v = J.lo + ((J.hi - J.lo) * s) / (J.n - 1), B = build({ ...rest, [J.name]: v });
      const fit = (id) => fitAffine(restCorners[id], cornersOf(B, id));
      const parentFit = k > 0 && joints[k - 1].body ? fit(joints[k - 1].body) : IDENT;
      for (const id of ids) if (jointOf[id] === k) A[id].push(...mul(invert(parentFit), fit(id)).map(r4));
    }
  });
  const index = Object.fromEntries(ids.map((id, i) => [id, i]));
  const parts = ids.map((id) => {
    const k = jointOf[id], p = R0.placements.find((x) => x.id === id), pos = [], col = [];
    for (let f = p.faceStart; f < p.faceStart + p.faceCount; f++) {
      const F = R0.faces[f], c = rgb(F.fill), cs = F.corners;
      for (let i = 1; i + 1 < cs.length; i++) for (const q of [cs[0], cs[i], cs[i + 1]]) { pos.push(r4(q[0]), r4(q[1]), r4(q[2])); col.push(...c.map((v) => r4(v))); }
    }
    return { id, joint: k, parent: k > 0 && joints[k - 1].body ? index[joints[k - 1].body] : -1, tris: pos.length / 9, pos, col, table: A[id] };
  });
  // the tool's working point: its part's lowest corner at rest
  const tool = OPERATED[archetype].tool, tc = restCorners[tool] ?? [];
  const tip = { part: index[tool], at: (tc.reduce((m, q) => (!m || q[2] < m[2] ? q : m), null) ?? [0, 0, 0]).map(r4) };
  const out = { archetype, joints: joints.map(({ body: _b, ...J }) => J), parts, tip, ms: Date.now() - t0 };
  MEMO.set(key, out);
  return out;
}
