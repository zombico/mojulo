// An interior's walls in play (the scroll camera rule's `walls`: worlds/controllable/scroll-foes.js and scroll-pods.js).
// The concepts: a wall is terrain, the ship's hitbox in one takes a hit and is put out the nearest way (a floor up, a
// bulkhead back down the scroll), once each invulnerable spell; a foe's bullet that meets a wall ends there; the ship's
// shot ends on a wall, struck (an impact), a grenade's burst going off there; a bomb blows on one; the beam reaches the
// first wall across its line; with no walls nothing changes.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { scrollCamera } from '../../gameworld/scroll-stage/frame.js';
import { lowerArsenal, PODS } from '../../gameworld/scroll-stage/pods.js';

const E = composeLive(), DT = 1 / 60, LEN = 12, C = scrollCamera(LEN), SA = C.screen.along, SC = C.screen.across;
const ARS = lowerArsenal(Object.keys(PODS), { L: LEN, S: SC });
const world = ({ walls, at = [0, 0], slots, hp = 10 } = {}) => {
  const st = E.createWorld({
    entities: [{ id: 'ship', pilotable: true, rule: { type: 'scroll-ship', size: [LEN, 4], at, arsenal: ARS, hitbox: { r: 1, at: 0 }, invuln: 1 }, body: { type: 'none', hp }, transform: { pos: [0, 0, 0] } }],
    camera: { rule: 'scroll', target: 'ship', view: 'side', dist: C.dist, screen: [SA, SC], track: [], ...(walls ? { walls } : {}) },
    pilot: 'ship',
  });
  E.stepWorld(st, {}, DT);
  if (slots) st.byId.ship.slots = slots.map((id) => (id ? { id, ammo: ARS.pods[id].ammo } : null));
  return st;
};
const step = (st, input = {}, n = 1) => { for (let i = 0; i < n; i++) E.stepWorld(st, input, DT); return st; };
const ship = (st) => st.byId.ship;

describe('an interior\'s walls', () => {
  it('are terrain: the hitbox in a floor takes a hit and is put out upward, once a spell', () => {
    const st = world({ walls: [[-SA, SA, -SC, -2]] });
    ship(st).off[1] = -3; step(st);
    expect(ship(st).body.hp).toBe(9);
    expect(ship(st).screenAt[1] + 1).toBeGreaterThanOrEqual(-2 - 1e-6);
    ship(st).off[1] = -3; step(st);
    expect(ship(st).body.hp).toBe(9);   // (unhurt a moment after a hit)
  });

  it('a bulkhead ahead puts the ship back down the scroll', () => {
    const st = world({ walls: [[10, 14, -SC, SC]] });
    const u0 = ship(st).screenAt[0];
    step(st, { turn: 1 }, 60);
    expect(ship(st).screenAt[0]).toBeLessThan(10);
    expect(ship(st).screenAt[0]).toBeGreaterThan(u0);
    expect(ship(st).body.hp).toBeLessThan(10);
  });

  it('a foe\'s bullet that meets a wall ends there', () => {
    const st = world({ walls: [[30, 34, -SC, SC]] });
    st.foeShots = [{ u: 60, v: 0, du: -40, dv: 0, r: 0.5, dmg: 1, t: 0, hue: '#f0f' }, { u: 60, v: 0, du: 0, dv: 0, r: 0.5, dmg: 1, t: 0, hue: '#f0f' }];
    step(st, {}, 60);
    expect(st.foeShots).toHaveLength(1);
    expect(ship(st).body.hp).toBe(10);
  });

  it('the ship\'s shot ends on a wall, struck; a grenade bursts there; a bomb blows on one', () => {
    const st = world({ walls: [[40, 44, -SC, SC]] });
    step(st, { fire: 1 }, 1); step(st, {}, 90);
    expect(ship(st).strikes.filter((s) => s.k === 'shot' && s.u > 44)).toHaveLength(0);
    const g = world({ walls: [[30, 34, -SC, SC]], slots: ['grenade', null] });
    let rang = false;
    for (let i = 0; i < 240 && !rang; i++) { step(g, { fire: i < 2 ? 1 : 0 }); rang = ship(g).strikes.some((s) => s.k === 'ring' && s.u < 36); }
    expect(rang).toBe(true);
    const b = world({ walls: [[30, 34, -SC, SC]], slots: ['vulcan', null] });
    let blown = false;
    for (let i = 0; i < 120 && !blown; i++) { step(b, { boost: 1 }); blown = ship(b).strikes.some((s) => s.k === 'ring'); }
    expect(blown).toBe(true);
    expect(ship(b).strikes.find((s) => s.k === 'ring').u).toBeLessThan(36);
  });

  it('the beam reaches the first wall across its line', () => {
    const st = world({ walls: [[50, 54, -SC, SC], [30, 34, 20, SC]], slots: ['lance', null] });
    step(st, { fire: 1 }, 2);
    expect(ship(st).beam.u1).toBe(50);
  });

  it('with no walls nothing changes', () => {
    const a = world(), b = world({ walls: [] });
    step(a, { fire: 1, turn: 1 }, 30); step(b, { fire: 1, turn: 1 }, 30);
    expect(JSON.stringify(ship(a).screenAt)).toBe(JSON.stringify(ship(b).screenAt));
    expect(ship(a).strikes.length).toBe(ship(b).strikes.length);
  });
});
