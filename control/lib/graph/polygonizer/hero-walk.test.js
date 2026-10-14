// The hero's walk as minted now (hero-gaits.js HERO_WALK over WALK_MINT) on its own rig, against the studied walk and
// measured walking: it moves at a walking pace with a person's bob, the body no longer held low all cycle, the head
// without a jolt, the toes on the floor, and the stop still bakes out of it.
import { describe, it, expect } from 'vitest';
import { heroLocomotion, heroStop, motionPlan, stampHeroMotion } from './hero-motion.js';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male', head: 'anime' }) }).recipe.rig);
const D = 180 / Math.PI;
const knee = (n) => Math.min(...Object.values(R.legs).map((l) => { const a = [0, 1, 2].map((k) => n[l.knee][k] - n[l.hip][k]), b = [0, 1, 2].map((k) => n[l.hock][k] - n[l.knee][k]); return Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b)) * D; }));
function read(gait) {
  const loco = heroLocomotion(gait.spec, R, { tilt: gait.tilt }), M = 240, dt = gait.seconds / M;
  const nodes = Array.from({ length: M }, (_, i) => rigNodesAt(R, loco.fn(i / M)).nodes);
  const pz = nodes.map((n) => n.pelvisHub[2]), hz = nodes.map((n) => n.headBase[2]);
  return {
    v: loco.v(gait.seconds),
    bob: (Math.max(...pz) - Math.min(...pz)) * 100,
    knee: nodes.reduce((s, n) => s + knee(n), 0) / M,                     // the stance knee's mean bend
    head: Math.max(...hz.map((v, i) => Math.abs(hz[(i + 1) % M] - 2 * v + hz[(i - 1 + M) % M]) / (dt * dt))) / 9.81,
    toe: Math.min(...Object.values(R.legs).flatMap((l) => nodes.map((n) => n[l.toeBase][2] - R.joints[l.toeBase][2]))),
  };
}

describe("the hero's walk as minted now", () => {
  const studied = read(motionPlan({ walk: true }).walk), minted = read(motionPlan(stampHeroMotion({ walk: true })).walk);

  it('walks at a walking pace with a person\'s bob (studied: 0.7 m/s, 5.5 cm)', () => {
    expect(minted.v).toBeGreaterThan(0.95); expect(studied.v).toBeLessThan(0.8);
    expect(minted.bob).toBeGreaterThan(2); expect(minted.bob).toBeLessThan(4.5);
  }, 120_000);

  it('stands taller through the stance, the head steady, the toes on the floor', () => {
    expect(minted.knee).toBeLessThan(studied.knee);
    expect(minted.head).toBeLessThan(1.2);
    expect(minted.toe).toBeGreaterThan(-1e-6);
  }, 120_000);

  it('the walk stop still bakes out of it, both feet', () => {
    const plan = motionPlan(stampHeroMotion({ walk: true }));
    for (const lead of ['R', 'L']) expect(heroStop(plan.walk, R, { from: 'walk', lead }).seconds).toBeGreaterThan(0);
  }, 120_000);
});
