// body-smooth: the body rounded. The concepts: a new point stands on the curved patch (on a round form, nearer its
// surface than the chord's middle); the corners stay where they were; only the named parts split, each triangle into
// four, still closed; a new point binds as its corners' mean; absent, the mesh as built; Shonen High's body rounded.
import { describe, it, expect } from 'vitest';
import { curvedMidpoint, smoothBody } from './body-smooth.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { bindLayered } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

// an octahedron on the unit sphere, one part
const OCT = (() => {
  const V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const F = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
  return { vertices: V, faces: F, groups: F.map(() => 'Skin'), pointIds: V.map((_, i) => `p${i}`), faceIds: F.map((_, i) => `f${i}`), provenance: V.map((_, i) => ({ id: `p${i}`, layer: 1, part: 'ball' })) };
})();

describe('the body rounded', () => {
  it('puts a new point on the curved patch: on a round form, nearer its surface than the chord\'s middle', () => {
    const a = [1, 0, 0], b = [0, 1, 0], m = curvedMidpoint(a, b, a, b);
    expect(Math.abs(Math.hypot(...m) - 1)).toBeLessThan(Math.abs(Math.hypot(0.5, 0.5) - 1));
    expect(Math.hypot(...m)).toBeGreaterThan(Math.hypot(0.5, 0.5));
  });
  it('keeps the corners, splits each named triangle into four, closed, and leaves every other part as it was', () => {
    const S = smoothBody(OCT, ['ball']);
    expect(S.vertices.slice(0, 6)).toEqual(OCT.vertices);
    expect(S.faces.length).toBe(32); expect(S.vertices.length).toBe(6 + 12);
    const edges = new Map(); for (const f of S.faces) for (let k = 0; k < 3; k++) { const e = [f[k], f[(k + 1) % 3]].sort((x, y) => x - y).join(); edges.set(e, (edges.get(e) ?? 0) + 1); }
    expect([...edges.values()].every((n) => n === 2)).toBe(true);
    expect(smoothBody(OCT, []).faces).toEqual(OCT.faces);
  });
  it('rounds Shonen High\'s body, closed, every new point bound as its corners\' mean; a hero without it as built', () => {
    const M = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'anime', animeStyle: 'shonen-high' }) });
    expect(M.recipe.smoothBody).toEqual({ rounds: 1 });
    const m = compileLayered(M.recipe, M.dials);
    expect(m.smoothed.points).toBeLessThan(m.vertices.length);
    expect(Object.entries(auditLayered(m)).filter(([, r]) => !r.pass)).toEqual([]);
    const skin = bindLayered(m, M.recipe), i = m.provenance.findIndex((p) => p.mix), [a, b] = m.provenance[i].mix;
    const w = (v) => { const o = {}; skin.joints[v].forEach((j, k) => { if (skin.weights[v][k]) o[j] = (o[j] ?? 0) + skin.weights[v][k]; }); return o; }, A = w(a), B = w(b), I = w(i);
    for (const bi of Object.keys(I)) expect(I[bi]).toBeCloseTo(((A[bi] ?? 0) + (B[bi] ?? 0)) / 2, 6);
    expect(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'anime' }) }).recipe.smoothBody).toBeUndefined();
  });
}, 300000);
