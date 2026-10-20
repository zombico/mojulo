// body-relational.test.js — the form field's slice: the torso, the neck, the pelvis and the limbs re-sampled onto a build's field
// close, stand on the field's skin, keep the midline and the mirror, still pose by the rig, and come out the same
// twice. Each build is its own procedure (norrin the plain field; shalla the bust and the raised rays under it).
import { describe, it, expect } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered } from './station-loft-rig.js';
import { BODY_BUILDS, PHYSIQUES, formSlice, ringSlots, physique, bodyField, limbField, bodyFrame, crossing } from './body-relational.js';

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
    }, 300_000);   // (shalla's pauldron resamples her denser torso three more times)
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
  }, 480_000);   // (two shalla slices, each with her pauldron's stages)

  it('a physique dials the build: athletic is the build itself, weight the waist, bulk the arm, tone the blends, height the stature', () => {
    expect(physique('norrin', 'athletic')).toBe(BODY_BUILDS.norrin);
    expect(physique('norrin', { bulk: 0, tone: 0, weight: 0, height: 0 })).toBe(BODY_BUILDS.norrin);
    expect(() => physique('norrin', 'brawny')).toThrow(/unknown physique 'brawny'/);
    expect(() => physique('norrin', { bulk: 2 })).toThrow(/outside/);
    expect(() => physique('norrin', { girth: 1 })).toThrow(/not a physique dial/);
    expect(physique('norrin', { from: 'jacked', height: 0 }).physique).toEqual({ ...PHYSIQUES.jacked, height: 0 });
    // on the rig the build is minted under (its tune: the stature, the shoulders)
    const on = (B) => { const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', hair: 'none', tune: B.tune }) }); return validateRig(m.recipe.rig); };
    const waist = (B) => { const R = on(B), F = bodyFrame(R, B), c = crossing(bodyField(R, B).sd, [0, 0, F.zOf(-0.02)], [0, 1, 0], 0.5); return c[1]; };
    const arm = (B) => { const R = on(B), J = R.joints, mid = J.shoulderR.map((x, i) => x + 0.55 * (J.elbowR[i] - x)), c = crossing(limbField(R, B, 'upperArm').sd, mid, [0, 1, 0], 0.2); return c[1] - mid[1]; };
    const lean = physique('norrin', { weight: -1 }), heavy = physique('norrin', { weight: 1 }), N = BODY_BUILDS.norrin;
    expect(waist(heavy)).toBeGreaterThan(waist(N) + 0.03);
    expect(waist(lean)).toBeLessThan(waist(N));
    expect(arm(physique('norrin', { bulk: 1 }))).toBeGreaterThan(arm(N) * 1.1);
    expect(arm(physique('norrin', { bulk: -1 }))).toBeLessThan(arm(N));
    expect(physique('norrin', { tone: 1 }).kMuscle).toBeLessThan(N.kMuscle);
    expect(physique('norrin', { tone: -1 }).kLimb).toBeGreaterThan(N.kLimb);
    expect(on(physique('norrin', { height: 1 })).joints.headTop[2]).toBeGreaterThan(on(N).joints.headTop[2] * 1.05);
  }, 120_000);

  it('a physique\'s slice closes as the build\'s does (jacked: the bulk over every part, the hands scaled about the wrist)', () => {
    const B = physique('norrin', 'jacked'), m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', hair: 'none', tune: B.tune }) });
    const { recipe } = formSlice(m.recipe, validateRig(m.recipe.rig), B), A = auditLayered(compileLayered(recipe, m.dials));
    for (const p of SLICED) { expect(A[p].pass, p).toBe(true); expect(A[p].windingErrors, p).toBe(0); }
    const span = (Rg) => Math.hypot(...[0, 1, 2].map((k) => Rg.joints.middleTipR[k] - Rg.joints.wristR[k]));
    expect(span(validateRig(recipe.rig)) / span(validateRig(m.recipe.rig))).toBeCloseTo(B.hands, 4);
  }, 300_000);
});
