// Blaze Gunner's arsenal, played (scroll-pods.js) on the scroll stage's runtime, its rows lowered from
// gameworld/scroll-stage/pods.js. The concepts: a shot crosses the screen at its speed and hits what is in its line; a
// foe that carries a pod drops it where it falls, and an open slot catches it (both full, it is passed by); the slot's
// press switches the live weapon and fire fires it (the base gun when the live slot is open); spent, a pod's slot opens;
// eject is held, never tapped, and launches the pod as a timed bomb whose ring hurts foes and never the ship; a blade
// cuts what is in its arc and reach only; a beam burns what is in its line by the second; an orbit's ball bites each
// foe once a turn of its clock; a mine stays in the world as the screen moves on; a page without the arsenal keeps every byte.
import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { scrollCamera, SCROLL_VIEWS } from '../../gameworld/scroll-stage/frame.js';
import { lowerArsenal, PODS, BASE_GUN, EJECT_HOLD, BOMB } from '../../gameworld/scroll-stage/pods.js';

const E = composeLive(), DT = 1 / 60, LEN = 12, C = scrollCamera(LEN);
const ARS = lowerArsenal(Object.keys(PODS), { L: LEN, S: C.screen.across });
// the ship at the screen's centre, `foes` at [u, v] off it (metres), each { hp, carries?, r? }
const world = ({ foes = [], track = [], slots } = {}) => {
  const st = E.createWorld({
    entities: [{ id: 'ship', pilotable: true, rule: { type: 'scroll-ship', size: [LEN, 4], at: [0, 0], arsenal: ARS }, transform: { pos: [0, 0, 0] } },
      ...foes.map((f, i) => ({ id: `foe-${i}`, team: 'foes', rule: { type: 'static', ...(f.carries ? { carries: f.carries } : {}) }, body: { type: 'none', hp: f.hp ?? 5, radius: f.r ?? 1.5 }, transform: { pos: [0, f.at[0], f.at[1]] } }))],
    camera: { rule: 'scroll', target: 'ship', view: 'side', dist: C.dist, screen: [C.screen.along, C.screen.across], track },
    pilot: 'ship',
  });
  if (slots) { E.stepWorld(st, {}, DT); st.byId.ship.slots = slots.map((id) => (id ? { id, ammo: ARS.pods[id].ammo } : null)); }
  return st;
};
const step = (st, input = {}, n = 1) => { for (let i = 0; i < n; i++) E.stepWorld(st, input, DT); return st; };
const ship = (st) => st.byId.ship;
const hp = (st, i = 0) => st.byId[`foe-${i}`].body.hp;

describe('the arsenal', () => {
  it('carries its views\' bases as the frame defines them', () => {
    const src = emissionSource({ scroll: true, scrollPods: true });
    for (const id of Object.keys(SCROLL_VIEWS)) expect(src).toContain(`${id}: { along: [${SCROLL_VIEWS[id].along.join(', ')}], across: [${SCROLL_VIEWS[id].across.join(', ')}], toward: [${SCROLL_VIEWS[id].toward.join(', ')}] }`);
  });

  it('a shot crosses the screen at its speed, and hits what is in its line', () => {
    const st = world({ track: [{ by: [2000, 0], pace: 30 }], foes: [{ at: [60, 0], hp: 3 }, { at: [60, 30], hp: 3 }] });
    step(st, { fire: 1 }, 1);
    const s0 = ship(st).strikes.find((s) => s.k === 'shot'), u0 = s0.u - st.camera._sc[0];
    step(st, {}, 6);
    const s1 = ship(st).strikes.find((s) => s === s0) || s0;
    expect((s1.u - st.camera._sc[0] - u0) / (6 * DT)).toBeCloseTo(ARS.base.fire.shots[0].speed, 0);
    step(st, { fire: 1 }, 60);
    expect(hp(st, 0)).toBeLessThan(3);
    expect(hp(st, 1)).toBe(3);
  });

  it('a foe that carries a pod drops it where it falls, and an open slot catches it', () => {
    const st = world({ foes: [{ at: [30, 0], hp: 0.5, carries: 'spread' }] });
    step(st, { fire: 1 }, 30);
    expect(st.byId['foe-0'].downed).toBe(true);
    expect(st.podDrops.map((d) => d.pod)).toEqual(['spread']);
    st.podDrops[0].u = ship(st).screenAt[0] + 1; st.podDrops[0].v = ship(st).screenAt[1];
    step(st, {}, 1);
    expect(ship(st).slots[0]).toEqual({ id: 'spread', ammo: PODS.spread.ammo });
    expect(st.podDrops).toEqual([]);
  });

  it('with both slots full, a pod is passed by', () => {
    const st = world({ slots: ['vulcan', 'cannon'] });
    st.podDrops = [{ id: 9, pod: 'blade', u: ship(st).screenAt[0], v: ship(st).screenAt[1], t: 0 }];
    step(st, {}, 2);
    expect(ship(st).slots.map((s) => s.id)).toEqual(['vulcan', 'cannon']);
    expect(st.podDrops.length).toBe(1);
  });

  it('the slot\'s press switches the live weapon, and fire fires it; the base gun where the live slot is open', () => {
    const st = world({ slots: ['cannon', null] });
    step(st, { fire: 1 }, 1);
    expect(ship(st).strikes.at(-1).r).toBeCloseTo(PODS.cannon.fire.shots[0].r * LEN, 3);
    step(st, {}, 1); step(st, { slot: 1 }, 5);
    expect(ship(st).live).toBe(1);
    step(st, {}, 40); ship(st).strikes = [];
    step(st, { fire: 1 }, 1);
    expect(ship(st).strikes.length).toBe(BASE_GUN.fire.shots.length);
  });

  it('a pod spent opens its slot', () => {
    const st = world({ slots: ['cannon', null] });
    ship(st).slots[0].ammo = 1;
    step(st, { fire: 1 }, 1);
    expect(ship(st).slots[0]).toBe(null);
  });

  it('eject is held, never tapped, and launches the pod as a timed bomb that hurts foes and never the ship', () => {
    // (a foe where the bomb bursts, ahead of the muzzle by its flight; the ship flown into the blast before it goes off)
    const burst = LEN / 2 + ARS.bomb.speed * BOMB.fuse;
    const st = world({ slots: ['grenade', null], foes: [{ at: [burst, 0], hp: 100, r: 2 }] });
    ship(st).body = { type: 'none', hp: 10 };
    step(st, { missile: 1 }, Math.floor((EJECT_HOLD / DT) * 0.5)); step(st, {}, 1);
    expect(ship(st).slots[0]).not.toBe(null);
    step(st, { missile: 1 }, Math.ceil(EJECT_HOLD / DT) + 1);
    expect(ship(st).slots[0]).toBe(null);
    expect(ship(st).strikes.some((s) => s.k === 'bomb')).toBe(true);
    const before = hp(st);
    ship(st).off = [burst - 2, 0];
    step(st, {}, Math.ceil((BOMB.fuse + BOMB.time) / DT) + 2);
    expect(hp(st)).toBeLessThanOrEqual(before - PODS.grenade.bomb.dmg);
    expect(ship(st).body.hp).toBe(10);
  });

  it('a blade cuts what is in its arc and reach, and nothing behind or beyond it', () => {
    const reach = PODS.blade.fire.reach * LEN, nose = LEN / 2;
    const st = world({ slots: ['blade', null], foes: [{ at: [nose + reach * 0.6, 2], hp: 20, r: 0.5 }, { at: [-nose - 4, 0], hp: 20, r: 0.5 }, { at: [nose + reach * 2, 0], hp: 20, r: 0.5 }] });
    step(st, { fire: 1 }, 15);
    expect(hp(st, 0)).toBe(20 - PODS.blade.fire.dmg);
    expect(hp(st, 1)).toBe(20);
    expect(hp(st, 2)).toBe(20);
  });

  it('a beam burns what is in its line by the second', () => {
    const st = world({ slots: ['lance', null], foes: [{ at: [40, 0], hp: 100 }] });
    step(st, { fire: 1 }, 60);
    expect(100 - hp(st)).toBeCloseTo(PODS.lance.fire.dps, 0);
    expect(ship(st).slots[0].ammo).toBeCloseTo(PODS.lance.ammo - 1, 1);
  });

  it('an orbit\'s ball bites each foe once a turn of its clock', () => {
    const R = PODS.flail.fire.radius * LEN;
    const st = world({ slots: ['flail', null], foes: [{ at: [R, 0], hp: 100, r: 2 }] });
    step(st, { fire: 1 }, 60 * 2);
    const bites = (100 - hp(st)) / PODS.flail.fire.dmg;
    expect(bites).toBeGreaterThanOrEqual(2);
    expect(bites).toBeLessThanOrEqual(2 / PODS.flail.fire.every);
  });

  it('a mine stays in the world as the screen moves on', () => {
    const st = world({ slots: ['mine', null], track: [{ by: [2000, 0], pace: 30 }] });
    step(st, { fire: 1 }, 1);
    const m = ship(st).strikes.find((s) => s.still), u = m.u;
    step(st, {}, 60);
    expect(m.u).toBeCloseTo(u, 6);
    expect(st.camera._sc[0]).toBeGreaterThan(20);
  });

  it('a page without the arsenal keeps every byte', () => {
    expect(emissionSource({ scroll: true })).not.toContain('scroll-pods');
    expect(emissionSource({ scroll: true, scrollPods: true })).toContain('scroll-pods');
  });
});
