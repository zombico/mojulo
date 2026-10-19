import { describe, it, expect } from 'vitest';
import { oozeBody, rigSpecies, oozeMotion } from './rig.js';
import { faunaSkeleton } from '../fauna/skeleton.js';
import { motionGaits, motionBehaviors, withMotion, faunaBones } from '../fauna/rig.js';
import { gaitFrames } from '../fauna/gait.js';
import { isBody, bodySpecies } from '../fauna/body.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { bindLayered } from '../polygonizer/station-loft-rig.js';
import { wearWings } from '../fauna/wing.js';
import { speciesParams, speciesPlan } from '../fauna/species.js';
import { PER_RIG } from '../fauna/test-cases.js';

// The oozed rig, read on one quadruped chosen in code: its skeleton follows the body it was given, its grafts grow
// bones and move, and a stored motion rebuilds the same body from the recipe alone.
const id = PER_RIG[0], gait = motionGaits(id)[0];
const CHIMERA = { ooze: ['dire'], stylism: { register: 'mythic', chimera: 'chimera' } };

describe('the oozed rig', () => {
  it('the rig law: a grown creature\'s skeleton is its species\' at its size, its clips the same turns at that size', () => {
    const B = oozeBody(id, { ooze: [{ id: 'dire', strength: 1 }] }), s = B.mutagen.form.scale;
    const A = faunaSkeleton(id), S = faunaSkeleton(B.rid);
    expect(S.bones.map((b) => b.id)).toEqual(A.bones.map((b) => b.id));
    // every bone grown by the form's scale; the head bone's tip by its own (the dire grows the head on purpose)
    for (const [i, b] of S.bones.entries()) for (const k of ['head', 'tail']) if (!(b.id === 'head' && k === 'tail')) b[k].forEach((x, a) => expect(Math.abs(x - s * A.bones[i][k][a]), `${b.id}.${k}`).toBeLessThan(2e-3 * s));
    const [f0] = gaitFrames(id, gait, 8), [g0] = gaitFrames(B.rid, gait, 8);
    for (const b of A.bones) { f0.bones[b.id].m.flat().forEach((x, k) => expect(Math.abs(x - g0.bones[b.id].m.flat()[k]), b.id).toBeLessThan(0.02)); }
  });

  it('a body is registered under a rig id of its own; a species reads as itself', () => {
    const B = oozeBody(id, CHIMERA);
    expect(B.rid).toMatch(new RegExp(`^${id}~`));
    expect(isBody(B.rid)).toBe(true);
    expect(bodySpecies(B.rid)).toBe(id);
    expect(isBody(id)).toBe(false);
    expect(oozeBody(id, {}).rid).toBe(id);   // nothing acts: the species itself
  });

  it('a grafted tail grows bones of its own and swings', () => {
    const B = oozeBody(id, CHIMERA), S = faunaSkeleton(B.rid), tail = S.bones.filter((b) => /^tail\d+$/.test(b.id));
    expect(tail.length).toBeGreaterThanOrEqual(5);
    const xs = gaitFrames(B.rid, gait, 12).map((f) => f.bones[tail.at(-1).id].tail[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.01);
  });

  it('grafted wings grow wing bones and fly: the wing beats in the fly clip, rides the shoulders on the ground', () => {
    const B = oozeBody(id, CHIMERA), S = faunaSkeleton(B.rid), wing = S.bones.find((b) => b.role === 'wing.humerus' && b.id.endsWith('R'));
    expect(wing).toBeDefined();
    expect(motionGaits(B.rid)).toEqual(expect.arrayContaining(['fly', 'glide']));
    expect(motionGaits(id)).not.toContain('fly');
    const tipZ = (g) => gaitFrames(B.rid, g, 8).map((f) => f.bones[wing.id].tail[2]);
    const fly = tipZ('fly'); expect(Math.max(...fly) - Math.min(...fly)).toBeGreaterThan(0.05);
    expect(motionBehaviors(B.rid).length).toBeGreaterThan(0);
  });

  it('an articulated wing weighs its points to the wing bones; an ordinary one rides its root whole', () => {
    const B = oozeBody(id, CHIMERA), R = expandPlan(withMotion(B.plan, B.rid, [gait], 8)), mesh = compileLayered(R, {}, {}), Bo = faunaBones(B.rid), skin = bindLayered(mesh, R, Bo);
    const on = new Set(mesh.provenance.map((p, i) => (/^wingR$/.test(p.part) ? Bo.bones[skin.dominant[i]].id : null)).filter(Boolean));
    expect(on.size).toBeGreaterThan(2);
    const plain = { ...speciesParams(id) }, plan = speciesPlan(id);
    plan.joints.wingRoot = [0.05, 0, plan.joints.neckBase[2]];
    const worn = wearWings(structuredClone(plan), { wing: B.report.params.wings.wing, at: 'wingRoot' });
    expect(worn.include.find((i) => i.name === 'wings').parts.wingR.boneWeights).toBeUndefined();
    expect(plain.wings).toBeUndefined();
  });

  it('an ooze\'s ornaments are rigid: each rides the bone at its root', () => {
    const S = faunaSkeleton(oozeBody(id, CHIMERA).rid);
    const orn = Object.entries(S.bind).filter(([k]) => /^ooze/.test(k) && !/R$/.test(k));
    expect(orn.length).toBeGreaterThan(0);
    for (const [k, b] of orn) expect(typeof b === 'string' || b.from === b.to, k).toBe(true);
  });

  it('a stored motion carries its species and its spec, and rebuilds the same body', () => {
    const B = oozeBody(id, CHIMERA), m = oozeMotion({ species: B.rid, gaits: [gait], keys: 8 }, id, { oozes: B.mutagen.oozes, seed: B.mutagen.seed, stylism: CHIMERA.stylism });
    expect(m.species).toBe(id);
    expect(rigSpecies(m)).toBe(B.rid);
    expect(rigSpecies({ species: id, gaits: [gait] })).toBe(id);
  });
});
