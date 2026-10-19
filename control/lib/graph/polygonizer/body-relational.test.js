// body-relational.test.js — the form field's slice: the torso, the neck, the pelvis and the limbs re-sampled onto a build's field
// close, stand on the field's skin, keep the midline and the mirror, still pose by the rig, and come out the same
// twice. Each build is its own procedure (norrin the plain field; shalla the bust and the raised rays under it).
import { describe, it, expect } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered } from './station-loft-rig.js';
import { BODY_BUILDS, formSlice, ringSlots } from './body-relational.js';

const CASTS = { norrin: 'male', shalla: 'female' };
const slice = (build) => {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: CASTS[build], hair: 'none', ...(BODY_BUILDS[build].tune ? { tune: BODY_BUILDS[build].tune } : {}) }) });
  const R = validateRig(m.recipe.rig);
  return { m, R, ...formSlice(m.recipe, R, build) };
};
const SLICED = ['torso', 'neck', 'pelvis', 'upperArmR', 'upperArmL', 'foreArmR', 'foreArmL', 'thighR', 'thighL', 'shankR', 'shankL'];

describe('the form field slice', () => {
  for (const build of Object.keys(BODY_BUILDS)) {
    it(`${build}: every re-sampled part closes, denser than authored; the pectoral and bust parts give way to the field`, () => {
      const { m, recipe, removed } = slice(build);
      const A = auditLayered(compileLayered(recipe, m.dials));
      for (const p of SLICED) { expect(A[p].pass, p).toBe(true); expect(A[p].windingErrors, p).toBe(0); }
      // every re-sampled part encloses its volume outward (a ring wrapped backward, or a pole behind its ring, turned
      // the thigh inside out while the audit's edges still closed)
      const mesh = compileLayered(recipe, m.dials), vol = (part) => mesh.faces.reduce((v, t) => { if (mesh.provenance[t[0]].part !== part) return v; const [a, b, c] = t.map((i) => mesh.vertices[i]); return v + (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6; }, 0);
      for (const p of SLICED) expect(vol(p), p).toBeGreaterThan(0);
      expect(recipe.parts.torso.slots.length).toBeGreaterThan(m.recipe.parts.torso.slots.length);
      expect(recipe.parts.torso.stations.length).toBeGreaterThan(m.recipe.parts.torso.stations.length);
      expect(removed.length).toBeGreaterThan(0);
      for (const k of removed) expect(recipe.parts[k]).toBeUndefined();
    }, 120_000);
  }

  it('the cage stands on the field, the midline on x = 0, the left the right\'s mirror', () => {
    const { recipe, field } = slice('norrin');
    const T = recipe.parts.torso, top = T.stations.filter((s) => s.u >= 1);
    for (const s of top) for (const sl of T.slots) expect(Math.abs(field.sd(s.points[sl])), `${s.id}.${sl}`).toBeLessThan(2e-3);
    for (const s of T.stations) {
      expect(s.points.front[0]).toBe(0); expect(s.points.back[0]).toBe(0);
      for (const sl of T.slots.filter((x) => x.endsWith('R'))) { const r = s.points[sl], l = s.points[`${sl.slice(0, -1)}L`]; expect(l).toEqual([-r[0], r[1], r[2]]); }
    }
    const aR = recipe.parts.upperArmR, aL = recipe.parts.upperArmL;
    expect(aL.slots).toEqual(aR.slots);
    const sw = (k) => k.replace(/[RL]$/, (c) => (c === 'R' ? 'L' : 'R'));
    for (const [i, s] of aR.stations.entries()) for (const sl of aR.slots) expect(aL.stations[i].points[sw(sl)]).toEqual([-s.points[sl][0], s.points[sl][1], s.points[sl][2]]);
    expect(ringSlots(8)).toEqual(['front', 's01R', 's02R', 's03R', 'back', 's03L', 's02L', 's01L']);
  }, 120_000);

  it('the rig poses it: the bind is the rest, a bent elbow moves that forearm and leaves the torso where it was', () => {
    // (on the slice's own rig: it adds the hinges' crease bones)
    const { m, recipe } = slice('norrin'), R = validateRig(recipe.rig);
    expect(R.bones.some((b) => b.id === 'kneeCreaseR')).toBe(true);
    const mesh = compileLayered(recipe, m.dials), skin = bindLayered(mesh, recipe, R);
    const rest = skinLayered(mesh, skin, boneFrames(R, R.joints, R.joints));
    rest.forEach((v, i) => expect(Math.hypot(v[0] - mesh.vertices[i][0], v[1] - mesh.vertices[i][1], v[2] - mesh.vertices[i][2])).toBeLessThan(1e-9));
    const bent = skinLayered(mesh, skin, boneFrames(R, R.joints, rigNodesAt(R, { elbowR: 90 }).nodes));
    const moved = (re) => Math.max(...mesh.vertices.map((v, i) => (re.test(mesh.provenance[i].part) ? Math.hypot(...[0, 1, 2].map((k) => bent[i][k] - v[k])) : 0)));
    expect(moved(/^foreArmR$/)).toBeGreaterThan(0.1);
    expect(moved(/^torso$/)).toBeLessThan(1e-9);
  }, 120_000);

  it('is deterministic, and an unknown build is named', () => {
    expect(JSON.stringify(slice('shalla').recipe)).toBe(JSON.stringify(slice('shalla').recipe));
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male' }) });
    expect(() => formSlice(m.recipe, validateRig(m.recipe.rig), 'galactus')).toThrow(/unknown build 'galactus'/);
  }, 120_000);
});
