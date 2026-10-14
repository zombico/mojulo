// hero-rest — at rest on real hero rigs: every contact held (the sit bones on the seat, the back on the backrest, the
// feet, knees, ankles and hands where the pose lays them), nothing through the floor, the knees and hips in range, an
// upright sitter balanced, a knocked-out body resting every limb; a slouch leans on the chair, lying costs nothing held.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroRest, restTriangles, RESTS, REST_NAMES, SEATS, LOTUS_REACH } from './hero-rest.js';

const rigOf = (cast) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const HEROES = { female: rigOf('female'), male: rigOf('male') };
// one rest per distinct solve (hero-rest.js: the family, the seat, reclined onto a back, approximate, limp), chosen from
// the catalog, the casts alternating
const SOLVES = Object.values(Object.groupBy(REST_NAMES, (n) => { const P = RESTS[n]; return `${P.family} ${P.seat ?? ''} ${P.recline === 'back' ? 'reclined' : ''} ${P.approx ? 'approx' : ''} ${P.limp ? 'limp' : ''}`; }))
  .map((g, i) => [i % 2 ? 'male' : 'female', g[0]]);

describe('hero-rest', () => {
  for (const [cast, name] of SOLVES) {
    const R = HEROES[cast];
    it(`${cast} ${name}: every contact held, nothing through the floor, in range`, () => {
      const x = heroRest(name, R), c = x.checks;
      // (an approximate pose keeps every law but the one it approximates: measured, below)
      expect(c.laws, JSON.stringify(c)).toEqual(Object.fromEntries(Object.keys(c.laws).map((k) => [k, k === x.approx ? c.laws[k] : true])));
    }, 60000);
  }
  it('sits on the seat it is given: the sit bones on the chair, and a slouch slides forward and reclines onto the back', () => {
    const R = HEROES.female, up = heroRest('chairUpright', R), sl = heroRest('chairSlouch', R);
    expect(up.checks.contacts.sitBones).toBeLessThan(0.01); expect(up.checks.balance).toBeGreaterThan(0);
    expect(sl.checks.contacts.back).toBeLessThan(0.012);
    const nu = rigNodesAt(R, up.pose).nodes, ns = rigNodesAt(R, sl.pose).nodes;
    expect(sl.contacts.sitBones[1]).toBeGreaterThan(up.contacts.sitBones[1] + 0.05);   // slid forward on the seat
    expect(ns.neckHub[1] - ns.pelvisHub[1]).toBeLessThan(nu.neckHub[1] - nu.pelvisHub[1]);   // the trunk lies back
    expect(sl.effort.supported).toBe('back');
  }, 60000);
  it('lying, the floor holds the body: no held effort, the trunk on the floor', () => {
    for (const name of ['lieBack', 'knockedOut']) {
      const x = heroRest(name, HEROES.male); expect(x.effort).toBeNull(); expect(Math.abs(x.checks.floor)).toBeLessThan(0.015);
    }
    const k = heroRest('knockedOut', HEROES.female);
    expect(Object.values(k.checks.rests).every((d) => d < 0.06)).toBe(true);
    expect(k.face.blink).toBe(1);
  }, 60000);
  it('the floor sits put the knees out to their own sides; a lotus foot rests on the other leg', () => {
    const R = HEROES.female, x = heroRest('crossLegged', R), n = rigNodesAt(R, x.pose).nodes;
    expect(n.kneeR[0] - n.hipR[0]).toBeGreaterThan(0.05); expect(n.kneeL[0] - n.hipL[0]).toBeLessThan(-0.05);
    // the lotus is approximate on this rig: each foot rests INTO the other shin (the hip turns out 45°, the knee's pole is
    // level), by no more than this much
    for (const d of Object.values(heroRest('lotus', R).checks.contacts.lotus)) { expect(d).toBeLessThan(LOTUS_REACH); expect(d).toBeGreaterThan(-0.05); }
  }, 60000);
  it('draws its seat and its crater', () => {
    expect(restTriangles(heroRest('chairUpright', HEROES.female)).length).toBeGreaterThan(36);
    expect(restTriangles(heroRest('yamcha', HEROES.female)).length).toBeGreaterThan(36);
    expect(restTriangles(heroRest('lotus', HEROES.female))).toHaveLength(0);
  }, 60000);
  it('names its poses and seats; refuses an unknown one', () => {
    expect(REST_NAMES).toEqual(Object.keys(RESTS));
    expect(Object.keys(SEATS)).toEqual(['chair', 'couch', 'floor']);
    expect(() => heroRest('handstand', HEROES.male)).toThrow(/no rest pose/);
  });
});
