import { describe, expect, it } from 'vitest';

import { readSortie, sortieMechanics, sortieCast, SORTIE } from './flight-sortie.js';
import { scopeMarks, leadPoint } from '../scene/channels/cockpit-hud.js';
import { cockpitOf } from '../skyscape/cockpits.js';

// ── a cockpit level's sortie (gameworld/flight-sortie.js): its flight groups and its goals ─────────────────────────────
// Read teaching; lowered onto the sortie mechanic and the pilot's hull; cast as craft on their sides, drawn as their
// shelf airframes, the arriving ones asleep. And the cockpit HUD's two pure readings: a sensor's marks, the lead pip.

const S0 = {
  groups: [
    { id: 'red', side: 'friend', count: 2 },
    { id: 'convoy', name: 'Transport', side: 'friend', craft: 'starliner', count: 1, hold: true },
    { id: 'fighter', side: 'foe', count: 3 },
    { id: 'bomber', side: 'foe', craft: 'twinPodBomber', count: 2, arrive: { down: 'fighter', after: 4, say: 'Bombers' } },
  ],
  goals: [{ destroy: ['fighter', 'bomber'], say: 'Clear' }, { protect: 'convoy' }],
};
const ends = { airMap: { craft: { max: 160, cruise: 100 } }, seat: { transform: { pos: [0, 0, 0], heading: 0 } } };

describe('a sortie', () => {
  it('is read with its defaults: the sides\' craft, counts, hulls and shields; each group a name', () => {
    const S = readSortie(S0);
    expect(S.groups.map((g) => [g.id, g.name, g.craft, g.count, g.shields, g.hull, g.hold])).toEqual([
      ['red', 'Red', SORTIE.craft.friend, 2, true, SORTIE.hull.friend, false],
      ['convoy', 'Transport', 'starliner', 1, true, SORTIE.hull.friend, true],
      ['fighter', 'Fighter', SORTIE.craft.foe, 3, false, SORTIE.hull.foe, false],
      ['bomber', 'Bomber', 'twinPodBomber', 2, false, SORTIE.hull.foe, false],
    ]);
  });

  it('lowers onto the sortie mechanic over its craft, and the pilot\'s hull', () => {
    const M = sortieMechanics(readSortie(S0));
    expect(M[0]).toEqual({ kind: 'fail-on-death', of: 'body' });
    expect(M[1]).toEqual({ kind: 'sortie',
      goals: [{ destroy: ['fighter-1', 'fighter-2', 'fighter-3', 'bomber-1', 'bomber-2'], say: 'Clear' }, { protect: ['convoy-1'] }],
      arrivals: [{ craft: ['bomber-1', 'bomber-2'], after: 4, down: ['fighter-1', 'fighter-2', 'fighter-3'], say: 'Bombers' }] });
  });

  it('casts its groups as craft on their sides: minds that hunt the other side, a holding group unarmed, the arriving asleep', () => {
    const { entities: C, figures } = sortieCast(readSortie(S0), ends);
    const by = Object.fromEntries(C.map((e) => [e.id, e]));
    expect(C.map((e) => e.id)).toEqual(['red-1', 'red-2', 'convoy-1', 'fighter-1', 'fighter-2', 'fighter-3', 'bomber-1', 'bomber-2']);
    expect([by['red-1'].team, by['fighter-1'].team]).toEqual(['player', 'foes']);
    expect(by['red-1'].rule).toMatchObject({ type: 'ai', space: true, target: 'enemy' });
    expect(by['convoy-1'].rule).toEqual({ type: 'static' });
    expect(by['convoy-1'].weapon).toBeUndefined();
    expect([by['bomber-1'].dormant, by['fighter-1'].dormant]).toEqual([true, undefined]);
    expect(by['fighter-2'].body).toMatchObject({ type: 'figure-rig', figure: `craft-${SORTIE.craft.foe}`, name: 'Fighter 2', goal: true, hittable: true });
    // each fighter's systems: a friend's shields, and every fighter its craft's generator, its cannons charged from it;
    // a foe without shields; a transport that holds has neither
    expect(by['red-1'].body.ship.shields).toBeTruthy();
    expect(by['fighter-1'].body.ship).toEqual({ generator: { out: cockpitOf(SORTIE.craft.foe).numbers.generator } });
    expect(by['fighter-1'].weapon).toMatchObject({ energyMax: cockpitOf(SORTIE.craft.foe).numbers.lasers.energy, energyRegen: 0 });
    expect(by['red-1'].body.ship.generator.out).toBe(cockpitOf(SORTIE.craft.friend).numbers.generator);
    expect(by['convoy-1'].body.ship?.generator).toBeUndefined();
    expect(figures['craft-twinPodBomber']).toEqual({ craft: { archetype: 'twinPodBomber', flying: true, gear: 'up' } });
    // foes ahead of the start facing it, friends beside it on its heading
    expect(by['fighter-1'].transform.pos[0]).toBeGreaterThan(1000);
    expect(Math.cos(by['fighter-1'].transform.heading)).toBeLessThan(-0.9);
    expect(Math.abs(by['red-1'].transform.pos[1])).toBeGreaterThan(20);
  });

  it('refuses what it cannot fly, teaching', () => {
    const bad = (s, m) => expect(() => readSortie(s)).toThrow(m);
    bad({ groups: [{ id: 'a', side: 'foe' }], goals: [{ protect: 'a' }] }, /a foe: protect a friend's group/);
    bad({ groups: [{ id: 'a', side: 'friend' }], goals: [{ destroy: 'a' }] }, /a friend: destroy a foe's group/);
    bad({ groups: [{ id: 'a', side: 'foe', craft: 'tie' }], goals: [{ destroy: 'a' }] }, /not a craft of the shelf/);
    bad({ groups: [{ id: 'a', side: 'foe', arrive: { down: 'b' } }], goals: [{ destroy: 'a' }] }, /no other group of that id/);
    bad({ groups: [{ id: 'a', side: 'friend' }], goals: [{ protect: 'a' }] }, /at least one destroy or survive/);
    bad({ groups: [{ id: 'a', side: 'foe', count: 9 }], goals: [{ destroy: 'a' }] }, /1 to 6/);
  });
});

describe('the cockpit HUD\'s readings', () => {
  const me = { pos: [0, 0, 0], f: [1, 0, 0], u: [0, 0, 1] };
  it('a sensor: dead ahead the middle, abeam the edge, up the top; the aft one what lies behind', () => {
    const things = [{ pos: [100, 0, 0], kind: 'foe' }, { pos: [0, -100, 0], kind: 'foe' }, { pos: [100, 0, 100], kind: 'ally' }, { pos: [-100, 0, 0], kind: 'target' }];
    expect(scopeMarks(me, things, 'fore')).toEqual([{ x: 0.5, y: 0.5, kind: 'foe' }, { x: 0.96, y: 0.5, kind: 'foe' }, { x: 0.5, y: 0.27, kind: 'ally' }]);
    expect(scopeMarks(me, things, 'aft')).toEqual([{ x: 0.5, y: 0.5, kind: 'target' }]);
  });
  it('the lead pip: where a bolt fired now meets a body on its course; none when it cannot catch it', () => {
    const at = leadPoint([0, 0, 0], [1000, 0, 0], [0, 100, 0], 500);
    expect(Math.hypot(...at)).toBeCloseTo(500 * (at[1] / 100), 6);
    expect(leadPoint([0, 0, 0], [1000, 0, 0], [600, 0, 0], 500)).toBe(null);
    expect(leadPoint([0, 0, 0], [300, 0, 0], [0, 0, 0], 500)).toEqual([300, 0, 0]);
  });
});

describe('a sortie\'s beacons', () => {
  const S1 = { groups: [{ id: 'red', side: 'friend' }, { id: 'raider', side: 'foe', arrive: { reach: 'nav', after: 2 } }],
    beacons: [{ id: 'nav', at: { ahead: 1000 } }, { id: 'jump', name: 'Jump point', at: { ahead: 2000, side: 500 }, lit: { down: 'raider' } }],
    goals: [{ destroy: 'raider' }, { reach: 'jump' }] };
  it('is read teaching: a place, its reach, what lights it; a goal and an arrival on it', () => {
    const S = readSortie(S1);
    expect(S.beacons.map((b) => [b.id, b.name, b.radius])).toEqual([['nav', 'Nav', SORTIE.beacon], ['jump', 'Jump point', SORTIE.beacon]]);
    expect(() => readSortie({ ...S1, goals: [{ reach: 'nowhere' }] })).toThrow(/no beacon of the sortie/);
    expect(() => readSortie({ ...S1, beacons: [{ id: 'a', at: {}, lit: { reach: 'b' } }, { id: 'b', at: {}, lit: { reach: 'a' } }], goals: [{ destroy: 'raider' }], groups: [S1.groups[0], { id: 'raider', side: 'foe' }] })).toThrow(/comes back on itself/);
    expect(() => readSortie({ ...S1, beacons: [{ id: 'red', at: {} }] })).toThrow(/once/);
  });
  it('lowers each beacon where the start puts it, its marker the mission\'s, asleep until it lights', () => {
    const S = readSortie(S1), mech = sortieMechanics(S, ends)[1];
    expect(mech.beacons.map((b) => [b.id, b.at, b.entity])).toEqual([['nav', [1000, 0, 0], 'beacon-nav'], ['jump', [2000, -500, 0], 'beacon-jump']]);
    expect(mech.beacons[1].lit).toEqual({ down: ['raider-1', 'raider-2', 'raider-3'] });
    expect(mech.arrivals[0]).toMatchObject({ reach: 'nav', after: 2 });
    const C = sortieCast(S, ends), B = C.entities.filter((e) => e.body.beacon);
    expect(B.map((e) => [e.id, !!e.dormant, e.body.goal, e.body.hittable])).toEqual([['beacon-nav', false, true, undefined], ['beacon-jump', true, true, undefined]]);
    // (read without its map, a sortie lays no beacons)
    expect(sortieMechanics(S)[1].beacons).toBeUndefined();
  });
});
