// The 7G drawings' test fixture (anime-drawings.test.js, anime-drawings.deep.test.js): the default anime hero's head
// built as the face rig builds it (and that head in a socket under a pyramid nose, its jaw curved in: sculpt `orbit`,
// `noseShape`, `jawHollow`), the vertices one build moves from another,
// its folds, and a drawing's whole check.
import { expect } from 'vitest';
import { animeHeadAt } from './humanoid-plan.js';
import { faceRigOptions } from './anime-face-rig.js';
import { heroRecord } from '../../mcp/tools/layered.js';

export const { opts } = faceRigOptions(heroRecord({ cast: 'male', head: 'anime' }));
export const X = ['face', 'irisL', 'irisR', 'pupilL', 'pupilR', 'catchL', 'catchR', 'lidL', 'lidR', 'browL', 'browR', 'lashLowL', 'lashLowR'];
export const pts = (part) => Object.keys(part.offsets).map((v) => part.offsets[v]);
/** the vertices a build moves from another's, by part: { part: Set(index) } */
export function moved(A, B, tol = 1e-6) {
  const out = {};
  for (const n of X) { const a = pts(A[n]), b = pts(B[n]), s = new Set(); a.forEach((p, i) => { if (Math.hypot(p[0] - b[i][0], p[1] - b[i][1], p[2] - b[i][2]) > tol) s.add(i); }); if (s.size) out[n] = s; }
  return out;
}
const normal = (P, f) => { const [a, b, c] = f.map((v) => P[+v.slice(1)]), u = b.map((x, i) => x - a[i]), w = c.map((x, i) => x - a[i]); return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; };
/** the face's triangles a build turns over against the neutral (a fold) */
export const folds = (A, N) => { const a = pts(A.face), n = pts(N.face); return Object.entries(A.face.faces).filter(([, f]) => { const p = normal(a, f), q = normal(n, f); return p[0] * q[0] + p[1] * q[1] + p[2] * q[2] <= 0; }).map(([k]) => k); };
/** the parts each layer may move */
export const MAY = { brows: ['browL', 'browR'], lids: ['face', 'lidL', 'lidR', 'lashLowL', 'lashLowR', 'irisL', 'irisR', 'pupilL', 'pupilR', 'catchL', 'catchR'], gaze: ['irisL', 'irisR', 'pupilL', 'pupilR', 'catchL', 'catchR'], mouth: ['face'] };

/** a head's builds and its drawings' check, for the face rig's options `o` */
export function fixtureOf(o) {
  const builds = new Map();
  const build = (drawing = null, E = {}) => { const k = JSON.stringify([drawing, E]); if (!builds.has(k)) builds.set(k, animeHeadAt(o, E, X, drawing)); return builds.get(k); };
  /** a drawing's words built whole: the topology kept, only its layer's parts moved (a face vertex only where today's
   * channels of its layer move one), and no face turned over but the sliver every opening turns */
  function checkDrawing(name, layer, words) {
    const N = build(), A = build(words), M = moved(A, N);
    const ref = { mouth: [build(null, { smile: 1 }), build(null, { open: 1 })], lids: [build(null, { blink: 1 })] }[layer];
    const sliver = folds(build(null, { open: 0.6 }), N);
    for (const n of X) { expect(Object.keys(A[n].offsets).length, `${name} ${n}`).toBe(Object.keys(N[n].offsets).length); expect(A[n].faces, `${name} ${n}`).toEqual(N[n].faces); }
    expect(Object.keys(M).length, `${name} moves nothing`).toBeGreaterThan(0);
    for (const n of Object.keys(M)) expect(MAY[layer], `${name} moves ${n}`).toContain(n);
    if (M.face && ref) { const R = new Set(ref.flatMap((B) => [...(moved(B, N).face ?? [])])); for (const v of M.face) expect(R.has(v), `${name} moves face v${v} outside its region`).toBe(true); }
    expect(folds(A, N).filter((f) => !sliver.includes(f)), `${name} folds`).toEqual([]);
  }
  return { build, checkDrawing };
}
/** the default anime hero's head, and that head in a socket under a pyramid nose, its jaw curved in */
export const { build, checkDrawing } = fixtureOf(opts);
export const socketed = fixtureOf({ ...opts, sculpt: [...(Array.isArray(opts.sculpt) ? opts.sculpt : opts.sculpt ? [opts.sculpt] : []), { orbit: 0.02, noseShape: 'pyramid', jawHollow: 0.02 }] });
