import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';
import { SHOOT } from '../../gameworld/quick.js';

// A GUNNER SEAT (turret.js, a world's `seats.crew: { <n>: { body, as: 'gunner' } }`, soul.dependence=roles): one body, two
// seats. Seat 1 drives the hull on its rule; seat n works the gun on its turret, its look slewing the mount and its trigger
// firing, the driver's own look and trigger put by. With nobody in seat n the driver's hand has the gun. Absent, nothing.

const E = composeLive(), DT = 1 / 60, hooks = { ground: () => 0 };
const TURRET = { mount: { at: [0, 0, 1.6], look: 0.1, stabilized: true, traverse: { rate: 120, accel: 600 }, elevation: { rate: 60, accel: 300, min: -8, max: 25 } }, gun: { barrel: 1.4 } };
const car = () => ({ id: 'car', pilotable: true, rule: { type: 'drive', topSpeed: 20, eye: 0 }, body: { type: 'none' }, turret: TURRET, weapon: { ...SHOOT.gun, auto: true, cooldown: 0.1 }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } });
const world = (crew = true) => E.createWorld({ entities: [car()], ...(crew ? { seats: { bodies: [], crew: { 2: { body: 'car', as: 'gunner' } } } } : {}) });
const run = (w, input, s) => { for (let i = 0; i < Math.round(s / DT); i++) E.stepWorld(w, input, DT, hooks); return w; };
const yaw = (w) => w.byId.car.turret.yaw;
// (a sight gun's round is hitscan: counted by the rounds it spent)
const shots = (w) => { const g = w.byId.car.weapon; return g.magazine - g.ammo + (g.reloading ? g.magazine : 0); };

describe('a gunner seat', () => {
  it('the gunner\'s look slews the turret; the driver\'s look does not', () => {
    const w = run(world(), { forward: 0, lookDX: 0, seats: { 2: { lookDX: 10 } } }, 0.5);
    expect(yaw(w)).toBeGreaterThan(15);
    const v = run(world(), { forward: 0, lookDX: 10, seats: { 2: {} } }, 0.5);
    expect(Math.abs(yaw(v))).toBeLessThan(1e-6);
  });

  it('the gunner\'s trigger fires and the driver\'s does not; the driver\'s stick still drives', () => {
    const a = run(world(), { forward: 1, fire: 1, seats: { 2: {} } }, 1);
    expect(shots(a)).toBe(0);
    expect(a.byId.car.transform.pos[0]).toBeGreaterThan(0.5);
    const b = run(world(), { forward: 0, seats: { 2: { fire: 1 } } }, 1);
    expect(shots(b)).toBeGreaterThan(0);
  });

  it('nobody in the gunner\'s seat: the driver\'s hand has the gun, as without a crew', () => {
    const w = run(world(), { lookDX: 2, fire: 1 }, 0.5), solo = run(world(false), { lookDX: 2, fire: 1 }, 0.5);
    expect(yaw(w)).toBeCloseTo(yaw(solo), 9);
    expect(shots(w)).toBe(shots(solo));
    expect(shots(w)).toBeGreaterThan(0);
    expect(Math.abs(yaw(w))).toBeGreaterThan(1);
  });

  it('a crew naming another body than the pilot\'s is no gunner', () => {
    const w = E.createWorld({ entities: [car()], seats: { bodies: [], crew: { 2: { body: 'other', as: 'gunner' } } } });
    expect(w.crewGun).toBeUndefined();
  });
});
