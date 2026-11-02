// throw-sticks (deep) — the baked module is what the solver bakes now: a change to the throws, the grips, the arm's
// solver or the rig that moves a throw moves its sticks, and the module is baked again (node scripts/throw-sticks.mjs).
import { describe, expect, it } from 'vitest';
import { validateRig } from '../polygonizer/station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { bakeThrowSticks, BAKE_HERO, STICK_JOINTS, FRAME } from '../polygonizer/hero-throw-bake.js';
import { THROW_STICKS, THROW_STICK_JOINTS, THROW_STICK_FRAME } from './throw-sticks.data.js';

describe('throw-sticks bake', () => {
  it('the module is fresh', () => {
    const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 'throws', hero: heroRecord(BAKE_HERO) }).recipe.rig);
    expect([...THROW_STICK_JOINTS]).toEqual([...STICK_JOINTS]); expect(THROW_STICK_FRAME).toBe(FRAME);
    expect(JSON.parse(JSON.stringify(bakeThrowSticks(R))), 'stale: node scripts/throw-sticks.mjs').toEqual(THROW_STICKS);
  }, 1800000);
});
