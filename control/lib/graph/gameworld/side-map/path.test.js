// The path, designed from the top down (side-map/path.js), considered and never scattered. The concepts: a run's steps
// are all one height, its module (a stair's are); every change stands on the run's bay grid, at a pillar or a seam (a
// block centred on its seam), the grid the back wall's pillars and seams stand on; each profile its pattern (the basics
// rolling up and down, a fight a raised block on each seam, a landing one rise, a boss's floor none); no change at a
// pit's lip or on a dash's runway; the height inside the frame the camera holds; toward a climb it rises, toward a drop
// it falls; the same run the same path; a long run laid smooth loses `varied`.
import { describe, it, expect } from 'vitest';
import { shapeRun, bayGrid } from './path.js';
import { layoutSideMap } from './layout.js';
import { dressSideMap } from './dress.js';
import { sideMapLaws } from './laws.js';
import { reachOf } from '../feel/reach.js';
import { readFeel } from '../feel/lower.js';

const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true })), W = 23.75, H = 13.36, J = 1.6;
const run = (role, { toward = 0, length = 4 * W, gaps = [] } = {}) => shapeRun([{ s0: 0, s1: length, z: 0 }], { role, toward, W, H, J, gaps, length });
const net = (R) => R.steps.reduce((a, x) => a + x.dz, 0);

describe('the path, designed from the top down', () => {
  it('a run\'s steps are all one height, each on the bay grid: at a pillar, a seam, or a block\'s edge round a seam', () => {
    for (const role of ['basic', 'gauntlet', 'meet']) {
      const R = run(role), G = bayGrid(4 * W, W), hs = new Set(R.steps.map((x) => Math.abs(x.dz)));
      expect(hs.size).toBe(1);
      const on = (s) => [...Array(G.n * 2 + 1).keys()].some((k) => Math.abs(s - (k * G.width) / 2) < 1e-2) || [...Array(G.n).keys()].some((k) => Math.abs(Math.abs(s - (k + 0.5) * G.width) - G.width / 6) < 1e-2);
      for (const x of R.steps) expect(on(x.s), `${role} ${x.s}`).toBe(true);
    }
  });
  it('a pattern a profile: the basics roll, a fight a block on each seam, a landing rises once, a boss\'s floor none', () => {
    const b = run('basic').steps.map((x) => Math.sign(x.dz));
    expect(b.slice(0, 4)).toEqual([1, -1, 1, -1]);
    const m = run('meet').steps;
    expect(m.length).toBe(2 * bayGrid(4 * W, W).n);
    expect(run('landing').steps).toHaveLength(1);
    expect(run('boss').steps).toEqual([]);
  });
  it('no change at a pit\'s lip or on a dash\'s runway; the height inside the frame the camera holds', () => {
    const gaps = [{ s0: 30, s1: 33, teaches: 'run' }, { s0: 60, s1: 65, teaches: 'dash' }];
    for (const x of run('gauntlet', { gaps }).steps) { expect(x.s < 26 || x.s > 37).toBe(true); expect(x.s < 53 || x.s > 69).toBe(true); }
    for (const toward of [-1, 0, 1]) { let z = 0; for (const x of run('gauntlet', { toward, length: 8 * W }).steps) { z += x.dz; expect(z).toBeLessThanOrEqual(H / 4 + 1e-6); expect(z).toBeGreaterThanOrEqual(-H / 6 - 1e-6); } }
  });
  it('toward a climb it rises, toward a drop it falls; a block gives the floor its height back', () => {
    expect(net(run('basic', { toward: 1 }))).toBeGreaterThan(0);
    expect(net(run('basic', { toward: -1 }))).toBeLessThan(0);
    const R = run('meet');
    expect(net(R)).toBeCloseTo(0, 6);
    expect(R.floors.at(-1).z).toBeCloseTo(0, 6);
  });
  it('the same run the same path; the dress\'s pillars on the path\'s grid; a long run laid smooth loses `varied`', () => {
    expect(JSON.stringify(run('basic'))).toBe(JSON.stringify(run('basic')));
    const map = { zones: [{ run: 'across', screens: 4, beat: 'rest' }, { run: 'across', screens: 4, teach: 'meet' }] }, L = layoutSideMap(map, { reach, stature: 1.67 }), D = dressSideMap(L, map);
    const Z = L.zones[0], G = bayGrid(Z.rect[1] - Z.rect[0], W);
    expect(D.zones[0].pillars).toEqual(Array.from({ length: G.n - 1 }, (_, k) => Math.round((Z.rect[0] + (k + 1) * G.width) * 1000) / 1000));
    expect(sideMapLaws(L, reach).find((l) => l.id === 'varied').holds).toBe(true);
    expect(sideMapLaws({ ...L, steps: [] }, reach).find((l) => l.id === 'varied').holds).toBe(false);
  });
});
