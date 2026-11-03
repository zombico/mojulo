// hero-carry's arms holds — the arms kernel's guns held on their own stations: a shouldered long gun (the cheek on the
// stock, the eye on the sight line) and a handgun (the arms' reach, the support hand wrapped), each a procedure of its own,
// the casts alternating; the fists closed on the parts as drawn, the index on the trigger at the aim and along the frame
// at the ready.
import { describe, expect, it } from 'vitest';
import { validateRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroHold, carryMounts, carryTriangles, HOLDS } from './hero-carry.js';

const rigOf = (cast) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const allTrue = (laws) => Object.fromEntries(Object.keys(laws).map((k) => [k, true]));

describe('hero-carry: the arms kernel\'s guns', () => {
  it('a shouldered rifle: every law, the trigger under the index, the fists closed on the grip and the foregrip', () => {
    const R = rigOf('female'), h = heroHold('rifleAim', R);
    expect(h.checks.laws, JSON.stringify(h.checks)).toEqual(allTrue(h.checks.laws));
    expect(h.checks.laws.trigger).toBe(true);
    expect(h.checks.fingers.R.trigger).toBeLessThan(0.004);
    expect(h.checks.fingers.L.gap).toBeLessThan(0.004);
    expect(h.arm).toEqual(HOLDS.rifleAim.arm);
    // the arm is drawn as gear riding the strong hand, not as boxes
    const m = carryMounts(h, R);
    expect(m).toHaveLength(1); expect(m[0].bone).toBe('handR'); expect(m[0].build.item).toBe('rifle');
    expect(carryTriangles(h, R)).toHaveLength(0);
  }, 180000);
  it('a handgun at the ready: the support hand wrapped over the strong one, the index straight along the frame', () => {
    const R = rigOf('male'), h = heroHold('handgunLowReady', R);
    expect(h.checks.laws, JSON.stringify(h.checks)).toEqual(allTrue(h.checks.laws));
    expect(h.checks.fingers.L.kind).toBe('wrap');
    expect(h.checks.fingers.R.index).toBeDefined(); expect(h.checks.fingers.R.trigger).toBeUndefined();
  }, 180000);
  it('another model of the class goes in a hold; another class, or a sample\'s hold, is refused by name', () => {
    const R = rigOf('female');
    expect(() => heroHold('rifleAim', R, { arm: { item: 'pistol' } })).toThrow(/not held in 'rifleAim'/);
    expect(() => heroHold('carbineAim', R, { arm: { item: 'rifle' } })).toThrow(/arms hold/);
  });
});
