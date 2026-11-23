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

describe('a sortie\'s capital ships and stations (fleet/)', () => {
  const S1 = { groups: [{ id: 'red', side: 'friend', count: 2 }, { id: 'frigate', side: 'foe', capital: 'frigate' }, { id: 'yard', side: 'foe', station: 'outpost', at: { side: 900 } }],
    goals: [{ destroy: ['frigate', 'yard'] }] };
  it('is one of it, there from the start, named by its class; refused otherwise, teaching', () => {
    const S = readSortie(S1);
    expect(S.groups.slice(1).map((g) => [g.id, g.name, g.count, g.capital ?? g.station])).toEqual([['frigate', 'Frigate', 1, 'frigate'], ['yard', 'Outpost', 1, 'outpost']]);
    const bad = (g, m) => expect(() => readSortie({ groups: [g], goals: [{ destroy: g.id }] })).toThrow(m);
    bad({ id: 'a', side: 'foe', capital: 'dreadnought' }, /a ship's class/);
    bad({ id: 'a', side: 'foe', capital: 'frigate', station: 'outpost' }, /not both/);
    bad({ id: 'a', side: 'foe', capital: 'frigate', count: 2 }, /is one/);
  });
  it('casts its blocks placed ahead, its hull the sum of its systems (each a target), a gun a mind on each hardpoint', () => {
    const { entities: C, fleet } = sortieCast(readSortie(S1), ends);
    const by = Object.fromEntries(C.map((e) => [e.id, e]));
    expect(fleet).toHaveLength(2);
    const [F] = fleet;
    // (a procedural enemy: destroy its systems and it blows up; its hull no target of its own)
    expect(by['frigate-1'].structure).toEqual({ systems: ['frigate-shield1', 'frigate-shield2', 'frigate-reactor1'], prefix: 'frigate/' });
    expect(by['frigate-1'].body.hittable).toBe(false);
    expect(by['frigate-1'].team).toBe('foes');
    expect(by['frigate-1'].transform.pos[0]).toBeGreaterThan(1000);
    for (const id of by['frigate-1'].structure.systems) {
      expect(by[id].body).toMatchObject({ hittable: true, hp: SORTIE.systems.hp, goal: true });
      expect(F.blocks.some((b) => b.id === by[id].onBlock)).toBe(true);
    }
    expect(by['frigate-shield1'].body.name).toBe('Frigate shield generator');
    const guns = C.filter((e) => e.id.startsWith('frigate-gun'));
    expect(guns).toHaveLength(F.hardpoints.length);
    expect(guns.every((g, k) => g.onBlock === F.hardpoints[k].block && g.rule.type === 'ai' && g.rule.speed === 0)).toBe(true);
    // (a foe's guns hunt the pilot, out to their flak's reach, past a fighter's own guns'; a friend's the nearest foe)
    expect(guns.every((g) => g.rule.target === undefined && g.weapon.range >= 1500 && g.rule.sightRange >= g.weapon.range)).toBe(true);
    const friendGuns = sortieCast(readSortie({ groups: [{ id: 'red', side: 'friend', count: 1 }, { id: 'ally', side: 'friend', capital: 'frigate' }, { id: 'f', side: 'foe', count: 1 }], goals: [{ destroy: 'f' }] }), ends).entities.filter((e) => e.id.startsWith('ally-gun'));
    expect(friendGuns.length).toBeGreaterThan(0);
    expect(friendGuns.every((g) => g.rule.target === 'enemy')).toBe(true);
    // the sortie counts the hulls
    expect(sortieMechanics(readSortie(S1))[1].goals).toEqual([{ destroy: ['frigate-1', 'yard-1'] }]);
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
