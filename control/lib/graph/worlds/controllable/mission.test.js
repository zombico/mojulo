// A mission in one level (mission.js): things found, clues read, ways that open on them, a barrier, one result.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';

const E = composeLive();
const hooks = { ground: (pos) => (pos[0] > 50 ? -10 : 0) };   // (the floor below, far along x)
const MISSION = {
  items: [{ id: 'lift-key', at: [4, 0, 0] }, { id: 'intel', at: [60, 0, -10] }],
  clues: [{ id: 'pad', at: [0, 3, 0] }, { id: 'log', at: [0, 6, 0] }, { id: 'tracks', at: [0, 9, 0] }],
  reveal: { needs: 2, of: ['pad', 'log', 'tracks'], flag: 'known', says: 'a floor below' },
  ways: [{ id: 'lift', kind: 'lift', a: [8, 0, 0], b: [58, 0, -10], secs: 1, needs: { items: ['lift-key'], flags: ['known'] } }],
  barriers: [{ id: 'stairwell', min: [-0.25, -6, 0], max: [0.25, -4, 3], needs: { items: ['intel'] } }],
  objectives: [{ id: 'brief', says: 'get intel', done: 'lift-key' }, { id: 'true', says: 'what is below', after: 'known', done: 'intel' }],
  result: { at: [-5, -5, 0], when: ['lift-key', 'intel'] },
};
const world = () => E.createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 5, eye: 0, collideRadius: 0.3, collideHeight: 1.7, mission: MISSION }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
const run = (w, input, n) => { for (let k = 0; k < n; k++) E.stepWorld(w, input, 1 / 30, hooks); };
const put = (w, at) => { w.byId.p.transform.pos = at.slice(); run(w, {}, 2); };
const act = (w) => { run(w, { act: 1 }, 2); run(w, {}, 2); };

describe('a mission in one level', () => {
  it('a way stays shut until its key is held and its clues are read; then it is ridden to the other floor and back', () => {
    const w = world(); run(w, {}, 2);
    put(w, [8, 0, 0]); act(w);
    expect(w.ms.ride).toBeNull();
    expect(w.ms.locked).toEqual(['lift-key', 'known']);
    put(w, [4, 0, 0]);
    expect(w.ms.held['lift-key']).toBe(true);
    put(w, [0, 3, 0]); act(w);
    expect(w.ms.flags.known).toBeUndefined();
    put(w, [0, 9, 0]); act(w);   // (any two of the three)
    expect(w.ms.flags.known).toBe(true);
    expect(E.missionObjective(w).id).toBe('true');
    put(w, [8, 0, 0]); run(w, { act: 1 }, 2);
    expect(w.ms.ride).toMatchObject({ way: 'lift' });
    run(w, { forward: 1 }, 29);   // (held through the ride: it does not walk off)
    expect(w.ms.ride).not.toBeNull();
    run(w, {}, 3);
    expect(w.ms.ride).toBeNull();
    expect(w.byId.p.transform.pos.map((v) => Math.round(v))).toEqual([58, 0, -10]);
    act(w); run(w, {}, 40);
    expect(Math.round(w.byId.p.transform.pos[0])).toBe(8);
  });
  it('a barrier stands until what it needs is held, and holding everything at the way out is the one result', () => {
    const w = world(); run(w, {}, 2);
    expect(w.colliders.some((c) => c.of === 'mission:stairwell')).toBe(true);
    put(w, [1, -5, 0]);
    expect(w.ms.open.stairwell).toBeUndefined();
    w.ms.held.intel = true; run(w, {}, 2);
    expect(w.ms.open.stairwell).toBe(true);
    expect(w.colliders.some((c) => c.of === 'mission:stairwell')).toBe(false);
    put(w, [-5, -5, 0]);
    expect(w.ms.done).toBe(false);
    w.ms.held['lift-key'] = true; run(w, {}, 2);
    expect(w.ms.done).toBe(true);
  });
  it('an exit is taken once its key is held, and what was held comes in on the other page at its door', () => {
    const M2 = { ...MISSION, exits: [{ id: 'side-door', at: [0, -9, 0], needs: { items: ['lift-key'] }, to: 'hangar.html', door: 'lobby' }], arrivals: { yard: { at: [20, 20, 0], heading: 1 } } };
    const mk = () => E.createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 5, eye: 0, mission: M2 }, body: { type: 'none', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const w = mk(); run(w, {}, 2);
    put(w, [0, -9, 0]); act(w);
    expect(w.ms.exit).toBeNull();
    expect(w.ms.locked).toEqual(['lift-key']);
    w.ms.held['lift-key'] = true; act(w);
    expect(w.ms.exit).toMatchObject({ to: 'hangar.html', door: 'lobby' });
    const at = w.byId.p.transform.pos.slice(); run(w, { forward: 1 }, 20);
    expect(w.byId.p.transform.pos[0]).toBeCloseTo(at[0], 1);   // (held until the page goes)
    // the other page: what came in
    const v = mk(); v.msCarry = { held: { 'lift-key': true }, flags: { known: true }, hp: 40, door: 'yard' }; run(v, {}, 2);
    expect(v.ms.held['lift-key']).toBe(true);
    expect(v.ms.flags.known).toBe(true);
    expect(v.byId.p.body.hp).toBe(40);
    expect(v.byId.p.transform.pos.slice(0, 2).map(Math.round)).toEqual([20, 20]);
  });
  it('a way with a deck is ridden for real: the deck travels and carries the body; called from the other end, it comes alone', () => {
    const M3 = { ways: [{ id: 'lift', kind: 'lift', a: [0, 0, 10], b: [0, 0, 0], secs: 2, deck: 'deck' }], objectives: [] };
    const w = E.createWorld({ entities: [
      { id: 'p', pilotable: true, rule: { type: 'platform', speed: 5, eye: 0, mission: M3 }, body: { type: 'none' }, transform: { pos: [0, 0, 10], heading: 0 } },
      { id: 'deck', rule: { type: 'static' }, body: { type: 'mesh', shape: 'box', size: [6, 6, 0.3] }, transform: { pos: [0, 0, 9.85], heading: 0 } }] });
    // (the page's ground knows no body: the hall's floor round the opening, the lower floor under it; the deck is the mission's)
    const ground = { ground: (pos) => (Math.abs(pos[0]) < 3 && Math.abs(pos[1]) < 3 ? 0 : 10) };
    const go = (input, n) => { for (let k = 0; k < n; k++) E.stepWorld(w, input, 1 / 30, ground); };
    go({}, 2); go({ act: 1 }, 2); go({}, 28);
    expect(w.ms.ride).toMatchObject({ deck: 'deck', rides: true });
    const mid = w.byId.p.transform.pos[2];
    expect(mid).toBeGreaterThan(0.5); expect(mid).toBeLessThan(9.5);               // (on its way down, not teleported)
    expect(w.byId.deck.transform.pos[2] + 0.15).toBeCloseTo(mid, 3);              // (its feet on the deck's top)
    go({ forward: 1 }, 40);
    expect(w.ms.ride).toBeNull();
    expect(w.byId.p.transform.pos[2]).toBeCloseTo(0, 1);
    expect(w.ms.decks.lift).toBe('b');
    // back at the top by other means, the deck below: pressed there, it is called and comes alone
    w.byId.p.transform.pos = [0, 0, 10.2]; ground.ground = () => 10; go({}, 2); go({ act: 1 }, 2);
    expect(w.ms.ride).toMatchObject({ rides: false });
    go({}, 70);
    expect(w.byId.deck.transform.pos[2] + 0.15).toBeCloseTo(10, 2);
    expect(w.ms.decks.lift).toBe('a');
  });
  it('a hint is said where the body stands in its round, the nearest of two, and not outside them', () => {
    const w = E.createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 5, eye: 0, mission: { hints: [{ at: [0, 0], says: 'run' }, { at: [5, 0], says: 'crouch' }], objectives: [] } }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, {}, 2);
    expect(w.ms.hint).toBe(0);
    put(w, [3.4, 0, 0]);
    expect(w.ms.hint).toBe(1);
    put(w, [20, 0, 0]);
    expect(w.ms.hint).toBeNull();
  });
  it('the bus hears its moments: a thing taken, clues read, the flag raised, the way taken', () => {
    const w = world(), heard = [];
    let prev = null;
    const listen = (fn) => { fn(); const F = E.castFacts(w, prev); prev = F.prev; heard.push(...F.events.map((e) => e.type + (e.id ? ':' + e.id : ''))); };
    listen(() => run(w, {}, 2));
    listen(() => put(w, [4, 0, 0]));
    listen(() => { put(w, [0, 3, 0]); act(w); });
    listen(() => { put(w, [0, 9, 0]); act(w); });
    listen(() => { put(w, [8, 0, 0]); run(w, { act: 1 }, 2); });
    expect(heard).toEqual(['mission:item:lift-key', 'mission:clue:pad', 'mission:clue:tracks', 'mission:reveal:known', 'mission:ride:lift']);
  });

  it('a rule with no mission is as it was', () => {
    const w = E.createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 5, eye: 0 }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { act: 1 }, 3);
    expect(w.ms).toBeUndefined();
  });
});

describe('supplies', () => {
  const SUP = { items: [{ id: 'ration-1', at: [4, 0, 0], look: 'ration', gives: { hp: 40 }, name: 'A ration' }, { id: 'ammo-1', at: [8, 0, 0], look: 'ammo', gives: { rounds: 15 }, name: 'Rounds' }], objectives: [] };
  const armed = () => E.createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 5, eye: 0, collideRadius: 0.3, collideHeight: 1.7, mission: SUP },
    weapon: { magazine: 15, reserve: 30, damage: 10, fireRate: 4 }, body: { type: 'mesh', hittable: true, hp: 100, radius: 0.4 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
  it('a ration is left where it lies while health is full, and says so; hurt, it heals to the most and is used up', () => {
    const w = armed(), p = w.byId.p;
    run(w, {}, 1);
    expect(p.hpMax).toBe(100);
    put(w, [4, 0, 0]);
    expect(w.ms.held['ration-1']).toBeFalsy();
    expect(w.ms.said.text).toMatch(/health full/);
    p.body.hp = 80; put(w, [4, 0.1, 0]);
    expect(w.ms.held['ration-1']).toBe(true);
    expect(p.body.hp).toBe(100);                                    // 40 given, 20 taken: never past the most
    expect(w.ms.said.text).toMatch(/\+20 health/);
  });
  it('ammo goes into the reserve of the gun in hand', () => {
    const w = armed(), p = w.byId.p;
    run(w, {}, 1);
    const before = p.weapon.reserve;
    put(w, [8, 0, 0]);
    expect(w.ms.held['ammo-1']).toBe(true);
    expect(p.weapon.reserve).toBe(before + 15);
  });
});
