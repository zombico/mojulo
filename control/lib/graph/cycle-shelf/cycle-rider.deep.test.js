/**
 * The rider astride, on the realistic hero's rig: every machine solved in its own posture (its feet planted on its pegs,
 * its floor or its pedals, its hands on its grips, its lean within its card), one machine posed and drawn (its sit bones
 * on the seat, its feet at the pegs), a rider standing on the pegs, and the grid's instance carrying its rider. The hero
 * takes half a minute to build, so this is the deep tier.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { CYCLE_ARCHETYPES, assembleCycle } from './index.js';
import { POSTURES, postureOf, riderOn, solveRider } from './cycle-rider.js';
import { cycleInstanceFaces } from './cycle-figure.js';

let R = null;
beforeAll(async () => {
  const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
  const { validateRig } = await import('../polygonizer/station-loft-rig.js');
  R = validateRig(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ form: 'realistic' }) }).recipe.rig);
}, 120000);

describe('every machine, ridden in its posture', () => {
  it.each(Object.keys(CYCLE_ARCHETYPES))('%s: feet planted, hands on the grips, the lean within its card', async (id) => {
    const { report } = await solveRider(R, assembleCycle(id).readout.rider, postureOf(id));
    expect(report.reached, JSON.stringify(report)).toBe(true);
    const [lo, hi] = POSTURES[postureOf(id)].hinge;
    expect(report.hinge).toBeGreaterThanOrEqual(lo);
    expect(report.hinge).toBeLessThanOrEqual(hi);
  });
  it('a rider standing on the pegs reaches too, the pelvis off the seat', async () => {
    const id = Object.keys(CYCLE_ARCHETYPES).find((k) => postureOf(k) === 'mx');
    const { report } = await solveRider(R, assembleCycle(id).readout.rider, 'mxStand');
    expect(report.reached).toBe(true);
  });
});

describe('a rider drawn', () => {
  it('sits on the seat with its feet at the pegs, in the machine\'s frame', async () => {
    const id = Object.keys(CYCLE_ARCHETYPES)[0], rider = assembleCycle(id).readout.rider;
    const { faces, report } = await riderOn(id, { rider });
    expect(faces.length).toBeGreaterThan(10000);
    const pts = faces.flatMap((f) => f.corners);
    // (the lowest of the seat's patch is the seat's top; the nearest of the rider to each peg, a shoe's sole on it)
    const onSeat = pts.filter((p) => Math.abs(p[0]) < 0.08 && Math.abs(p[1] - rider.seat[1]) < 0.12);
    expect(onSeat.length).toBeGreaterThan(0);
    expect(onSeat.reduce((m, p) => Math.min(m, p[2]), Infinity)).toBeGreaterThan(rider.seat[2] - 0.05);
    for (const k of ['peg.l', 'peg.r']) {
      const g = rider[k], near = pts.reduce((m, p) => Math.min(m, Math.hypot(p[0] - g[0], p[1] - g[1], p[2] - g[2])), Infinity);
      expect(near, k).toBeLessThan(0.06);
    }
    expect(report.reached).toBe(true);
  }, 120000);
  it('rides on the studio grid: the instance carries its rider and says how it sits', async () => {
    const id = Object.keys(CYCLE_ARCHETYPES)[0];
    const bare = await cycleInstanceFaces({ archetype: id }), ridden = await cycleInstanceFaces({ archetype: id, rider: true });
    expect(ridden.faces.length).toBeGreaterThan(bare.faces.length);
    expect(ridden.stats.rider).toMatchObject({ posture: postureOf(id), reached: true });
  }, 120000);
});
