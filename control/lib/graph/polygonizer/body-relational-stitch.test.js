// The hinges stitched (realistic laws 4, body-relational.js formSlice `stitch`): the knee's and the elbow's two segments
// end and begin on one ring at the joint's plane, the same points, and the shading's weld gives that ring one normal
// from either side, so the light runs across the joint unbroken. Under laws 3 the two overlap across the plane as they
// did. One body (the man's). (Beside the module, not in the critical tier: two realistic mints.)
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { layeredShadingNormals, STUDIO_SMOOTH_CREASE } from './station-loft-shade.js';

const HINGES = [['thighR', 'shankR'], ['upperArmR', 'foreArmR']];
const key = (p) => p.map((x) => Math.round(x / 1e-4)).join(',');

describe('the hinges stitched', () => {
  it('under laws 4 each hinge\'s segments share one ring and one normal across it; laws 3 overlapped', { timeout: 300_000 }, () => {
    const now = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic' }) }).recipe;
    const before = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', physique: { from: 'athletic', laws: 3 } }) }).recipe;
    for (const [a, b] of HINGES) {
      const end = now.parts[a].stations.at(-1).points, start = now.parts[b].stations[0].points;
      expect(now.parts[a].slots, a).toEqual(now.parts[b].slots);
      for (const sl of now.parts[a].slots) expect(start[sl], `${a} ${sl}`).toEqual(end[sl]);
      // (before: the lower segment's first ring stood apart from the upper's last, the two overlapping)
      const e0 = before.parts[a].stations.at(-1).points, s0 = before.parts[b].stations[0].points;
      expect(before.parts[a].slots.some((sl) => JSON.stringify(e0[sl]) !== JSON.stringify(s0[sl]))).toBe(true);
    }
    // the shading: at every point of the shared ring, the two segments' skin corners (an end cap's left out: its faces hold
    // the cap's pole) carry the same normal
    const mesh = compileLayered(now), N = layeredShadingNormals(mesh, now, { crease: STUDIO_SMOOTH_CREASE, proxy: false }), V = mesh.vertices;
    for (const [a, b] of HINGES) {
      const ring = new Set(Object.values(now.parts[a].stations.at(-1).points).map(key)), poles = new Set([now.parts[a].caps.tip, now.parts[b].caps.back].map(key));
      const at = new Map();
      mesh.faces.forEach((t, fi) => {
        const part = mesh.provenance[t[0]].part; if ((part !== a && part !== b) || t.some((vi) => poles.has(key(V[vi])))) return;
        t.forEach((vi, k) => { const kk = key(V[vi]); if (!ring.has(kk)) return; if (!at.has(kk)) at.set(kk, { [a]: [], [b]: [] }); at.get(kk)[part].push(N[fi][k]); });
      });
      expect(at.size, a).toBe(ring.size);
      for (const [, o] of at) {
        expect(o[a].length && o[b].length, a).toBeTruthy();
        const [p, q] = [o[a][0], o[b][0]];
        expect(p[0] * q[0] + p[1] * q[1] + p[2] * q[2], a).toBeGreaterThan(0.9999);
      }
    }
  });
});
