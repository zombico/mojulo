// The path, designed from the top down (side-map/path.js). The concepts: a run's profile comes from its role (the basics
// roll, a fight has a raised block, a landing rises once and stays flat, a boss's floor stays one floor); no feature
// stands at a pit's lip or on a dash's runway; the path's height stays inside the frame the camera holds; a run that
// leads to a climb rises and one that leads to a drop falls; a block gives the floor its height back; the same dice the
// same path; a long run laid smooth loses the `varied` law.
import { describe, it, expect } from 'vitest';
import { shapeRun, PATH_PROFILES } from './path.js';
import { layoutSideMap } from './layout.js';
import { sideMapLaws } from './laws.js';
import { streamOf } from '../../city/plan/dice.js';
import { reachOf } from '../feel/reach.js';
import { readFeel } from '../feel/lower.js';

const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true })), W = 23.75, H = 13.36, J = 1.6;
const run = (role, { toward = 0, length = 4 * W, gaps = [], key = 'a' } = {}) => shapeRun([{ s0: 0, s1: length, z: 0 }], { role, toward, W, H, J, gaps, dice: streamOf(1, 'path-test', key) });
const net = (R) => R.steps.reduce((a, x) => a + x.dz, 0);

describe('the path, designed from the top down', () => {
  it('a profile a role: the basics roll, a fight has a raised block, a landing rises once, a boss\'s floor stays one', () => {
    expect(run('basic').steps.length).toBeGreaterThan(2);
    const meet = run('meet').steps;
    expect(meet.some((x, k) => x.dz > 0 && meet[k + 1] && Math.abs(meet[k + 1].dz + x.dz) < 1e-6)).toBe(true);
    expect(run('landing').steps).toHaveLength(1);
    expect(run('boss').steps).toEqual([]);
    expect(Object.keys(PATH_PROFILES)).toContain('gauntlet');
  });
  it('no feature at a pit\'s lip or on a dash\'s runway', () => {
    const gaps = [{ s0: 30, s1: 33, teaches: 'run' }, { s0: 60, s1: 65, teaches: 'dash' }];
    const R = run('gauntlet', { gaps });
    for (const x of R.steps) { expect(x.s < 26 || x.s > 37).toBe(true); expect(x.s < 53 || x.s > 69).toBe(true); }
  });
  it('the path\'s height stays inside the frame the camera holds', () => {
    for (const key of ['a', 'b', 'c']) for (const toward of [-1, 0, 1]) {
      let z = 0; for (const x of run('gauntlet', { toward, key, length: 8 * W }).steps) { z += x.dz; expect(z).toBeLessThanOrEqual(H / 4 + 1e-6); expect(z).toBeGreaterThanOrEqual(-H / 6 - 1e-6); }
    }
  });
  it('toward a climb it rises, toward a drop it falls; a block gives the floor its height back', () => {
    expect(net(run('basic', { toward: 1 }))).toBeGreaterThan(0);
    expect(net(run('basic', { toward: -1 }))).toBeLessThan(0);
    const R = run('meet'), F = R.floors;
    expect(F.length).toBe(R.steps.length + 1);
    expect(F.at(-1).z).toBeCloseTo(net(R), 6);
  });
  it('the same dice, the same path; a long run laid smooth loses `varied`', () => {
    expect(JSON.stringify(run('basic'))).toBe(JSON.stringify(run('basic')));
    const L = layoutSideMap({ zones: [{ run: 'across', screens: 4, beat: 'rest' }, { run: 'across', screens: 4, teach: 'meet' }] }, { reach, stature: 1.67 });
    expect(sideMapLaws(L, reach).find((l) => l.id === 'varied').holds).toBe(true);
    expect(sideMapLaws({ ...L, steps: [] }, reach).find((l) => l.id === 'varied').holds).toBe(false);
  });
});
