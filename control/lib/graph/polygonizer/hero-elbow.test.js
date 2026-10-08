// hero-elbow — ELBOWS DOWN on real hero rigs: a bent arm raised anywhere forward folds its forearm up with the elbow
// beneath it (never sideways across the chest), the roll moves smoothly as the arm rises, and a hanging or back-swung
// arm is left as it was.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { elbowDownRoll, elbowsDown } from './hero-elbow.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const rigOf = (hero) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(hero) }).recipe.rig);
const HEROES = { female: rigOf({ cast: 'female', head: 'anime' }), male: rigOf({ cast: 'male', head: 'anime' }), bare: rigOf({ cast: 'male' }) };

describe('hero-elbow', () => {
  for (const [name, R] of Object.entries(HEROES)) it(`${name}: a raised bent arm folds up with the elbow beneath, on both sides`, () => {
    for (const S of ['L', 'R']) for (const pitch of [60, 75, 90, 110, 130]) for (const elbow of [50, 90]) {
      const pose = elbowsDown(R, { support: 'none', [`sh${S}`]: { pitch }, [`elbow${S}`]: elbow });
      const n = rigNodesAt(R, pose).nodes;
      expect(n[`wrist${S}`][2]).toBeGreaterThan(n[`elbow${S}`][2]);   // the forearm rises from the elbow
      // and, up to the roll's reach (~100° of raise), folds in the arm's own plane: the wrist stays outside the shoulder
      // line, never across the chest (the chicken wing). Past it the roll runs out: arms that high are posed near straight.
      if (pitch <= 100) expect(Math.abs(n[`wrist${S}`][0])).toBeGreaterThan(Math.abs(n[`shoulder${S}`][0]) - 0.02);
    }
  });
  it('the roll moves smoothly with the raise, mirrored left and right; hanging and back-swung arms keep theirs', () => {
    const R = HEROES.female;
    for (let p = 0; p < 180; p += 1) { expect(Math.abs(elbowDownRoll(R, 'L', p + 1) - elbowDownRoll(R, 'L', p))).toBeLessThan(6); expect(elbowDownRoll(R, 'R', p)).toBeCloseTo(-elbowDownRoll(R, 'L', p), 6); }
    for (const p of [-60, -20, 0]) expect(elbowDownRoll(R, 'L', p)).toBe(0);
    const pose = { kneeL: 20 }; expect(elbowsDown(R, pose)).toBe(pose);
  });
});
