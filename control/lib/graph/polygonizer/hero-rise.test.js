// hero-rise — up out of a rest and down into it, on a real hero rig: the clip starts on the rest pose and ends on the
// stand (or the other way round), nothing goes through the floor or the seat, planted feet hold, the body keeps its
// balance (out of what bears it no longer than a step), the knees and hips stay in range, nothing moves faster than a
// brisk limb outside a fall; a chair's seat-off is solved by the momentum over the feet, sitting down is slower than
// getting up, a knocked-out body falls in the time a rod of its height takes. The laws run on one rest per route
// (hero-rise.js routeOf: each seat, upright or reclined, the floor, lying; a knocked-out body's collapse), chosen from the
// catalog, the direction and the cast alternating.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroRise } from './hero-rise.js';
import { heroRest, RESTS, REST_NAMES } from './hero-rest.js';

const rigOf = (cast) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const RIGS = { female: rigOf('female'), male: rigOf('male') }, R = RIGS.female;
const routeOf = (P) => (P.limp ? 'collapse' : P.family !== 'seated' ? 'lying' : P.seat === 'floor' ? 'floor' : `${P.seat}${P.recline === 'back' ? ' reclined' : ''}`);
// (a knocked-out body's route is the collapse going down; up, it gets up as the lying do)
const ROUTES = Object.values(Object.groupBy(REST_NAMES, (n) => routeOf(RESTS[n]))).map((g, i) => [g[0], RESTS[g[0]].limp ? true : i % 2 === 1, (i >> 1) % 2 ? 'male' : 'female']);
const rose = new Map(), rise = (name, down = false, cast = 'female') => { const k = `${cast} ${name} ${down}`; if (!rose.has(k)) rose.set(k, heroRise(name, RIGS[cast], { down })); return rose.get(k); };
const allTrue = (laws) => Object.fromEntries(Object.keys(laws).map((k) => [k, true]));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('hero-rise', () => {
  for (const [name, down, cast] of ROUTES) {
    it(`${cast} ${name} ${down ? 'down' : 'up'}: every law holds`, () => {
      const c = rise(name, down, cast).checks;
      expect(c.laws, JSON.stringify(c)).toEqual(allTrue(c.laws));
    }, 60000);
  }
  it('starts on the rest pose and ends standing (and back): fn(0) and fn(1) are the ends themselves', () => {
    const up = rise('chairUpright'), down = rise('chairUpright', true);
    const rest = rigNodesAt(R, heroRest('chairUpright', R).pose).nodes;
    for (const [x, at] of [[up, 0], [down, 1]]) { const n = rigNodesAt(R, x.fn(at)).nodes; expect(dist(n.headTop, rest.headTop)).toBeLessThan(1e-6); }
    const stood = rigNodesAt(R, up.fn(1)).nodes, sat = rigNodesAt(R, down.fn(0)).nodes;
    expect(stood.headTop[2]).toBeGreaterThan(rest.headTop[2] + 0.3); expect(dist(stood.headTop, sat.headTop)).toBeLessThan(1e-6);
  }, 60000);
  it('a chair: the seat left leaning forward (a solved flexion, inside the hips\' range), sitting down slower than rising', () => {
    const up = rise('chairUpright'), down = rise('chairUpright', true);
    expect(up.lean).toBeGreaterThan(30); expect(up.lean).toBeLessThan(75);
    expect(up.beats.seatOff).toBeGreaterThan(0); expect(down.beats.seatOn).toBeGreaterThan(down.seconds / 2);
    expect(down.seconds).toBeGreaterThan(up.seconds);
    // (the trunk is most forward about the seat-off: the head ahead of the hips)
    const n = rigNodesAt(R, up.fn(up.beats.seatOff / up.seconds)).nodes; expect(n.headTop[1]).toBeGreaterThan(n.pelvisHub[1] + 0.2);
  }, 60000);
  it('knocked out falls as a rod of its height under gravity, then lies', () => {
    const x = rise('knockedOut', true), c = x.checks;
    expect(c.laws, JSON.stringify(c)).toEqual(allTrue(c.laws));
    // (from the buckle's 5° to flat in about √(2L / 3g)·ln(tan(22.5°) / tan(1.25°)) ≈ 1.2 s for a 1.6 m figure)
    const fall = x.beats.impact - x.beats.states.find((s) => s.name === 'buckle').t;
    expect(fall).toBeGreaterThan(0.8); expect(fall).toBeLessThan(1.6);
    expect(x.checks.fallSpeed).toBeGreaterThan(4);
  }, 60000);
  it('stretches to the seconds asked; refuses an unknown rest', () => {
    expect(heroRise('kneeUp', R, { seconds: 5 }).seconds).toBe(5);
    expect(() => heroRise('handstand', R)).toThrow(/no rest pose/);
  }, 60000);
});
