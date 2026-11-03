// hero-box: a boxer's arced punches at the door, each space boxer's strike at its own target from the guard. The concepts
// on one rig: a punch lands its knuckles on its target along its approach, within the servos and balanced, starting and
// ending on the guard; the rear hand throws the uppercut; the mirror is exact; the seconds asked stretch its timing;
// the door's motion takes the words.
import { describe, it, expect } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroBox, BOX_STRIKES, BOX_NAMES } from './hero-box.js';
import { heroStance } from './hero-stance.js';
import { MOTION_GAITS, motionPlan } from './hero-motion.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male' }) }).recipe.rig);
const close = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

describe('hero-box', () => {
  it('lands the lead hook on its target from the guard, within the servos, balanced, and comes home', () => {
    const K = heroBox('hook', R);
    expect(K.hand).toBe(BOX_STRIKES.hook.hand);
    expect(K.family).toBe('hook');
    expect(Object.values(K.checks.laws).every(Boolean)).toBe(true);
    expect(K.checks.contact).toBeLessThan(0.002);
    const guard = heroStance('guard', R).clip.fn(1), n0 = rigNodesAt(R, K.clip.fn(0)).nodes, n1 = rigNodesAt(R, K.clip.fn(1)).nodes, g = rigNodesAt(R, guard).nodes;
    expect(Math.hypot(...[0, 1, 2].map((i) => n0.wristR[i] - n1.wristR[i]))).toBeLessThan(1e-6);
    expect(Math.hypot(...[0, 1, 2].map((i) => n1.pelvisHub[i] - g.pelvisHub[i]))).toBeLessThan(0.01);
    // (the knuckles out at contact: the wrist at the contact moment farther from the shoulder than in the guard)
    const nc = rigNodesAt(R, K.clip.fn(K.contact.t / K.seconds)).nodes, d = (n) => Math.hypot(...[0, 1, 2].map((i) => n.wristR[i] - n.shoulderR[i]));
    expect(d(nc)).toBeGreaterThan(d(n0) + 0.1);
  }, 120000);
  it('throws the uppercut with the rear hand, mirrors exactly, and stretches to the seconds asked', () => {
    const U = heroBox('uppercut', R);
    expect(U.hand).toBe('L');
    expect(Object.values(U.checks.laws).every(Boolean)).toBe(true);
    const M = heroBox('uppercutLeft', R);
    expect(M.hand).toBe('R');
    expect(close(M.contact.at, [-U.contact.at[0], U.contact.at[1], U.contact.at[2]])).toBe(true);
    const S = heroBox('uppercut', R, { seconds: 2 * U.seconds });
    expect(S.seconds).toBeCloseTo(2 * U.seconds, 3);
    expect(S.contact.t).toBeCloseTo(2 * U.contact.t, 3);
  }, 120000);
  it('is a move of the door\'s motion, each word and its mirror', () => {
    for (const n of BOX_NAMES) expect(MOTION_GAITS[n]).toMatchObject({ motion: 'move', family: 'box' });
    expect(motionPlan({ hook: true, uppercut: { seconds: 0.5 } })).toEqual({ hook: { move: 'box', seconds: null }, uppercut: { move: 'box', seconds: 0.5 } });
  });
});
