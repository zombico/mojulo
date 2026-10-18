// A cast's mascot takes a blow: its flinch, fall and rise are one-shots on its own rig (mascot-form.js `reactions`);
// the fall tips it over its feet onto its back, its head on the floor, and the rise brings it home to the stand. Every
// other mascot is minted as it was.
import { describe, it, expect } from 'vitest';
import { rollMascot } from './mascot.js';
import { mascotPlanFromSheet } from './mascot-form.js';
import { rollStored, egocubeCreate } from './kind.js';
import { validateRig, rigNodesAt, layeredClip } from '../polygonizer/station-loft-rig.js';
import { expandLayeredManifest } from '../../mcp/tools/layered.js';

describe('a mascot takes a blow', () => {
  const sheet = rollMascot({ brief: 'a sonic-like mascot', seed: 3 });

  it('only when asked: a mascot minted plainly has no reaction clips', () => {
    const plain = mascotPlanFromSheet(sheet).create.spec.plan, reacting = mascotPlanFromSheet(sheet, { reactions: true }).create.spec.plan;
    expect(Object.keys(plain.clips)).not.toContain('flinch');
    expect(reacting.clips).toMatchObject({ flinch: { once: true }, fall: { once: true }, rise: { once: true } });
    const { flinch: _f, fall: _a, rise: _r, ...rest } = reacting.clips;
    expect(JSON.stringify(rest)).toBe(JSON.stringify(plain.clips));
  });

  it('falls onto its back over its feet, the head on the floor, and rises home to the stand', () => {
    const plan = mascotPlanFromSheet(sheet, { reactions: true }).create.spec.plan;
    const R = validateRig(expandLayeredManifest({ kind: 'layered', plan }).recipe.rig);
    const at = (clip, t) => rigNodesAt(R, layeredClip(plan.clips[clip], R)(t)).nodes;
    const stand = at('fall', 0), down = at('fall', 1);
    expect(down.headTop[2]).toBeLessThan(stand.headTop[2] * 0.5);   // down
    expect(down.headTop[1]).toBeLessThan(stand.headTop[1] - 0.1);   // on its back, behind its feet
    expect(Math.min(...Object.values(down).map((p) => p[2]))).toBeGreaterThan(-0.05);   // not through the floor
    const risen = at('rise', 1);
    for (const k of ['headTop', 'pelvisHub']) for (let i = 0; i < 3; i++) expect(risen[k][i]).toBeCloseTo(stand[k][i], 3);
    expect(at('flinch', 0.4).headTop[2]).toBeLessThan(stand.headTop[2]);   // squashed down by the blow
  });

  it('a cast\'s mascot is made with them', () => {
    const S = rollStored({ kind: 'egocube', cast: { seed: 2, cast: { pet: { relation: 'familiar', body: 'mascot' } } } });
    expect(egocubeCreate(S, { member: 'hero/pet' }).create.spec.plan.clips.fall).toMatchObject({ once: true });
  });
});
