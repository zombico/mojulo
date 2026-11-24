import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { BASIC_ARSENAL, lowerArsenal } from '../../gameworld/combos.js';

// WHAT IS IN HAND (carry.js): a held menu steps through nothing in hand and each weapon, one equipped at a time; another
// uses a consumable.

const E = composeLive();
const hooks = { ground: () => 0 };
const gun = (name) => ({ name, weapon: { fireClass: 'sight', auto: false, cooldown: 0.2, magazine: 9, damage: 1, range: 80, coreAngle: 0.4, eye: 1.5 }, switchReady: 0.1 });
const world = (carry = {}) => E.createWorld({
  camera: { rule: 'follow', target: 'p' },
  entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 4, eye: 0, loadout: [gun('handgun'), gun('rifle')], ...(carry ? { carry } : {}) }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } }],
});
const run = (w, input, n = 1) => { for (let k = 0; k < n; k++) E.stepWorld(w, input, 1 / 60, hooks); return w; };
const fired = (w) => { delete w.byId.p.lastShot; run(w, { fire: 1 }, 20); run(w, {}, 2); return !!w.byId.p.lastShot; };

describe('what is in hand', () => {
  it('is emitted only into a world that asks for it', () => {
    expect(emissionSource({})).not.toContain('stepWithCarry');
    expect(emissionSource({ carry: true })).toContain('stepWithCarry');
  });
  it('the weapon menu, held: the look steps it and turns nothing; let go on nothing, the gun is put away and does not fire', () => {
    const w = run(world(), {}, 5), p = w.byId.p;
    expect(fired(w)).toBe(true);
    const h0 = p.transform.heading;
    run(w, { equipHold: 1 }, 2);
    expect(p.carry.menu).toBe('weapon');
    expect(p.carry.sel).toBe(1);                       // the gun in hand
    run(w, { equipHold: 1, lookDX: -70 }, 1);          // one step back: nothing in hand
    expect(p.carry.sel).toBe(0);
    expect(p.transform.heading).toBe(h0);
    run(w, {}, 1);
    expect(p.carry.menu).toBeNull();
    expect(p.carry.holstered).toBe(true);
    expect(p.weapon).toBeNull();
    expect(fired(w)).toBe(false);
  });
  it('one weapon at a time: stepped to the second slot, let go, it is the one in hand and fires', () => {
    const w = run(world(), {}, 5), p = w.byId.p;
    run(w, { equipHold: 1 }, 1); run(w, { equipHold: 1, step: 1 }, 3);   // an edge: one step, however long it is held
    expect(p.carry.sel).toBe(2);
    run(w, {}, 30);
    expect(p.loadoutIdx).toBe(1);
    expect(fired(w)).toBe(true);
    // from nothing in hand back to a gun
    run(w, { equipHold: 1 }, 1); run(w, { equipHold: 1, step: 1 }, 1); run(w, {}, 1);
    expect(p.carry.holstered).toBe(true);
    run(w, { equipHold: 1 }, 1); run(w, { equipHold: 1, step: 1 }, 1); run(w, {}, 30);
    expect(p.carry.holstered).toBe(false);
    expect(p.weapon).toBeTruthy();
    expect(fired(w)).toBe(true);
  });
  it('the item menu: let go, the one stepped to is used once, its health given back to the body\'s most; spent, it leaves the menu', () => {
    const w = run(world({ items: [{ id: 'ration', count: 2, heal: 40 }] }), {}, 5), p = w.byId.p;
    p.body.hp = 30;
    run(w, { itemHold: 1 }, 3); run(w, {}, 1);
    expect(p.body.hp).toBe(70);
    expect(p.carry.counts).toEqual([1]);
    run(w, { itemHold: 1 }, 1); run(w, {}, 1);
    expect(p.body.hp).toBe(100);
    expect(E.carryPlaces(p, 'item')).toEqual([]);
    run(w, { itemHold: 1 }, 1); run(w, {}, 1);
    expect(p.carry.used).toBe(2);
  });
  it('starts with nothing in hand where the rule says so', () => {
    const w = run(world({ holstered: true }), {}, 2);
    expect(w.byId.p.weapon).toBeNull();
    expect(fired(w)).toBe(false);
  });
});

describe('nothing in hand, a body with a moveset', () => {
  // the fist's ground strings (gameworld/combos.js), as a level's arsenal lays them on a pilot
  const fist = BASIC_ARSENAL.weapons.find((x) => x.id === 'fist'), ground = Object.fromEntries(Object.entries(fist.moves).filter(([, m]) => !m.air && !m.launch));
  const W = lowerArsenal({ timing: BASIC_ARSENAL.timing, weapons: [{ ...fist, figure: 'drawn', guard: false, moves: ground, combos: fist.combos.filter((c) => !c.air && c.moves.every((m) => ground[m])) }] });
  const armed = () => E.createWorld({
    camera: { rule: 'follow', target: 'p' },
    entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 4, eye: 0, strikeContact: [0.4, 0.5], loadout: [gun('handgun')], weapons: W, moveset: W[0].moveset, moveClips: true, carry: {} }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } }],
  });
  it('with the gun in hand the trigger fires it; put away, the trigger is the fist\'s first blow, and the next press its second', () => {
    const w = run(armed(), {}, 5), p = w.byId.p;
    expect(fired(w)).toBe(true);
    expect(p.swingT == null).toBe(true);
    run(w, { equipHold: 1 }, 1); run(w, { equipHold: 1, step: -1 }, 1); run(w, {}, 2);
    expect(p.carry.holstered).toBe(true);
    expect(p.rule.loadout).toBeUndefined();
    run(w, { fire: 1 }, 2);
    expect(p.swingClip).toBe('mv_fist_jab');
    run(w, {}, 16); run(w, { fire: 1 }, 2); run(w, {}, 6);
    expect(p.swingClip).toBe('mv_fist_cross');
    // a weapon chosen again: the loadout back, the trigger the gun's
    run(w, {}, 60); run(w, { equipHold: 1 }, 1); run(w, { equipHold: 1, step: 1 }, 1); run(w, {}, 30);
    expect(Array.isArray(p.rule.loadout)).toBe(true);
    expect(fired(w)).toBe(true);
  });
  it('the kit taken: bare hands only until the item that gives it back is held; then its first slot is in hand', () => {
    const w = run(world({ locked: 'kit' }), {}, 5), p = w.byId.p;
    expect(p.weapon).toBeNull(); expect(p.carry.holstered).toBe(true);
    expect(E.carryPlaces(p, 'weapon').map((x) => x.kind)).toEqual(['none']);
    expect(fired(w)).toBe(false);
    run(w, { equipHold: 1 }, 2); run(w, { equipHold: 1, step: 1 }, 3); run(w, {}, 5);
    expect(p.weapon).toBeNull();                                            // (nothing to step to)
    w.ms = { ...(w.ms || {}), held: { kit: true } };                          // (the mission holds it: found)
    run(w, {}, 2);
    expect(p.carry.locked).toBe(false); expect(p.weapon).toBeTruthy(); expect(p.loadoutIdx).toBe(0); expect(p.kitBack).toBeGreaterThan(0);
    expect(E.carryPlaces(p, 'weapon')).toHaveLength(3);
    expect(fired(w)).toBe(true);
  });
});

