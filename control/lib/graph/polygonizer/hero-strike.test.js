// hero-strike — the straight strikes' laws on real hero rigs: the hand lands on its contact point along a straight path
// (a hand-led strike's two straight runs), the chain runs in its order (body-led: hips, chest, then the hand fastest at
// contact; hand-led: the arm opens before the body turns), the body stays over its feet while both are down, the
// planted feet hold, the arm is near straight at contact, the clip plays out of its stance's held pose and back into
// it, and a left strike is the right one's exact mirror.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroStrike, STRIKES, STRIKE_NAMES } from './hero-strike.js';
import { heroStance } from './hero-stance.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const rigOf = (hero) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(hero) }).recipe.rig);
const HEROES = { female: rigOf({ cast: 'female', head: 'anime' }), male: rigOf({ cast: 'male', head: 'anime' }) };

describe('hero-strike', () => {
  // every strike (each its own chain and hand), the casts alternating
  for (const [i, name] of Object.keys(STRIKES).entries()) {
    const rig = i % 2 ? 'male' : 'female', R = HEROES[rig];
    it(`${rig} ${name}: lands, straight, in order, balanced, planted, extended`, () => {
      const K = heroStrike(name, R), c = K.checks;
      expect(c.contact, 'the hand on its point at contact').toBeLessThan(0.01);
      expect(c.straight, 'the path straight').toBeLessThan(0.03);
      expect(c.order.ordered, JSON.stringify(c.order)).toBe(true);
      expect(c.balance, 'the centre of mass over the feet while both are down').toBeGreaterThan(0.003);
      expect(c.plant, 'the planted feet hold').toBeLessThan(0.002);
      expect(c.elbow, 'near straight at contact').toBeLessThan(40);
      expect(c.ends).toBeLessThan(1e-6);
    }, 30000);
  }
  it('plays out of the stance and back: the first and last frames are the stance held', () => {
    const R = HEROES.female; const K = heroStrike('jab', R), S = heroStance('guard', R);
    const a = rigNodesAt(R, K.clip.fn(0)).nodes, b = rigNodesAt(R, S.hold).nodes;
    for (const k of Object.keys(b)) expect(Math.hypot(...[0, 1, 2].map((i) => a[k][i] - b[k][i])), k).toBeLessThan(2e-3);
  }, 30000);
  it('a body-led strike hands on up the chain: the hips peak before the hand, the hand fastest near contact', () => {
    const K = heroStrike('cross', HEROES.male), o = K.checks.order, tc = STRIKES.cross.timing.contact;
    expect(o.hips).toBeLessThan(o.hand - 0.05); expect(o.chest).toBeLessThanOrEqual(o.hand); expect(Math.abs(o.hand - tc)).toBeLessThan(0.05);   // (peaks read at 1/80 of the clip)
  }, 30000);
  it('the thrust lunges: the lead foot steps out and lands at contact, the rear arm counters back', () => {
    const R = HEROES.female; const K = heroStrike('thrust', R), tc = STRIKES.thrust.timing.contact;
    const n0 = rigNodesAt(R, K.clip.fn(0)).nodes, nc = rigNodesAt(R, K.clip.fn(tc)).nodes;
    expect(nc.toeBaseR[1] - n0.toeBaseR[1]).toBeGreaterThan(0.25);
    expect(nc.toeBaseR[2] - R.joints.toeBaseR[2]).toBeLessThan(1e-3);
    expect(nc.wristL[1]).toBeLessThan(nc.shoulderL[1] - 0.15); expect(nc.wristL[2]).toBeLessThan(nc.shoulderL[2]);
  }, 30000);
  it('a left strike is the right one mirrored', () => {
    const R = HEROES.male;
    for (const base of ['jab', 'thrust']) {
      const a = heroStrike(base, R), b = heroStrike(`${base}Left`, R);
      expect(b.hand).toBe(a.hand === 'R' ? 'L' : 'R'); expect(b.contact.at[0]).toBeCloseTo(-a.contact.at[0], 6);
      for (const t of [0.2, a.contact.t / a.seconds, 0.7]) {
        const p = rigNodesAt(R, a.clip.fn(t)).nodes, q = rigNodesAt(R, b.clip.fn(t)).nodes;
        for (const k of Object.keys(p)) { const m = k.replace(/([LR])$/, (s) => (s === 'L' ? 'R' : 'L')); if (!q[m]) continue; expect(Math.abs(p[k][0] + q[m][0]) + Math.abs(p[k][1] - q[m][1]) + Math.abs(p[k][2] - q[m][2]), `${base} ${k} at ${t}`).toBeLessThan(2e-3); }
      }
    }
  }, 60000);
  it('names every strike and its mirror; refuses an unknown one', () => {
    expect(STRIKE_NAMES).toEqual(['jab', 'jabLeft', 'cross', 'crossLeft', 'thrust', 'thrustLeft']);
    expect(() => heroStrike('uppercut', HEROES.male)).toThrow(/no strike/);
  });
});
