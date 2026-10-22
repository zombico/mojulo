// station-loft-rig.grip.test.js — the GRIP HELD AT REST (a padded glove's: lib/graph/handwear, a boxing glove's fist): the
// hand's joints turned into the hand word at rest, as the rig's own pose would turn them, and the parts riding the digits'
// bones with them; the palm and the rest of the body untouched; no grip, nothing. One authored hero (the procedure is one).
import { describe, it, expect } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { validateRig, rigNodesAt, holdGrip } from './station-loft-rig.js';

const recipe = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female' }) }).recipe;
const R0 = validateRig(recipe.rig);

describe('the grip held at rest', () => {
  it('the joints rest where the rig\'s own pose would put them; the digits\' parts turn with them, the palm does not', () => {
    const H = holdGrip(recipe.rig, recipe.parts, { R: 'fist' }), R1 = validateRig(H.rig), posed = rigNodesAt(R0, { fingersR: 'fist' }).nodes;
    for (const j of ['indexTipR', 'thumbTipR', 'littleDipR']) for (let q = 0; q < 3; q++) expect(R1.joints[j][q]).toBeCloseTo(posed[j][q], 5);
    // (the left hand, the wrist and the knuckles stay; the right index's pad moves with its tip, the palm's rings do not)
    for (const j of ['indexTipL', 'wristR', 'knucklesR']) expect(R1.joints[j]).toEqual(R0.joints[j]);
    expect(H.parts.indexR).toBeTruthy();
    expect(H.parts.indexL).toBeUndefined();
    const pad = (P) => P.stations[P.stations.length - 1].points.front;
    expect(Math.hypot(...pad(H.parts.indexR).map((x, q) => x - R1.joints.indexTipR[q]))).toBeLessThan(Math.hypot(...pad(recipe.parts.indexR).map((x, q) => x - R1.joints.indexTipR[q])));
    expect(H.parts.torso).toBeUndefined();
  });

  it('no grip, nothing moves; a held rig still validates and poses', () => {
    const H = holdGrip(recipe.rig, recipe.parts, {});
    expect(H.parts).toEqual({});
    expect(H.rig.joints).toEqual(recipe.rig.joints);
    const R1 = validateRig(holdGrip(recipe.rig, recipe.parts, { R: 'fist', L: 'fist' }).rig);
    expect(() => rigNodesAt(R1, { fingersR: 'open' })).not.toThrow();
  });
});
