// An interior's walls in play (the scroll camera rule's `walls`: worlds/controllable/scroll-foes.js and scroll-pods.js).
// The concepts: a wall is terrain, the ship's hitbox in one takes a hit and is put out the nearest way (a floor up, a
// bulkhead back down the scroll), once each invulnerable spell; a corridor's floor and ceiling are ramps between its
// knots, the hitbox put out to where they stand, and the hull's face at the mouth puts a ship back off it; a foe's bullet that meets a wall ends there; the ship's
// shot ends on a wall, struck (an impact), a grenade's burst going off there; a bomb blows on one; the beam reaches the
// first wall across its line; a mover (a crusher, a lock's leaf) is told, slams, holds and draws back by its cycle, and
// where it stands it is terrain and stops rounds; with no walls nothing changes.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { scrollCamera } from '../../gameworld/scroll-stage/frame.js';
import { lowerArsenal, PODS } from '../../gameworld/scroll-stage/pods.js';
import { moverBoxAt } from '../../gameworld/scroll-stage/interior.js';

const E = composeLive(), DT = 1 / 60, LEN = 12, C = scrollCamera(LEN), SA = C.screen.along, SC = C.screen.across;
const ARS = lowerArsenal(Object.keys(PODS), { L: LEN, S: SC });
const world = ({ walls, corridor, at = [0, 0], slots, hp = 10 } = {}) => {
  const st = E.createWorld({
    entities: [{ id: 'ship', pilotable: true, rule: { type: 'scroll-ship', size: [LEN, 4], at, arsenal: ARS, hitbox: { r: 1, at: 0 }, invuln: 1 }, body: { type: 'none', hp }, transform: { pos: [0, 0, 0] } }],
    camera: { rule: 'scroll', target: 'ship', view: 'side', dist: C.dist, screen: [SA, SC], track: [], ...(walls ? { walls } : {}), ...(corridor ? { corridor } : {}) },
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
    ship(st).off[1] = -3; step(st); step(st);
    expect(ship(st).body.hp).toBe(9);
    expect(ship(st).screenAt[1] - 1).toBeGreaterThanOrEqual(-2 - 1e-6);   // (out, its hitbox clear of the floor)
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

  // a corridor: a floor ramping up from -30 to -6 between u 0 and 60, the ceiling flat at 30; its run from -40 to 200
  const RAMP = [[-40, -30, 30], [0, -30, 30], [60, -6, 30], [200, -6, 30]];

  it('a corridor\'s floor is a ramp: the hitbox under it is put out up to where the floor stands at its place', () => {
    const st = world({ corridor: RAMP });
    ship(st).off[0] = 30; ship(st).off[1] = -25; step(st); step(st);
    expect(ship(st).body.hp).toBe(9);
    expect(ship(st).screenAt[1] - 1).toBeGreaterThanOrEqual(-18 - 0.05);
    expect(ship(st).screenAt[1]).toBeLessThan(-14);
  });

  it('the hull\'s face at the run\'s mouth puts a ship back off it, outside the open', () => {
    const st = world({ corridor: [[20, -10, 10], [200, -10, 10]] });
    ship(st).off[1] = 30; step(st, { turn: 1 }, 30);
    expect(ship(st).screenAt[0]).toBeLessThan(20);
    expect(ship(st).body.hp).toBeLessThan(10);
    const ok = world({ corridor: [[20, -10, 10], [200, -10, 10]] });
    step(ok, { turn: 1 }, 30);
    expect(ok.byId.ship.screenAt[0]).toBeGreaterThan(20);   // (in through the mouth: no harm)
    expect(ok.byId.ship.body.hp).toBe(10);
  });

  it('rounds end where the corridor closes over them, the ship\'s and a foe\'s', () => {
    const st = world({ corridor: RAMP });
    st.foeShots = [{ u: 50, v: -20, du: 0, dv: -10, r: 0.5, dmg: 1, t: 0, hue: '#f0f' }];
    step(st, {}, 5);
    expect(st.foeShots).toHaveLength(0);
    const b = world({ corridor: RAMP, slots: ['lance', null] });
    b.byId.ship.off[1] = -20; step(b);
    step(b, { fire: 1 }, 2);
    // (the beam at v -20 meets the floor where it ramps up through -20: a third of the way from 0 to 60, less its half-width)
    expect(ship(b).beam.u1).toBeGreaterThan(5); expect(ship(b).beam.u1).toBeLessThan(40);
  });

  // a mover: a crusher from the ceiling, out over u 20..30 from v 0 to 60, drawn back 60 into the ceiling; its cycle
  const CYC = { tell: 0.5, slam: 0.2, hold: 0.5, back: 0.5, rest: 1, period: 2.7, phase: 0 };
  const mover = (o = {}) => ({ id: 'crusher', rule: { type: 'scroll-mover', kind: 'crusher', box: [20, 30, 0, 60], from: 'ceiling', reach: 60, cycle: CYC, ...o }, body: { type: 'none' }, transform: { pos: [0, 0, 0] } });
  const withMover = (o, more = {}) => { const st = E.createWorld({ entities: [{ id: 'ship', pilotable: true, rule: { type: 'scroll-ship', size: [LEN, 4], at: [0, 0], arsenal: ARS, hitbox: { r: 1, at: 0 }, invuln: 1 }, body: { type: 'none', hp: 10 }, transform: { pos: [0, 0, 0] } }, mover(o)],
    camera: { rule: 'scroll', target: 'ship', view: 'side', dist: C.dist, screen: [SA, SC], track: [], ...more }, pilot: 'ship' }); E.stepWorld(st, {}, DT); return st; };

  it('a crusher is told (shuddering), slams out, holds and draws back by its cycle on the world\'s clock', () => {
    const st = withMover();
    const at = (t) => { while (st.time < t) E.stepWorld(st, {}, DT); return st.byId.crusher; };
    expect(at(0.25).tellNow).toBeGreaterThan(0); expect(at(0.25).out).toBe(0);
    expect(at(0.85).out).toBe(1); expect(at(0.85)._box[2]).toBeCloseTo(0, 6);
    expect(at(2.2).out).toBe(0); expect(at(2.2)._box[2]).toBeCloseTo(60, 6);
  });

  it('a mover where it stands is terrain and stops rounds; drawn back it is neither', () => {
    const st = withMover({ cycle: { ...CYC, tell: 0, slam: 0.01, hold: 99, period: 100 } });
    step(st, {}, 2);
    ship(st).off[0] = 25; ship(st).off[1] = 10; step(st); step(st);
    expect(ship(st).body.hp).toBe(9);
    st.foeShots = [{ u: 50, v: 30, du: -60, dv: 0, r: 0.5, dmg: 1, t: 0, hue: '#f0f' }];
    step(st, {}, 30);
    expect(st.foeShots).toHaveLength(0);
    const back = withMover({ cycle: { ...CYC, tell: 0, slam: 0, hold: 0, back: 0, rest: 99, period: 100 } });
    back.byId.ship.off[0] = 25; back.byId.ship.off[1] = 10; step(back); step(back);
    expect(back.byId.ship.body.hp).toBe(10);
  });

  it('the runtime reads a mover where interior.js\'s moverBoxAt reads it, every kind; a shield opens for good once its charge falls', () => {
    for (const kind of ['crusher', 'lock']) {
      const st = withMover({ kind, cycle: kind === 'lock' ? { open: 0.6, tell: 0.5, close: 0.4, shut: 0.7, opening: 0.4, period: 2.6, phase: 0.3 } : { ...CYC, phase: 0.4 } });
      for (let i = 0; i < 200; i++) {
        E.stepWorld(st, {}, DT);
        const m = st.byId.crusher, want = moverBoxAt(m.rule, st.time - DT);   // (a rule runs on the clock before the step advances it)
        expect(m._box[2]).toBeCloseTo(want.box[2], 6); expect(m.out).toBeCloseTo(want.out, 6);
      }
    }
    const sh = E.createWorld({ entities: [{ id: 'ship', pilotable: true, rule: { type: 'scroll-ship', size: [LEN, 4], at: [0, 0], arsenal: ARS }, body: { type: 'none', hp: 10 }, transform: { pos: [0, 0, 0] } },
      { id: 'core', team: 'foes', rule: { type: 'static' }, body: { type: 'none', hp: 5, radius: 3 }, transform: { pos: [0, 80, 0] } }, mover({ kind: 'lock', opensWith: 'core', cycle: { open: 0, tell: 0, close: 0.01, shut: 99, opening: 0, period: 100, phase: 0 } })],
      camera: { rule: 'scroll', target: 'ship', view: 'side', dist: C.dist, screen: [SA, SC], track: [] }, pilot: 'ship' });
    step(sh, {}, 10);
    expect(sh.byId.crusher.out).toBe(1);
    sh.byId.core.downed = true; step(sh, {}, 2);
    expect(sh.byId.crusher.out).toBe(0);
  });

  it('with no walls nothing changes', () => {
    const a = world(), b = world({ walls: [] });
    step(a, { fire: 1, turn: 1 }, 30); step(b, { fire: 1, turn: 1 }, 30);
    expect(JSON.stringify(ship(a).screenAt)).toBe(JSON.stringify(ship(b).screenAt));
    expect(ship(a).strikes.length).toBe(ship(b).strikes.length);
  });
});
