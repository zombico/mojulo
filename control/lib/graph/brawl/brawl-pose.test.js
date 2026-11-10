import { describe, it, expect } from 'vitest';
import { brawlPoseOf } from './brawl-pose.js';
import { brawlFighter } from './brawl-moves.js';
import { rigJoints } from '../versus/versus-rig.js';
import { solveFighter } from '../versus/versus-solver.js';

// A BRAWL BODY'S POSE: a move's frame, a reaction the fight's, the brawl's own states their own; each one jointed by the
// fight's rig into numbers (never NaN), so the page can stand it in the round.
const F = brawlFighter({ ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' });
const body = (o) => ({ id: 0, x: 0, z: 0, y: 0, face: 1, st: 'stand', sf: 3, mv: null, mf: 0, wx: 0, wz: 0, stun: 6, ...o });
const finite = (J) => Object.values(J).every((v) => v.every(Number.isFinite));

describe('brawl pose', () => {
  it('a move plays its frame\'s pose', () => {
    const m = F.moves['chain.1'];
    expect(brawlPoseOf(body({ st: 'move', mv: 'chain.1', mf: m.startup }), F)).toBe(m.frames[m.startup].pose);
  });
  it('every state of the brawl stands as numbers', () => {
    for (const st of ['stand', 'walk', 'prejump', 'air', 'land', 'pick', 'hold', 'held', 'throwing', 'hit', 'fall', 'down', 'rise', 'ko']) {
      const pose = brawlPoseOf(body({ st, wx: 1, kf: st === 'hold' ? 5 : 0, rx: { k: 'hit', h: 1, w: 1, c: 0 }, y: st === 'fall' ? 400 : 0 }), F, 30, { down: 36, rise: 10 });
      expect(finite(rigJoints(F.body, pose)), st).toBe(true);
    }
  });
  it('a knee in the clinch drives the lead leg up', () => {
    const still = brawlPoseOf(body({ st: 'hold', kf: 0 }), F), knee = brawlPoseOf(body({ st: 'hold', kf: 8 }), F, 0, { kneeFrames: 10 });
    expect(knee.legF[0]).toBeGreaterThan(still.legF?.[0] ?? 0);
  });
});
