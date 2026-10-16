// hero-carry — carrying laws on a real hero rig: the hands on their stations, the wrists in range, the thing clear of
// the body (or touching only where it rests), a sighted gun on the eye's line to the mark, the body and its load over the
// feet where the body alone stood; the effort read off the moments, rising with the mass, answered by the body (pulled
// in, leaned, swayed, the free arm out) unless weightless; relax choosing the cheapest hold. The laws run on one hold
// per distinct procedure (how the thing is placed, its class, the hands), chosen from the catalog, the casts alternating.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroHold, heroCarry, effortOf, endurance, carryTriangles, CARRIED, CARRIED_NAMES, HOLDS, HOLD_NAMES, STRENGTH } from './hero-carry.js';

const rigOf = (cast) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const RIGS = { female: rigOf('female'), male: rigOf('male') }, R = RIGS.female;
const allTrue = (laws) => Object.fromEntries(Object.keys(laws).map((k) => [k, true]));
// the placement a hold's words select in hero-carry.js place(): hung, rested (on what), sighted (how), pointed, extended,
// anchored (where)
const placement = (H) => (H.hang ? 'hang' : H.rest ? `rest:${H.rest.on}` : H.sight ? `sight:${H.sight}` : H.point ? 'point' : H.extend ? 'extend' : `anchor:${H.anchor}`);
const PROCEDURES = Object.values(Object.groupBy(HOLD_NAMES, (n) => `${placement(HOLDS[n])} ${CARRIED[HOLDS[n].item].class} ${HOLDS[n].hands}`)).map((g, i) => [g[0], i % 2 ? 'male' : 'female']);
const held = new Map(), hold = (name, cast = 'female') => { const k = `${cast} ${name}`; if (!held.has(k)) held.set(k, heroHold(name, RIGS[cast])); return held.get(k); };

describe('hero-carry', () => {
  for (const [name, cast] of PROCEDURES) {
    it(`${cast} ${name}: the hands on the thing, the wrists in range, clear, balanced over the feet`, () => {
      const c = hold(name, cast).checks;
      expect(c.laws, JSON.stringify(c)).toEqual(allTrue(c.laws));
      for (const h of Object.values(c.hands)) { expect(h.at).toBeLessThan(0.006); expect(h.inRange).toBe(true); }
    }, 180000);
  }
  it('a sighted gun lies on the dominant eye\'s line to the mark: the pistol at the arms\' reach, the carbine on the cheek', () => {
    for (const name of ['pistolIsosceles', 'carbineAim']) {
      const a = hold(name).checks.aim.things[0];
      expect(a.eye, name).toBeLessThan(0.005); expect(a.mark, name).toBeLessThan(1);
    }
    const w = hold('carbineAim').answer.weld;
    expect(w.neckPitch, 'the head comes down onto the stock').toBeLessThan(-10);
  }, 120000);
  it('the effort rises with the mass, and the body answers it: a heavier box is pulled in and leaned back from', () => {
    const at = (kg) => heroHold('boxFront', R, { kg });
    const [a, b, c] = [3, 9, 18].map(at);
    expect(a.effort.cr10).toBeLessThan(b.effort.cr10); expect(b.effort.cr10).toBeLessThan(c.effort.cr10);
    expect(c.answer.ease.to).toBeLessThan(a.answer.ease.to);
    expect(c.answer.lean).toBeLessThanOrEqual(a.answer.lean);
    expect(c.answer.sink).toBeGreaterThan(a.answer.sink);
  }, 60000);
  it('a one-sided load leans the trunk away and swings the free arm out', () => {
    const x = heroHold('suitcaseSide', R, { kg: 12 });
    expect(x.answer.sideLean).toBeLessThan(0); expect(x.answer.freeArm).toBeGreaterThan(15);
    expect(x.checks.held).toBeLessThan(0.01);
  }, 30000);
  it('weightless perceives nothing: the preferred hold, unanswered, its effort still measured', () => {
    const x = heroHold('boxFront', R, { kg: 18, regime: 'weightless' });
    expect(x.perceived).toBe(0); expect(x.effort.cr10).toBeGreaterThan(3);
    expect(x.answer).toMatchObject({ lean: 0, sideLean: 0, sink: 0, ease: { from: 0.4, to: 0.4 } });
  }, 30000);
  it('relax takes the cheapest hold: a greatsword is planted, a pistol hangs at the side', () => {
    const g = heroCarry('greatsword', 'relax', R);
    expect(g.name).toBe('greatswordPlanted');
    expect(g.candidates.find((c) => c.name === 'greatswordSide').cr10).toBeGreaterThan(g.effort.cr10);
    expect(heroCarry('pistol', 'relax', R).name).toBe('pistolSide');
    expect(heroCarry('pistol', 'aim', R, { hands: 1 }).name).toBe('pistolOneHand');
  }, 120000);
  it('the effort: an arm hanging (the rest\'s A-pose) costs little, one held out level costs the shoulder its own weight\'s moment', () => {
    const hang = effortOf(R, rigNodesAt(R, {}).nodes, []);
    const out = effortOf(R, rigNodesAt(R, { shR: { pitch: 90, yaw: 0, roll: 0 } }).nodes, []);
    expect(hang.joints.shoulderR.moment).toBeLessThan(out.joints.shoulderR.moment / 3);
    expect(out.joints.shoulderR.moment).toBeGreaterThan(3); expect(out.joints.shoulderR.mvc).toBeLessThan(0.4);
    const kg = effortOf(R, rigNodesAt(R, { shR: { pitch: 90, yaw: 0, roll: 0 } }).nodes, [{ kg: 2, com: rigNodesAt(R, { shR: { pitch: 90, yaw: 0, roll: 0 } }).nodes.knucklesR, supports: [{ kind: 'hand', side: 'R', at: rigNodesAt(R, { shR: { pitch: 90, yaw: 0, roll: 0 } }).nodes.knucklesR }] }]);
    expect(kg.joints.shoulderR.moment - out.joints.shoulderR.moment).toBeGreaterThan(2 * 9.81 * 0.5);
    expect(hang.cast).toBe('female'); expect(STRENGTH.female.shoulder).toBeLessThan(STRENGTH.male.shoulder);
  });
  it('Rohmert\'s endurance: unlimited under 15 % of the maximum, minutes over it, shorter the harder', () => {
    expect(endurance(0.1)).toBe(Infinity);
    expect(endurance(0.3)).toBeGreaterThan(endurance(0.5)); expect(endurance(0.5)).toBeGreaterThan(0);
  });
  it('draws the held thing as triangles, as held and as its hand\'s bone carries it', () => {
    const x = hold('pistolSide'), a = carryTriangles(x, R);
    expect(a.length).toBeGreaterThan(12); expect(a[0].colour).toMatch(/^#/);
  }, 30000);
  it('names every thing and hold; refuses an unknown one', () => {
    expect(CARRIED_NAMES).toEqual(['pistol', 'carbine', 'shotgun', 'lmg', 'box', 'suitcase', 'lantern', 'sack', 'sword', 'greatsword']);
    for (const h of HOLD_NAMES) expect(CARRIED_NAMES).toContain(HOLDS[h].item);
    expect(() => heroHold('juggle', R)).toThrow(/no hold/);
    expect(() => heroCarry('anvil', 'relax', R)).toThrow(/nothing called/);
    expect(() => heroCarry('box', 'aim', R)).toThrow(/no aim hold/);
  });
});
