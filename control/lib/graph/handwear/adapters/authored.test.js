// authored.test.js — the AUTHORED body wears the handwear library's gloves through its own adapter: the same hand as the
// realistic body's, the cuff new rings sampled up its coarse forearm, their weights mixed from the forearm's rings and
// summing to one. One authored hero (the procedure is one): a glove word through the hero door, and a mitten's grip held.
import { describe, it, expect } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../../mcp/tools/layered.js';
import { validateRig, rigNodesAt } from '../../polygonizer/station-loft-rig.js';
import { authoredHand } from './authored.js';

const bare = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female' }) }).recipe;

describe('the authored body\'s gloves', () => {
  it('the cuff: rings sampled up the forearm from its share to the wrist, round, stood off, weights summing to one', () => {
    const A = authoredHand(bare, validateRig(bare.rig)), C = A.cuff({ cuff: 0.3, thick: 0.003 }, { id: 'g', group: 'Gloves' }).g_foreArmR, F = bare.parts.foreArmR;
    expect(C.stations.length).toBeGreaterThan(F.stations.filter((st) => st.u >= 1.4).length);
    expect(C.stations[0].u).toBeCloseTo(1.4, 6);
    expect(C.slots.length).toBeGreaterThan(F.slots.length);
    for (const w of Object.values(C.bind.blend)) { expect(Object.keys(w).length).toBeLessThanOrEqual(4); expect(Object.values(w).reduce((t, x) => t + x, 0)).toBeCloseTo(1, 9); }
  });

  it('a glove word is worn on the authored hands; a boxing glove holds the fist at rest and under a pose', () => {
    const W = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', outfit: ['workGloves'] }) }).recipe;
    for (const k of ['workGloves_handR', 'workGloves_indexL', 'workGloves_foreArmR', 'workGlovesPalm_handR']) expect(W.parts[k], k).toBeTruthy();
    const B = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', outfit: ['boxingGloves'] }) }).recipe, R = validateRig(B.rig);
    expect(B.parts.boxingGlovesMitten_handR).toBeTruthy();
    expect(R.held).toEqual(['R', 'L']);
    expect(rigNodesAt(R, { fingersR: 'open' }).nodes.indexTipR).toEqual(rigNodesAt(R, {}).nodes.indexTipR);
  });
});
