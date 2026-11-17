// THE CLOTH CARRIES THE SKIN'S CORRECTIVES (realistic laws 17, layered.js carriedCorrectives). A raised arm's correctives
// push the skin round the shoulder out; the tailor's cloth over it once had none, so the skin came out through a coat (the
// shoulder blade, the deltoid). Measured as what a pose brings into view of what the coat covers at the bind (the skin, a
// second skin, the trousers' seat, a belt under the coat's body and sleeves), over eight views: under laws 17 the arm
// raised overhead shows under half what it showed under laws 16; a pose with no corrective at work shows the same. A coat
// over a painted top, the stylish hero's (Fallen Angel's Lucien). Machine gate only. (Beside the module, not in the critical
// tier: four realistic mints.)
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm } from '@/lib/graph/polygonizer/motion-stamp.js';
import { compileLayered } from '@/lib/graph/polygonizer/station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered } from '@/lib/graph/polygonizer/station-loft-rig.js';
import { standPose } from '@/lib/graph/polygonizer/hero-gesture.js';
import { correctiveRest } from '@/lib/graph/polygonizer/body-relational.js';

const OUTER = /^(Outer|Panel)$/;
const VIEWS = [0, 45, 90, 135, 180, 225, 270, 315].map((d) => (d * Math.PI) / 180);
const PX = 0.004;
function raster(V, faces, yaw, keep) {
  const c = Math.cos(yaw), s = Math.sin(yaw), P = V.map((v) => [c * v[0] - s * v[1], v[2], s * v[0] + c * v[1]]);
  const W = 600, H = 560, Z = new Float32Array(W * H).fill(-1e9), ID = new Int32Array(W * H).fill(-1);
  for (let f = 0; f < faces.length; f++) {
    if (keep && !keep[f]) continue;
    const [a, b, d] = faces[f].map((i) => P[i]);
    const xs = [a, b, d].map((p) => p[0] / PX + W / 2), ys = [a, b, d].map((p) => H - p[1] / PX + 20);
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    const den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2]); if (Math.abs(den) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const l0 = ((ys[1] - ys[2]) * (x - xs[2]) + (xs[2] - xs[1]) * (y - ys[2])) / den, l1 = ((ys[2] - ys[0]) * (x - xs[2]) + (xs[0] - xs[2]) * (y - ys[2])) / den, l2 = 1 - l0 - l1;
      if (l0 < 0 || l1 < 0 || l2 < 0) continue;
      const z = l0 * a[2] + l1 * b[2] + l2 * d[2], k = y * W + x;   // (toward the viewer: −y rotated is +z here)
      if (z > Z[k]) { Z[k] = z; ID[k] = f; }
    }
  }
  return ID;
}
function exposure(spec, poses) {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm({ cast: 'male', ...spec })) });
  const mesh = compileLayered(m.recipe, m.dials), R = validateRig(m.recipe.rig), skin = bindLayered(mesh, m.recipe, R);
  const partOf = (f) => mesh.provenance[mesh.faces[f][0]]?.part ?? '', groupOf = (p) => m.recipe.parts[p]?.group ?? 'Skin';
  const isOuter = mesh.faces.map((_, f) => OUTER.test(groupOf(partOf(f))));
  const under = mesh.faces.map((_, f) => !isOuter[f] && /^(Skin|Top|Bottom|Leather|Buckle)$/.test(groupOf(partOf(f))) && !/^(cranium|jaw|eye|iris|pupil|lid|brow|ear|nostril|upperLip|mouth|hair|face|neck|hand|finger|thumb|palm|foot|toe|boot|sole|head)/i.test(partOf(f)));
  // (seen at the bind from any view: not covered)
  const seen = new Uint8Array(mesh.faces.length);
  for (const yaw of VIEWS) for (const id of raster(mesh.vertices, mesh.faces, yaw)) if (id >= 0) seen[id] = 1;
  const covered = under.map((u, f) => u && !seen[f]);
  const out = {};
  for (const [name, pose] of Object.entries(poses)) {
    const g = pose.gesture ? expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm({ cast: 'male', ...spec, gesture: pose.gesture })) }) : null;
    const nodes = rigNodesAt(R, g ? standPose(g.recipe, validateRig(g.recipe.rig)) || {} : pose).nodes;
    const V = skinLayered({ ...mesh, vertices: correctiveRest(mesh, m.recipe, nodes) }, skin, boneFrames(R, R.joints, nodes));
    let px = 0; const by = {}; const SEAM = /^(torso|pelvis|upperArm|foreArm|skinTop|skinBottom|belt|bottom_pelvis)/;
    for (const yaw of VIEWS) for (const id of raster(V, mesh.faces, yaw)) if (id >= 0 && covered[id] && SEAM.test(partOf(id))) { px++; const p = partOf(id); by[p] = (by[p] ?? 0) + 1; }
    out[name] = { px, by: Object.fromEntries(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6)) };
  }
  return { faces: mesh.faces.length, covered: covered.filter(Boolean).length, out };
}

const LUCIEN = { form: 'realistic', hair: 'none', outfit: { type: 'outfit', style: 'casual', dials: { fit: 0.32 }, language: {
  top: { family: 'knit', sleeve: 'short', fit: 'skin' }, bottom: { family: 'woven', leg: 'long', cut: 'tapered' },
  outer: { family: 'woven', sleeve: 'long', hem: 'hip', open: true }, feet: 'boots' } } };
const POSES = {
  overhead: { support: 'L', crouch: 0.25, pelvis: -15, spine: { twist: ['right', 0.6], curl: 0.15 }, hinge: 10, hipR: { yaw: -4, pitch: 30, roll: 0 }, kneeR: 70, shR: { yaw: 10, pitch: 160, roll: -10 }, elbowR: 40, shL: { yaw: -20, pitch: 40, roll: 30 }, elbowL: 90 },
  guard: 'guard',
};
describe("the cloth carries the skin's correctives", () => {
  it('a raised arm shows under half as much of what the coat covers under laws 17 as under 16; a guard the same', { timeout: 1_800_000 }, () => {
    const P = { overhead: { gesture: POSES.overhead }, guard: { gesture: POSES.guard } };
    const at = (laws) => exposure({ ...LUCIEN, physique: { from: 'athletic', laws } }, P).out;
    const before = at(16), now = at(17);
    expect(before.overhead.px).toBeGreaterThan(1000);
    expect(now.overhead.px).toBeLessThan(before.overhead.px * 0.5);
    expect(Math.abs(now.guard.px - before.guard.px)).toBeLessThan(before.guard.px * 0.1 + 20);
  });
});
