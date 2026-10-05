// The jaw seam: the landmark head's cranium and jaw meet on one coincident ring (their caps in the Mouth tone, so the
// mouth can open). The jaw bone's frame is the head's (its `aux` the head's axis), so whatever turns the head the seam
// stays shut, and the jaw still opens about its hinge.
import { describe, expect, it } from 'vitest';

import { compileLayered } from './station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames } from './station-loft-rig.js';
import { standPose, poseLayered } from './hero-gesture.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const key = (p) => p.map((x) => Math.round(x * 1e5)).join();

describe('the jaw seam', () => {
  for (const spec of [{ cast: 'female', hair: 'bob', gesture: 'relaxed' }, { cast: 'male', gesture: 'guard' }, { cast: 'male', register: 'lowpoly', gesture: 'hand-on-hip' }]) {
    it(`stays shut standing and under a head or neck turn: ${JSON.stringify(spec)}`, () => {
      const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }), mesh = compileLayered(m.recipe, m.dials || {}, m.channels || {});
      const R = validateRig(m.recipe.rig), skin = bindLayered(mesh, m.recipe, R);
      const cr = new Map(), jaw = new Set();
      mesh.faces.forEach((t) => { const part = mesh.provenance[t[0]].part; if (part === 'cranium') t.forEach((v) => cr.set(key(mesh.vertices[v]), v)); else if (part === 'jaw') t.forEach((v) => jaw.add(v)); });
      const seam = [...jaw].map((v) => [v, cr.get(key(mesh.vertices[v]))]).filter(([, c]) => c !== undefined);
      expect(seam.length).toBeGreaterThan(8);
      for (const pose of [standPose(m.recipe, R), { head: { yaw: 25 } }, { neck: { yaw: -20 }, head: { pitch: 10, yaw: 15 } }]) {
        const V = poseLayered(mesh, m.recipe, pose, { R, skin }).mesh.vertices;
        for (const [j, c] of seam) expect(Math.hypot(V[j][0] - V[c][0], V[j][1] - V[c][1], V[j][2] - V[c][2])).toBeLessThan(1e-5);
      }
    });
  }

  it('the jaw opens about its hinge, across the head', () => {
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male' }) }), R = validateRig(m.recipe.rig);
    const rel = (pose) => { const F = boneFrames(R, R.joints, rigNodesAt(R, pose).nodes), h = F[R.boneIndex.head].m, j = F[R.boneIndex.jaw].m; return h.map((_, a) => h.map((__, b) => h[0][a] * j[0][b] + h[1][a] * j[1][b] + h[2][a] * j[2][b])); };
    const angle = (M) => Math.acos(Math.max(-1, Math.min(1, (M[0][0] + M[1][1] + M[2][2] - 1) / 2))) * 180 / Math.PI;
    expect(angle(rel({ head: { yaw: 20 } }))).toBeLessThan(1e-6);
    const open = rel({ jaw: 12 });
    expect(angle(open)).toBeCloseTo(12, 6);
    expect(Math.abs(open[0][0])).toBeCloseTo(1, 9);   // about the head's x axis: across the head
  });
});
