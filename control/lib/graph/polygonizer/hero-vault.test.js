// hero-vault — clearing a low box out of the run, on a real hero rig: each move keeps every law (it plays out of the
// gait's own frame and back into it, nothing goes through the box or the floor, planted feet and hands hold, the
// take-off is a human one, the landing is past the far face, the lift off the parabolas stays small), its mirror takes
// off from the other foot, a flight is a parabola under g, and the free-run solver picks the move a box asks for, fits
// the strides to it from the frame the runner is in, and says why when none fits. (Every move across its band, both
// casts: hero-vault.deep.test.js.)
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroVault, freeRun, HIP_CONE } from './hero-vault.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female', head: 'anime' }) }).recipe.rig);
const hip = R.joints.pelvisHub[2];
const allTrue = (laws) => Object.fromEntries(Object.keys(laws).map((k) => [k, true]));
const CASES = [['hurdle', 0.5, 0.1, 'sprint'], ['stepVault', 0.8, 0.35, 'jog'], ['speedVault', 0.6, 0.2, 'sprint'], ['kongVault', 0.6, 0.8, 'sprint']];

describe('hero-vault', () => {
  for (const [name, r, d, from] of CASES) {
    it(`${name} over ${r} of the hip × ${d} m out of the ${from}: every law holds`, () => {
      const K = heroVault(name, R, { h: r * hip, d, from }), c = K.checks;
      expect(c.laws, JSON.stringify(c)).toEqual(allTrue(c.laws));
      expect(K.entry.takeoff).toBeGreaterThan(0.3); expect(K.exit.landing).toBeGreaterThan(0.15);
      expect(K.root.travel).toBeGreaterThan(1);
    }, 60000);
  }
  it('starts and ends on the gait\'s own frames, and the mirror takes off from the other foot', () => {
    const K = heroVault('speedVault', R, { h: 0.6 * hip, d: 0.2 }), M = heroVault('speedVaultLeft', R, { h: 0.6 * hip, d: 0.2 });
    expect(K.foot).toBe('L'); expect(M.foot).toBe('R'); expect(K.landing).toBe('R'); expect(M.landing).toBe('L');
    const a = rigNodesAt(R, K.fn(0)).nodes, b = rigNodesAt(R, M.fn(0)).nodes;
    // (the gait is symmetric: the mirror's first frame is the first frame mirrored)
    expect(Math.abs(a.toeBaseL[0] + b.toeBaseR[0])).toBeLessThan(0.01); expect(Math.abs(a.toeBaseL[1] - b.toeBaseR[1])).toBeLessThan(0.01);
    expect(Math.abs(K.entry.takeoff - M.entry.takeoff)).toBeLessThan(0.03);
  }, 60000);
  it('flies a parabola: the take-off speed gives the flight\'s own rise and fall under g', () => {
    const K = heroVault('hurdle', R, { h: 0.5 * hip, d: 0.1, from: 'sprint' }), A = K.air[0];
    expect(A.vz).toBeGreaterThan(0.5); expect(A.vz).toBeLessThan(3.2);
    // (the hurdle's air time is the least that clears the box: a taller box flies longer)
    const T = heroVault('hurdle', R, { h: 0.8 * hip, d: 0.1, from: 'sprint' }).air[0];
    expect(T.to - T.from).toBeGreaterThan(A.to - A.from);
  }, 60000);
  it('a knee driven past the swivel\'s cone rides the rig\'s seat<S> for that leg alone (absent: as before)', () => {
    const base = { support: 'none', hipR: { pitch: HIP_CONE }, kneeR: 90, hipL: { pitch: HIP_CONE }, kneeL: 90 };
    const n0 = rigNodesAt(R, base).nodes, n1 = rigNodesAt(R, { ...base, seatR: 30 }).nodes, n2 = rigNodesAt(R, { ...base, seatR: 0 }).nodes;
    expect(n1.kneeR[2]).toBeGreaterThan(n0.kneeR[2] + 0.1); expect(n1.kneeL).toEqual(n0.kneeL); expect(n2.kneeR).toEqual(n0.kneeR);
  });
  it('the solver: a curb is run over, a bar hurdled, a rail speed-vaulted, a table konged, a wall from a jog step-vaulted', () => {
    expect(freeRun({ gait: 'jog', phase: 0.3 }, { h: 0.05, d: 0.2, distance: 3 }, R).move).toBe('stride');
    expect(freeRun({ gait: 'sprint', phase: 0.1 }, { h: 0.3, d: 0.1, distance: 6 }, R).move).toMatch(/^hurdle/);
    expect(freeRun({ gait: 'sprint', phase: 0.5 }, { h: 0.6, d: 0.2, distance: 6 }, R).move).toMatch(/^speedVault/);
    expect(freeRun({ gait: 'sprint', phase: 0.5 }, { h: 0.6, d: 0.8, distance: 7 }, R).move).toMatch(/^kongVault/);
    const x = freeRun({ gait: 'jog', phase: 0.7 }, { h: 0.7, d: 0.35, distance: 4 }, R);
    expect(x.move).toMatch(/^stepVault/); expect(Math.abs(x.approach.stretch - 1)).toBeLessThanOrEqual(0.2); expect(x.approach.steps).toBeGreaterThan(0);
  }, 120000);
  it('the solver says why: too high, too near, nothing out of a walk', () => {
    expect(freeRun({ gait: 'sprint', phase: 0.5 }, { h: 1.3 * hip, d: 0.3, distance: 6 }, R)).toMatchObject({ move: null });
    expect(freeRun({ gait: 'sprint', phase: 0.5 }, { h: 0.6, d: 0.2, distance: 0.8 }, R).why).toMatch(/too near/);
    expect(freeRun({ gait: 'walk', phase: 0 }, { h: 0.5, d: 0.2, distance: 3 }, R).move).toBe(null);
    expect(() => heroVault('backflip', R, { h: 0.5 })).toThrow(/no move/);
    expect(() => heroVault('kongVault', R, { h: 0.5, from: 'jog' })).toThrow(/out of sprint/);
  }, 120000);
});
