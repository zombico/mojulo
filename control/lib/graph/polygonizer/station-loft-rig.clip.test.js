// A keyed clip PLAYS its keys (station-loft-rig.js layeredClip, the path every packed and exported clip takes): sampled
// at a key, the posed rig is the key's own. Two channels had been lost on the way: a `feet` target (an array, blended
// into an object the rig reads as no target, so a keyed gait's feet never stepped once played) and the waist (resolved
// to the raw `bend`, which the second resolve dropped: on all fours the chest rose and the paws left the floor).
import { describe, it, expect } from 'vitest';
import { validateRig, rigNodesAt, layeredClip } from './station-loft-rig.js';
import { expandPlan } from './station-loft-plan.js';
import { resolvePose } from './figure-posing.js';
import { rollMascot } from '../egocube/mascot.js';
import { mascotPlanFromSheet } from '../egocube/mascot-form.js';

const plan = mascotPlanFromSheet(rollMascot({ brief: 'raccoon' })).create.spec.plan, R = validateRig(expandPlan(plan).rig);
const far = (a, b) => Math.max(...Object.keys(a).map((n) => Math.hypot(a[n][0] - b[n][0], a[n][1] - b[n][1], a[n][2] - b[n][2])));

describe('a keyed clip plays its keys', () => {
  it('the walk\'s feet step: sampled at each key, the toes stand where the key puts them', () => {
    const keys = plan.clips.walk, fn = layeredClip(keys, R);
    expect(keys.every((k) => Array.isArray(k.feet?.R))).toBe(true);
    keys.forEach((k, i) => expect(far(rigNodesAt(R, k).nodes, rigNodesAt(R, fn(i / keys.length)).nodes), `key ${i}`).toBeLessThan(1e-6));
    // (between two keys a target is blended as a point: still an array, between the two)
    const mid = fn(0.5 / keys.length).feet.R;
    expect(Array.isArray(mid)).toBe(true);
    for (let a = 0; a < 3; a++) expect(mid[a]).toBeCloseTo((keys[0].feet.R[a] + keys[1].feet.R[a]) / 2, 6);
  });

  it('a key with a target against one without holds the target', () => {
    const fn = layeredClip([{ feet: { R: [0.1, 0.2, 0] } }, { sink: 0.01 }], R);
    expect(fn(0.4).feet.R).toEqual([0.1, 0.2, 0]);
  });

  it('the waist survives a second resolve (the raw bend flows through)', () => {
    expect(resolvePose(resolvePose({ waist: 20 })).bend).toBe(-20);
    const k = { hinge: 60, waist: 20, crouch: 0.3 }, fn = layeredClip([k, k], R);
    expect(far(rigNodesAt(R, k).nodes, rigNodesAt(R, fn(0)).nodes)).toBeLessThan(1e-6);
  });
});
