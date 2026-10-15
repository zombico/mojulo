import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';
import { roleLoadout, weaponRole } from '../../gameworld/weapon-roles.js';

// WEAPON PICKUPS and ROLES: a loadout slot `held: false` is not carried until the cast's `arm` gives it (a gun off the
// floor); a fresh spawn takes the kit back; a mind takes the gun whose band holds the range; a close gun's rounds thin
// past a room (falloff); a launcher's burst says what it dealt.

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const loadout = roleLoadout(0.5, ['close', 'long']).map((c) => ({ ...c, weapon: { ...c.weapon, eye: 1.4 } }));
const bot = (id, pos, heading, extra = {}) => ({
  id, rule: { type: 'ai', mind: { motivation: 'frag', perception: 'memory' }, sightRange: 60, sightCone: 1.4, standoff: 30, speed: 0, turn: 6, burst: 0.3, pause: 1, eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, loadout, ...extra },
  body: { type: 'mesh', hittable: true, hp: 1e6, poise: 1e6, radius: 0.6, egg: { ...PERSON } }, transform: { pos, heading, pitch: 0 },
});

describe('weapon pickups', () => {
  it('a slot held: false is not carried: the cycle and its key pass it by, the first held gun is in hand', () => {
    const w = E.createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 0, eye: 0, loadout }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const p = w.byId.p;
    expect(p.loadoutHeld).toEqual([true, false, false]);
    expect(p.weapon).toBe(p.loadoutWeapons[0]);
    E.stepWorld(w, { slot: 2 }, 1 / 30, hooks);
    expect(p.loadoutIdx || 0).toBe(0);
    E.stepWorld(w, { cycle: 1 }, 1 / 30, hooks);
    expect(p.loadoutIdx || 0).toBe(0);
  });

  it('arm: picked up, it is drawn and its key reaches it; a gun carried takes its rounds; a fresh spawn takes the kit back', () => {
    const w = E.createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 0, eye: 0, loadout }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const p = w.byId.p;
    E.castOps(w, [{ op: 'arm', who: 'p', slot: 'long' }]);
    expect(p.loadoutHeld).toEqual([true, false, true]);
    expect(p.loadoutIdx).toBe(2);
    expect(p.weapon).toBe(p.loadoutWeapons[2]);
    expect(p.readyT).toBeGreaterThan(0);   // a drawn gun pays its switch time
    p.loadoutWeapons[2].ammo = 0; p.loadoutWeapons[2].reserve = 0;
    E.castOps(w, [{ op: 'arm', who: 'p', slot: 'long' }]);
    expect(p.loadoutWeapons[2].ammo).toBe(p.loadoutWeapons[2].magazine);
    E.stepWorld(w, { slot: 1 }, 1 / 30, hooks);
    expect(p.loadoutIdx).toBe(0);
    p.loadoutWeapons[0].ammo = 1;
    E.castOps(w, [{ op: 'kill', who: 'p' }, { op: 'spawn', who: 'p', at: [5, 0, 0], fresh: true }]);
    expect(p.loadoutHeld).toEqual([true, false, false]);
    expect([p.loadoutIdx, p.weapon === p.loadoutWeapons[0], p.weapon.ammo]).toEqual([0, true, p.weapon.magazine]);
  });

  it('without a held: false slot nothing changes: every slot carried, slot 0 in hand', () => {
    const all = loadout.map(({ held: _h, ...c }) => c);
    const w = E.createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 0, eye: 0, loadout: all }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    expect(w.byId.p.loadoutHeld).toBeUndefined();
    E.stepWorld(w, { slot: 3 }, 1 / 30, hooks);
    expect(w.byId.p.loadoutIdx).toBe(2);
  });
});

describe('a gun for the range', () => {
  const pick = (d) => {
    const w = E.createWorld({ entities: [bot('a', [0, 0, 0], 0), bot('b', [d, 0, 0], Math.PI, { mind: { motivation: 'idle' } })] });
    const a = w.byId.a;
    E.castOps(w, [{ op: 'arm', who: 'a', slot: 'close', draw: false }, { op: 'arm', who: 'a', slot: 'long', draw: false }]);
    for (let k = 0; k < 20; k++) E.stepWorld(w, {}, 1 / 30, hooks);
    return loadout[a.loadoutIdx || 0].name;
  };
  it('each held gun has its band: close at arm\'s length, the rifle between, the long gun across a hall', () => {
    expect([pick(4), pick(14), pick(40)]).toEqual(['close', 'mid', 'long']);
  });
  it('a gun not yet picked up is not taken, whatever the range', () => {
    const w = E.createWorld({ entities: [bot('a', [0, 0, 0], 0), bot('b', [40, 0, 0], Math.PI, { mind: { motivation: 'idle' } })] });
    for (let k = 0; k < 20; k++) E.stepWorld(w, {}, 1 / 30, hooks);
    expect(w.byId.a.loadoutIdx || 0).toBe(0);
  });
});

describe('a round by its role', () => {
  const shot = (weapon, d) => {
    const w = E.createWorld({ entities: [
      { id: 'p', pilotable: true, rule: { type: 'walk', speed: 0, eye: 0 }, weapon: { ...weapon, eye: 1.3, hand: undefined, spread: undefined }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } },
      { id: 't', rule: { type: 'walk', speed: 0, eye: 0 }, body: { type: 'mesh', hittable: true, hp: 1000, egg: { ...PERSON } }, transform: { pos: [d, 0, 0], heading: Math.PI } },
    ] });
    for (let k = 0; k < 60 && !w.byId.t.hits; k++) E.stepWorld(w, { fire: k === 0 ? 1 : 0 }, 1 / 30, hooks);
    return w.byId.t;
  };
  it('falloff: the close gun deals its damage to a room, and thins to its least past it', () => {
    const C = weaponRole('close', 0.5).weapon;
    expect(shot(C, 4).lastHitDmg).toBe(C.damage);
    expect(shot(C, 20).lastHitDmg).toBeCloseTo(C.damage * C.falloff.min);
    const mid = shot(C, 9.5).lastHitDmg;
    expect(mid).toBeLessThan(C.damage);
    expect(mid).toBeGreaterThan(C.damage * C.falloff.min);
  });
  it('without falloff a round deals the same at any range', () => {
    const { falloff: _f, ...C } = weaponRole('close', 0.5).weapon;
    expect(shot(C, 20).lastHitDmg).toBe(C.damage);
  });
  it('a launcher\'s burst says what it dealt (the hit fact the bus takes damage from)', () => {
    const A = weaponRole('area', 1).weapon, t = shot(A, 10);
    expect(t.hits).toBe(1);
    expect(t.lastHitDmg).toBe(A.damage);
    expect(t.lastHitDmgN).toBe(1);
  });
});
