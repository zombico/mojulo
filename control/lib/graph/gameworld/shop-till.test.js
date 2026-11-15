// A SHOP WALKED INTO, PLAYED: a level on a town whose shops are entered (geotown.enter) gives the hero ground inside
// them and their tills, and an errand's trade had in a shop of a kind stands at such a till.
import { describe, it, expect } from 'vitest';
import { stageEnds } from './levels.js';
import { readErrands, errandLegs, layErrand, TILL_REACH } from './errand.js';

// the smallest town with a row of shops, its shops one kind
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 4, geotown: { enter: { cards: ['electronics'] }, evoke: 'segment', segment: 'main-street', hills: { height: 4 }, margin: 12 } };
const ends = stageEnds(M), within = (p, c) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] > c.min[2] && p[2] < c.max[2];

describe('a level on a town whose shops are walked into', () => {
  it('tells its tills, each on ground the hero stands on and clear of every box', () => {
    expect(ends.tills.length).toBeGreaterThan(0);
    const t = ends.tills[0];
    expect(t.card).toBe('electronics');
    const z = ends.ground(t.at[0], t.at[1]);
    expect(z).not.toBeNull();
    expect(Math.abs(z - t.at[2])).toBeLessThan(0.1);
    expect(ends.colliders.some((c) => within([t.at[0], t.at[1], z + 1], c))).toBe(false);
  });
  it('opens no door to a scene of its own on a shop walked into where it stands', () => {
    const doored = stageEnds({ ...M, enter: ['shop'] });
    expect(doored.doors ?? []).toHaveLength(0);
  });
});

describe('an errand\'s trade had in a shop', () => {
  const G = { levels: { town: {}, home: {} }, ids: ['town', 'home'], links: [{ from: 'home', to: 'town' }, { from: 'town', to: 'home' }], start: 'home', topology: 'interconnected', foes: null };
  const spec = [{ id: 'radio', giver: 'home', list: [{ item: 'coin', at: 'home' }, { item: 'radio', at: 'town', needs: ['coin'], shop: 'electronics' }, { item: 'tape', at: 'town' }] }];
  it('stands at the till of a store of its kind, the rest on spots', () => {
    const E = readErrands(spec, G), legs = errandLegs(E, 'town'), spots = [[1, 1, 0], [2, 2, 0]];
    const laid = layErrand(legs, spots, ends.tills), radio = laid.find((l) => l.item === 'radio'), tape = laid.find((l) => l.item === 'tape');
    expect(radio.at).toEqual(ends.tills[0].at);
    expect(radio.till).toBe(ends.tills[0].id);
    expect(radio.radius).toBe(TILL_REACH);
    expect(radio.shop).toBeUndefined();
    expect(tape.at).toEqual(spots[0]);
    // (a stage with no such shop: the trade on a spot, as any)
    expect(layErrand(legs, spots, []).find((l) => l.item === 'radio').at).toEqual(spots[0]);
  });
  it('refuses a shop that is no store card, and a bounty at a counter', () => {
    expect(() => readErrands([{ ...spec[0], list: [{ item: 'radio', at: 'town', shop: 'nowhere' }] }], G)).toThrow(/shop is the kind of store/);
  });
});
